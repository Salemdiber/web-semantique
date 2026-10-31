"""Module utilisateur : inscription, connexion et administration des comptes.

Rôles : `admin`, `formateur`, `etudiant`.
- Inscription publique : étudiant ou formateur uniquement.
- Les administrateurs sont créés par un administrateur (ou au démarrage).
"""
from __future__ import annotations

import re
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator

from app import db, export_owl, ontologie_sync
from app import quiz as quiz_stockage
from app.security import creer_jeton, lire_jeton, verifier_mot_de_passe

router = APIRouter(prefix="/auth", tags=["Utilisateurs"])

RE_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SECURITE = HTTPBearer(auto_error=False)


# ------------------------------------------------------------- schémas -----
class Inscription(BaseModel):
    nom: str = Field(min_length=2, max_length=80)
    email: str = Field(max_length=120)
    mot_de_passe: str = Field(min_length=8, max_length=128)
    role: str = "etudiant"

    @field_validator("email")
    @classmethod
    def email_valide(cls, valeur: str) -> str:
        valeur = valeur.strip().lower()
        if not RE_EMAIL.match(valeur):
            raise ValueError("Adresse e-mail invalide")
        return valeur

    @field_validator("role")
    @classmethod
    def role_autorise(cls, valeur: str) -> str:
        if valeur not in db.ROLES_INSCRIPTION:
            raise ValueError("Le rôle doit être « etudiant » ou « formateur »")
        return valeur


class Connexion(BaseModel):
    email: str = Field(max_length=120)
    mot_de_passe: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def email_valide(cls, valeur: str) -> str:
        return valeur.strip().lower()


class ModificationUtilisateur(BaseModel):
    role: str | None = None
    actif: bool | None = None

    @field_validator("role")
    @classmethod
    def role_valide(cls, valeur: str | None) -> str | None:
        if valeur is not None and valeur not in db.ROLES:
            raise ValueError("Rôle inconnu")
        return valeur


class ReponseAuth(BaseModel):
    access_token: str
    token_type: str = "bearer"
    utilisateur: dict[str, Any]


# ------------------------------------------------------- authentification ---
def utilisateur_courant(
    identifiants: Annotated[
        HTTPAuthorizationCredentials | None, Depends(SECURITE)
    ] = None,
) -> dict[str, Any]:
    """Dépendance FastAPI : renvoie l'utilisateur du jeton Bearer."""
    if identifiants is None or identifiants.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentification requise",
            headers={"WWW-Authenticate": "Bearer"},
        )

    charge = lire_jeton(identifiants.credentials)
    if not charge:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expirée ou jeton invalide",
            headers={"WWW-Authenticate": "Bearer"},
        )

    ligne = db.trouver_par_id(int(charge.get("sub", 0)))
    if ligne is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Compte introuvable",
        )
    if not ligne["actif"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé",
        )
    return {
        "id": ligne["id"],
        "nom": ligne["nom"],
        "email": ligne["email"],
        "role": ligne["role"],
        "actif": bool(ligne["actif"]),
        "cree_le": ligne["cree_le"],
    }


def exiger_admin(
    utilisateur: Annotated[dict[str, Any], Depends(utilisateur_courant)],
) -> dict[str, Any]:
    if utilisateur["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Réservé aux administrateurs",
        )
    return utilisateur


def _reponse_auth(ligne: dict[str, Any]) -> ReponseAuth:
    return ReponseAuth(
        access_token=creer_jeton(ligne["id"], ligne["role"]),
        utilisateur=ligne,
    )


# ---------------------------------------------------------------- routes ---
@router.post(
    "/inscription",
    response_model=ReponseAuth,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un compte étudiant ou formateur",
)
def inscription(donnees: Inscription) -> ReponseAuth:
    if db.trouver_par_email(donnees.email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte existe déjà avec cette adresse e-mail",
        )
    try:
        ligne = db.creer(
            nom=donnees.nom,
            email=donnees.email,
            mot_de_passe=donnees.mot_de_passe,
            role=donnees.role,
        )
    except Exception as exc:  # contrainte d'unicité / base verrouillée
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Inscription impossible : {exc}",
        ) from exc
    # Crée l'individu OWL (Étudiant/Formateur) sans bloquer si Fuseki est absent,
    # puis l'écrit dans le fichier OWL pour qu'il survive à un rechargement.
    ontologie_sync.synchroniser(ligne)
    export_owl.exporter_sans_erreur()
    return _reponse_auth(ligne)


@router.post("/connexion", response_model=ReponseAuth, summary="Connexion")
def connexion(donnees: Connexion) -> ReponseAuth:
    ligne = db.trouver_par_email(donnees.email)
    if ligne is None or not verifier_mot_de_passe(
        donnees.mot_de_passe, ligne["mot_de_passe"]
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou mot de passe incorrect",
        )
    if not ligne["actif"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce compte a été désactivé par un administrateur",
        )
    return _reponse_auth(
        {
            "id": ligne["id"],
            "nom": ligne["nom"],
            "email": ligne["email"],
            "role": ligne["role"],
            "actif": bool(ligne["actif"]),
            "cree_le": ligne["cree_le"],
        }
    )


@router.get("/moi", summary="Profil de l'utilisateur connecté")
def moi(
    utilisateur: Annotated[dict[str, Any], Depends(utilisateur_courant)],
) -> dict[str, Any]:
    return utilisateur


# ------------------------------------------------- administration (admin) --
@router.get(
    "/utilisateurs",
    summary="Lister tous les comptes (administrateur)",
)
def lister_utilisateurs(
    _: Annotated[dict[str, Any], Depends(exiger_admin)],
) -> list[dict[str, Any]]:
    return db.lister()


@router.patch(
    "/utilisateurs/{utilisateur_id}",
    summary="Changer le rôle ou activer/désactiver un compte (administrateur)",
)
def modifier_utilisateur(
    utilisateur_id: int,
    donnees: ModificationUtilisateur,
    admin: Annotated[dict[str, Any], Depends(exiger_admin)],
) -> dict[str, Any]:
    if utilisateur_id == admin["id"] and (
        donnees.actif is False or (donnees.role and donnees.role != "admin")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas retirer vos propres droits d'administrateur",
        )
    ligne = db.modifier(utilisateur_id, donnees.role, donnees.actif)
    if ligne is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    # Met à jour le type OWL (ou retire l'individu si le rôle devient admin),
    # puis répercute le changement dans le fichier OWL.
    if donnees.role is not None:
        ontologie_sync.synchroniser(ligne)
        export_owl.exporter_sans_erreur()
    return ligne


@router.delete(
    "/utilisateurs/{utilisateur_id}",
    summary="Supprimer un compte (administrateur)",
)
def supprimer_utilisateur(
    utilisateur_id: int,
    admin: Annotated[dict[str, Any], Depends(exiger_admin)],
) -> dict[str, str]:
    if utilisateur_id == admin["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas supprimer votre propre compte",
        )
    ligne = db.trouver_par_id(utilisateur_id)
    if ligne is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if ligne["role"] == "admin":
        autres_admins = [
            u for u in db.lister() if u["role"] == "admin" and u["id"] != utilisateur_id
        ]
        if not autres_admins:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de supprimer le dernier administrateur",
            )
    db.supprimer(utilisateur_id)
    # Supprime les tentatives de quiz liées au compte.
    quiz_stockage.supprimer_utilisateur(utilisateur_id)
    # Retire l'individu OWL associé au compte, dans Fuseki et dans le fichier.
    ontologie_sync.supprimer(utilisateur_id)
    export_owl.exporter_sans_erreur()
    return {"statut": "supprime"}


@router.post(
    "/synchroniser-ontologie",
    summary="Recréer les individus OWL de tous les comptes (administrateur)",
)
def resynchroniser_ontologie(
    _: Annotated[dict[str, Any], Depends(exiger_admin)],
) -> dict[str, Any]:
    bilan = ontologie_sync.synchroniser_tous(db.lister())
    return {
        "fuseki": bilan,
        "fichier_owl": export_owl.exporter_sans_erreur(),
    }
