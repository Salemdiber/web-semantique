"""Module « Gestion des parcours d'apprentissage » (`edu:ParcoursApprentissage`).

Fonctionnalités couvertes :
- CRUD complet réservé aux administrateurs (persistance Fuseki + fichier `.owl`
  + ordre séquentiel dans SQLite `parcours_cours_ordre`).
- Agrégats calculés dynamiquement depuis le graphe OWL : durée totale en heures,
  compétences visées, prérequis, formateurs impliqués, certifications liées.
- Analyse de cohérence pédagogique (`/analyse`) : détection des ruptures de
  prérequis, incohérences de niveau, parcours vides et tri topologique stable
  (algorithme de Kahn) applicable en un clic.
- Statistiques avancées (`/statistiques`) pour les tableaux de bord ApexCharts.
- Portail étudiant : inscription/désinscription (`/inscription`) avec
  synchronisation réversible de `edu:suitCours`, suivi de progression dérivé
  des évaluations réelles (`/mes-parcours`) et recommandations personnalisées
  (`/recommandations`).
"""
from __future__ import annotations

import heapq
import re
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator

from app import export_owl, ontologie_sync
from app import ontologie_ecriture as ecriture
from app import parcours_stockage as stockage
from app import quiz as quiz_stockage
from app.queries import (
    CERTIFICATIONS,
    COURS_GRAPHE_PARCOURS,
    EVALUATIONS,
    PARCOURS,
    PROPRIETES_PARCOURS,
    evaluations_etudiant,
)
from app.routers.auth import (
    SECURITE,
    exiger_admin,
    utilisateur_courant,
)
from app.routers.education import (
    EDU,
    OWL_NS,
    PREFIX,
    RDFS_NS,
    _annoter_quiz,
    _fusionner_evaluations,
    _individu_etudiant,
    acces_encadrant,
    exec_,
    row_to_certification,
)
from app.security import lire_jeton
from app import db

router = APIRouter(prefix="/education/parcours", tags=["Parcours d'apprentissage"])

RE_SLUG = re.compile(r"^[A-Za-z0-9_-]{1,120}$")
RE_HEURES = re.compile(r"(\d+(?:[.,]\d+)?)")

NIVEAUX_CLASSES: dict[str, tuple[str, str, str]] = {
    # alias -> (OWL class, code court, libellé français)
    "Debutant": ("ParcoursDebutant", "Debutant", "Parcours Débutant"),
    "Débutant": ("ParcoursDebutant", "Debutant", "Parcours Débutant"),
    "ParcoursDebutant": ("ParcoursDebutant", "Debutant", "Parcours Débutant"),
    "Parcours Débutant": ("ParcoursDebutant", "Debutant", "Parcours Débutant"),
    "Avance": ("ParcoursAvance", "Avance", "Parcours Avancé"),
    "Avancé": ("ParcoursAvance", "Avance", "Parcours Avancé"),
    "ParcoursAvance": ("ParcoursAvance", "Avance", "Parcours Avancé"),
    "Parcours Avancé": ("ParcoursAvance", "Avance", "Parcours Avancé"),
}

STATUTS_VALIDES = ("brouillon", "publie")


# --------------------------------------------------- dépendances d'accès ---
def utilisateur_optionnel(
    identifiants: Annotated[
        HTTPAuthorizationCredentials | None, Depends(SECURITE)
    ] = None,
) -> dict[str, Any] | None:
    """Retourne le profil connecté si un jeton Bearer valide est fourni, sinon None."""
    if identifiants is None or identifiants.scheme.lower() != "bearer":
        return None
    charge = lire_jeton(identifiants.credentials)
    if not charge:
        return None
    ligne = db.trouver_par_id(int(charge.get("sub", 0)))
    if ligne is None or not ligne["actif"]:
        return None
    return {
        "id": int(ligne["id"]),
        "nom": str(ligne["nom"]),
        "email": str(ligne["email"]),
        "role": str(ligne["role"]),
        "actif": bool(ligne["actif"]),
    }


def exiger_etudiant(
    utilisateur: Annotated[dict[str, Any], Depends(utilisateur_courant)],
) -> dict[str, Any]:
    if utilisateur.get("role") != "etudiant":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Action réservée aux étudiants connectés.",
        )
    return utilisateur


# --------------------------------------------------------- schémas Pydantic ---
def _normaliser_niveau(valeur: str) -> str:
    cle = (valeur or "").strip()
    if cle not in NIVEAUX_CLASSES:
        raise ValueError(
            "Niveau invalide : choisissez « Debutant » (ParcoursDebutant) "
            "ou « Avance » (ParcoursAvance)."
        )
    return NIVEAUX_CLASSES[cle][0]


def _valider_slug(identifiant: str, libelle: str = "Identifiant") -> str:
    local = ecriture.nom_local(identifiant)
    if not local or not RE_SLUG.match(local):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"{libelle} invalide (« {identifiant} ») : seuls les lettres, "
                "chiffres, tirets et underscores sont autorisés."
            ),
        )
    return local


class ParcoursEntree(BaseModel):
    nom: str = Field(
        min_length=2,
        max_length=140,
        examples=["Parcours Développement Web Full-Stack"],
    )
    description: str | None = Field(
        default=None,
        max_length=1200,
        examples=["Apprentissage progressif de JavaScript jusqu'au framework Angular."],
    )
    objectif: str | None = Field(
        default=None,
        max_length=600,
        examples=["Concevoir des applications web SPA modulaires."],
    )
    niveau: str = Field(
        default="Debutant",
        description="Niveau sémantique (Debutant / ParcoursDebutant ou Avance / ParcoursAvance)",
        examples=["Debutant"],
    )
    statut: Literal["brouillon", "publie"] = Field(
        default="brouillon",
        examples=["publie"],
    )
    cours_ids: list[str] | None = Field(
        default=None,
        description="Liste ordonnée optionnelle des identifiants locaux de cours OWL",
        examples=[["JavaScript", "Angular"]],
    )

    @field_validator("nom")
    @classmethod
    def nom_propre(cls, v: str) -> str:
        propre = v.strip()
        if len(propre) < 2:
            raise ValueError("Le nom du parcours doit contenir au moins 2 caractères.")
        return propre

    @field_validator("niveau")
    @classmethod
    def niveau_valide(cls, v: str) -> str:
        return _normaliser_niveau(v)


class ParcoursCoursOrdreEntree(BaseModel):
    cours_ids: list[str] = Field(
        default_factory=list,
        description="Liste ordonnée complète des identifiants de cours du parcours",
        examples=[["Python", "JavaScript", "Angular"]],
    )


class ParcoursAjoutCoursEntree(BaseModel):
    cours_id: str = Field(min_length=1, max_length=120, examples=["Angular"])
    position: int | None = Field(
        default=None,
        ge=1,
        description="Position d'insertion (1 = début, None = fin du parcours)",
    )


# ------------------------------------------- utilitaires graphe & agrégats ---
def _extraire_heures(duree_texte: str | None) -> float:
    """Extrait le nombre d'heures depuis un littéral libre (ex. `30 heures` -> 30.0)."""
    if not duree_texte:
        return 0.0
    texte = duree_texte.lower()
    match = RE_HEURES.search(texte)
    if not match:
        return 0.0
    try:
        valeur = float(match.group(1).replace(",", "."))
    except ValueError:
        return 0.0
    if "semaine" in texte:
        return valeur * 10.0
    if "mois" in texte:
        return valeur * 40.0
    if "an" in texte:
        return valeur * 300.0
    return valeur


def _formater_heures(heures: float) -> str:
    if heures <= 0:
        return "0 heure"
    entier = int(heures) if heures == int(heures) else round(heures, 1)
    unite = "heure" if entier == 1 else "heures"
    return f"{entier} {unite}"


def _catalogue_cours_graphe() -> dict[str, dict[str, Any]]:
    """Charge et fusionne toutes les métadonnées des cours depuis Fuseki."""
    rows = exec_(COURS_GRAPHE_PARCOURS)
    cours_map: dict[str, dict[str, Any]] = {}

    for r in rows:
        cid = ecriture.nom_local(r.get("cours") or "")
        if not cid:
            continue
        entree = cours_map.get(cid)
        if entree is None:
            duree_brute = r.get("duree") or "Durée non précisée"
            entree = {
                "id": cid,
                "nom": r.get("nom") or cid,
                "duree": duree_brute,
                "dureeHeures": _extraire_heures(r.get("duree")),
                "description": r.get("description"),
                "type": r.get("typeLabel") or "Cours",
                "prerequisMap": {},
                "competencesMap": {},
                "formateursMap": {},
            }
            cours_map[cid] = entree
        elif r.get("typeLabel") and entree["type"] == "Cours":
            entree["type"] = r.get("typeLabel")

        pre_id = ecriture.nom_local(r.get("pre") or "")
        if pre_id:
            pre_obj = entree["prerequisMap"].setdefault(
                pre_id,
                {
                    "id": pre_id,
                    "description": r.get("prerequisNom") or pre_id,
                    "niveauRequis": r.get("prerequisNiveau"),
                    "competenceId": None,
                    "competenceNom": None,
                    "competenceNiveau": None,
                },
            )
            pre_comp_id = ecriture.nom_local(r.get("preComp") or "")
            if pre_comp_id:
                pre_obj["competenceId"] = pre_comp_id
                pre_obj["competenceNom"] = r.get("preCompNom") or pre_comp_id
                pre_obj["competenceNiveau"] = r.get("preCompNiveau")

        comp_id = ecriture.nom_local(r.get("comp") or "")
        if comp_id:
            entree["competencesMap"][comp_id] = {
                "id": comp_id,
                "nom": r.get("compNom") or comp_id,
                "niveau": r.get("compNiveau"),
            }

        form_id = ecriture.nom_local(r.get("formateur") or "")
        if form_id:
            entree["formateursMap"][form_id] = {
                "id": form_id,
                "prenom": r.get("formateurNom") or form_id,
                "domaine": r.get("formateurDomaine"),
            }

    # Aplatit les dictionnaires internes en listes triées
    resultat: dict[str, dict[str, Any]] = {}
    for cid, c in cours_map.items():
        prerequis_details = list(c["prerequisMap"].values())
        competences_details = list(c["competencesMap"].values())
        formateurs_details = list(c["formateursMap"].values())
        resultat[cid] = {
            "id": cid,
            "nom": c["nom"],
            "duree": c["duree"],
            "dureeHeures": c["dureeHeures"],
            "description": c["description"],
            "type": c["type"],
            "prerequis": [p["description"] for p in prerequis_details],
            "prerequisDetails": prerequis_details,
            "competences": [k["nom"] for k in competences_details],
            "competencesDetails": competences_details,
            "formateurs": [f["prenom"] for f in formateurs_details],
            "formateursDetails": formateurs_details,
        }
    return resultat


def _lire_parcours_bruts() -> dict[str, dict[str, Any]]:
    """Lit et fusionne tous les individus `ParcoursApprentissage` depuis Fuseki."""
    rows = exec_(PARCOURS)
    parcours_map: dict[str, dict[str, Any]] = {}

    for r in rows:
        pid = ecriture.nom_local(r.get("parcours") or "")
        if not pid:
            continue
        cours_ids_bruts = [
            ecriture.nom_local(x)
            for x in (r.get("coursIds") or "").split("|")
            if x and ecriture.nom_local(x)
        ]
        type_direct = ecriture.nom_local(r.get("typedirect") or "")

        existant = parcours_map.get(pid)
        if existant is None:
            classe_owl = (
                type_direct
                if type_direct in ("ParcoursDebutant", "ParcoursAvance")
                else "ParcoursDebutant"
            )
            _, code_niveau, label_niveau = NIVEAUX_CLASSES.get(
                classe_owl,
                ("ParcoursDebutant", "Debutant", r.get("typeLabel") or "Parcours Débutant"),
            )
            nom = (
                r.get("nom")
                or r.get("label")
                or pid.replace("_", " ")
            )
            statut_brut = (r.get("statut") or "publie").strip().lower()
            statut = statut_brut if statut_brut in STATUTS_VALIDES else "publie"
            parcours_map[pid] = {
                "id": pid,
                "nom": nom,
                "description": r.get("description"),
                "objectif": r.get("objectif"),
                "statut": statut,
                "niveauClasse": classe_owl,
                "niveau": code_niveau,
                "type": r.get("typeLabel") or label_niveau,
                "coursOwlSet": set(cours_ids_bruts),
            }
        else:
            existant["coursOwlSet"].update(cours_ids_bruts)
            if type_direct in ("ParcoursDebutant", "ParcoursAvance"):
                _, code_niveau, label_niveau = NIVEAUX_CLASSES[type_direct]
                existant["niveauClasse"] = type_direct
                existant["niveau"] = code_niveau
                existant["type"] = r.get("typeLabel") or label_niveau
            if not existant.get("nom") and (r.get("nom") or r.get("label")):
                existant["nom"] = r.get("nom") or r.get("label")
            if not existant.get("description") and r.get("description"):
                existant["description"] = r.get("description")
            if not existant.get("objectif") and r.get("objectif"):
                existant["objectif"] = r.get("objectif")

    return parcours_map


def _assembler_parcours(
    brut: dict[str, Any],
    catalogue_cours: dict[str, dict[str, Any]],
    compteurs_inscrits: dict[str, int],
) -> dict[str, Any]:
    """Construit la représentation enrichie d'un parcours avec ses agrégats."""
    pid = brut["id"]
    cours_ordonnes_ids = stockage.reconcilier_ordre(
        pid, list(brut["coursOwlSet"])
    )

    etapes: list[dict[str, Any]] = []
    duree_totale = 0.0
    competences_vues: dict[str, dict[str, Any]] = {}
    prerequis_vus: dict[str, dict[str, Any]] = {}
    formateurs_vus: dict[str, dict[str, Any]] = {}

    for pos, cid in enumerate(cours_ordonnes_ids, start=1):
        meta = catalogue_cours.get(cid)
        if meta is None:
            etapes.append(
                {
                    "position": pos,
                    "id": cid,
                    "nom": cid,
                    "duree": "Durée non précisée",
                    "dureeHeures": 0.0,
                    "description": None,
                    "type": "Cours",
                    "prerequis": [],
                    "prerequisDetails": [],
                    "competences": [],
                    "competencesDetails": [],
                    "formateurs": [],
                    "introuvable": True,
                }
            )
            continue

        duree_totale += float(meta["dureeHeures"])
        for comp in meta["competencesDetails"]:
            competences_vues[comp["id"]] = comp
        for pre in meta["prerequisDetails"]:
            prerequis_vus[pre["id"]] = pre
        for form in meta["formateursDetails"]:
            formateurs_vus[form["id"]] = form

        etapes.append(
            {
                "position": pos,
                "id": meta["id"],
                "nom": meta["nom"],
                "duree": meta["duree"],
                "dureeHeures": meta["dureeHeures"],
                "description": meta["description"],
                "type": meta["type"],
                "prerequis": meta["prerequis"],
                "prerequisDetails": meta["prerequisDetails"],
                "competences": meta["competences"],
                "competencesDetails": meta["competencesDetails"],
                "formateurs": meta["formateurs"],
                "introuvable": False,
            }
        )

    # Prérequis d'entrée = prérequis dont la compétence nécessaire n'est couverte
    # par aucun cours situé plus tôt dans le parcours.
    comp_acquises_avant: set[str] = set()
    prerequis_entree: list[str] = []
    for etape in etapes:
        for pre in etape.get("prerequisDetails", []):
            req_comp = pre.get("competenceId")
            desc = pre.get("description") or pre["id"]
            if not req_comp or req_comp not in comp_acquises_avant:
                if desc not in prerequis_entree:
                    prerequis_entree.append(desc)
        for comp in etape.get("competencesDetails", []):
            comp_acquises_avant.add(comp["id"])

    return {
        "id": pid,
        "nom": brut["nom"],
        "description": brut.get("description"),
        "objectif": brut.get("objectif"),
        "statut": brut["statut"],
        "niveau": brut["niveau"],
        "niveauClasse": brut["niveauClasse"],
        "type": brut["type"],  # rétrocompatibilité avec l'ancien format
        "cours": [e["nom"] for e in etapes],  # rétrocompatibilité
        "coursIds": cours_ordonnes_ids,
        "etapes": etapes,
        "nombreCours": len(etapes),
        "dureeHeures": duree_totale,
        "dureeTotale": _formater_heures(duree_totale),
        "competences": [c["nom"] for c in competences_vues.values()],
        "competencesDetails": list(competences_vues.values()),
        "prerequis": [p["description"] for p in prerequis_vus.values()],
        "prerequisEntree": prerequis_entree,
        "formateurs": [f["prenom"] for f in formateurs_vus.values()],
        "nombreInscrits": compteurs_inscrits.get(pid, 0),
    }


# ----------------------------------------- progression dérivée étudiant ---
def _etat_etudiant_graphe(utilisateur: dict[str, Any]) -> dict[str, Any]:
    """Récupère les cours suivis (`suitCours`), évaluations et certifications
    d'un étudiant depuis Fuseki + SQLite.
    """
    uid = int(utilisateur["id"])
    individu = _individu_etudiant(utilisateur)

    rows_suivis = exec_(
        PREFIX
        + f"SELECT ?crs WHERE {{ <{EDU}{individu}> edu:suitCours ?crs }}"
    )
    cours_suivis = {
        ecriture.nom_local(r.get("crs") or "")
        for r in rows_suivis
        if r.get("crs")
    }

    rows_niveau = exec_(
        PREFIX
        + f"SELECT ?niv WHERE {{ <{EDU}{individu}> edu:niveau ?niv }} LIMIT 1"
    )
    niveau_etudiant = rows_niveau[0].get("niv") if rows_niveau else None

    rows_certs = exec_(
        PREFIX
        + f"""
        SELECT ?cert ?nom ?comp ?compNom WHERE {{
            <{EDU}{individu}> edu:obtientCertification ?cert .
            OPTIONAL {{ ?cert edu:nomCertification ?nom }}
            OPTIONAL {{
                ?cert edu:certifieCompetence ?comp .
                OPTIONAL {{ ?comp edu:nomCompetence ?compNom }}
            }}
        }}
        """
    )
    certifications_obtenues: list[str] = []
    competences_certifiees: set[str] = set()
    for r in rows_certs:
        nom_c = r.get("nom") or ecriture.nom_local(r.get("cert") or "")
        if nom_c and nom_c not in certifications_obtenues:
            certifications_obtenues.append(nom_c)
        if r.get("comp"):
            competences_certifiees.add(ecriture.nom_local(r["comp"]))

    evals = _annoter_quiz(
        _fusionner_evaluations(exec_(evaluations_etudiant(individu))), uid
    )
    evals_par_cours: dict[str, list[dict[str, Any]]] = {}
    competences_validees: set[str] = set(competences_certifiees)

    for ev in evals:
        cid = ecriture.nom_local(ev.get("coursId") or "")
        if cid:
            evals_par_cours.setdefault(cid, []).append(ev)
        if ev.get("reussi") is True and ev.get("competenceId"):
            competences_validees.add(ecriture.nom_local(ev["competenceId"]))

    return {
        "utilisateurId": uid,
        "individu": individu,
        "niveau": niveau_etudiant,
        "coursSuivis": cours_suivis,
        "evaluationsParCours": evals_par_cours,
        "certificationsObtenues": certifications_obtenues,
        "competencesValidees": competences_validees,
    }


def _calculer_progression_parcours(
    parcours: dict[str, Any],
    etat_etudiant: dict[str, Any],
    est_inscrit: bool = True,
) -> dict[str, Any]:
    """Dérive le statut de chaque cours et le pourcentage global de complétion."""
    cours_suivis: set[str] = etat_etudiant["coursSuivis"]
    evals_par_cours: dict[str, list[dict[str, Any]]] = etat_etudiant[
        "evaluationsParCours"
    ]

    etapes_prog: list[dict[str, Any]] = []
    nb_termines = 0
    nb_en_cours = 0
    prochain_cours: dict[str, Any] | None = None

    for etape in parcours["etapes"]:
        cid = etape["id"]
        evals = evals_par_cours.get(cid, [])

        eval_reussie = next(
            (ev for ev in evals if ev.get("reussi") is True), None
        )
        meilleure_note: float | None = None
        note_max: float = 20.0
        for ev in evals:
            if ev.get("note") is not None:
                if meilleure_note is None or float(ev["note"]) > meilleure_note:
                    meilleure_note = float(ev["note"])
                    note_max = float(ev.get("noteMax") or 20.0)

        if eval_reussie is not None:
            statut_cours = "termine"
            nb_termines += 1
        elif cid in cours_suivis or len(evals) > 0:
            statut_cours = "en_cours"
            nb_en_cours += 1
        else:
            statut_cours = "non_commence"

        enrichie = {
            **etape,
            "statutEtudiant": statut_cours,
            "noteObtenue": meilleure_note,
            "noteMax": note_max if meilleure_note is not None else None,
            "evaluationsCount": len(evals),
        }
        etapes_prog.append(enrichie)

        if statut_cours != "termine" and prochain_cours is None:
            prochain_cours = {
                "id": etape["id"],
                "nom": etape["nom"],
                "position": etape["position"],
                "duree": etape["duree"],
                "statutEtudiant": statut_cours,
            }

    total = len(etapes_prog)
    pourcentage = round((nb_termines / total) * 100) if total > 0 else 0
    est_termine = total > 0 and nb_termines == total

    if est_inscrit:
        nouveau_statut = (
            "termine"
            if est_termine
            else ("en_cours" if (nb_termines > 0 or nb_en_cours > 0) else "inscrit")
        )
        stockage.maj_statut_inscription(
            int(etat_etudiant["utilisateurId"]), parcours["id"], nouveau_statut
        )

    return {
        "pourcentage": pourcentage,
        "coursTermines": nb_termines,
        "coursEnCours": nb_en_cours,
        "nombreCours": total,
        "estTermine": est_termine,
        "prochainCours": prochain_cours,
        "etapes": etapes_prog,
    }


def _certifications_liees_parcours(
    parcours: dict[str, Any],
) -> list[dict[str, Any]]:
    """Retrouve les certifications en lien avec les compétences ou cours du parcours."""
    comp_ids = {c["id"] for c in parcours.get("competencesDetails", [])}
    comp_noms = {c["nom"] for c in parcours.get("competencesDetails", [])}
    certs = [row_to_certification(r) for r in exec_(CERTIFICATIONS)]
    liees: list[dict[str, Any]] = []
    for cert in certs:
        cid_comp = ecriture.nom_local(cert.get("competenceId") or "")
        nom_cert = (cert.get("nom") or "").lower()
        match_comp = (cid_comp and cid_comp in comp_ids) or (
            cert.get("competence") in comp_noms
        )
        match_mot = any(
            mot in nom_cert
            for mot in [k.lower().split()[0] for k in comp_noms if k]
        ) or (
            "web" in nom_cert and "web" in parcours["nom"].lower()
        ) or (
            "data" in nom_cert and "data" in parcours["nom"].lower()
        )
        if match_comp or match_mot:
            liees.append(
                {
                    "id": cert["id"],
                    "nom": cert["nom"],
                    "organisme": cert["organisme"],
                    "type": cert["type"],
                    "competence": cert["competence"],
                    "seuil": cert["seuil"],
                }
            )
    return liees


# ------------------------------------ analyse de cohérence & tri Kahn ------
def _analyser_coherence(
    parcours: dict[str, Any],
    catalogue_cours: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    etapes: list[dict[str, Any]] = parcours["etapes"]
    ordre_actuel = [e["id"] for e in etapes]
    alertes: list[dict[str, Any]] = []

    if len(etapes) == 0:
        alertes.append(
            {
                "type": "parcours_vide",
                "severite": "erreur",
                "message": (
                    "Ce parcours ne contient encore aucun cours. Ajoutez au "
                    "moins un cours avant de pouvoir le publier."
                ),
                "coursId": None,
            }
        )
        return {
            "parcoursId": parcours["id"],
            "nom": parcours["nom"],
            "niveau": parcours["niveau"],
            "valide": False,
            "scoreCoherence": 0,
            "ordreActuel": [],
            "ordreSuggere": [],
            "ordreSuggereNoms": [],
            "ameliorationOrdre": False,
            "prerequisEntree": [],
            "competencesCouvertes": [],
            "alertes": alertes,
            "suggestionsCours": [],
        }

    # Compétences développées par les cours du parcours (index de 1re apparition)
    producteurs_dans_parcours: dict[str, list[tuple[int, str, str]]] = {}
    for idx, etape in enumerate(etapes):
        if etape.get("introuvable"):
            alertes.append(
                {
                    "type": "cours_orphelin",
                    "severite": "erreur",
                    "message": (
                        f"Le cours « {etape['id']} » référencé par ce parcours "
                        "n'existe plus dans l'ontologie."
                    ),
                    "coursId": etape["id"],
                }
            )
        for comp in etape.get("competencesDetails", []):
            producteurs_dans_parcours.setdefault(comp["id"], []).append(
                (idx, etape["id"], etape["nom"])
            )

    competences_vues_avant: set[str] = set()
    prerequis_entree: list[dict[str, Any]] = []
    prerequis_entree_ids: set[str] = set()
    suggestions_cours_map: dict[str, dict[str, Any]] = {}
    nb_prerequis_avances = 0

    for idx, etape in enumerate(etapes):
        for pre in etape.get("prerequisDetails", []):
            niv_req = (pre.get("niveauRequis") or "").lower()
            comp_niv = (pre.get("competenceNiveau") or "").lower()
            if "avanc" in niv_req or "avanc" in comp_niv:
                nb_prerequis_avances += 1

            req_comp_id = pre.get("competenceId")
            req_comp_nom = pre.get("competenceNom") or req_comp_id
            desc_pre = pre.get("description") or pre["id"]

            if req_comp_id:
                if req_comp_id in competences_vues_avant:
                    # Couvert par un cours précédent : ordre cohérent !
                    continue
                producteurs = producteurs_dans_parcours.get(req_comp_id, [])
                plus_tard = [p for p in producteurs if p[0] > idx]
                if plus_tard:
                    noms_prod = ", ".join(f"« {p[2]} »" for p in plus_tard)
                    alertes.append(
                        {
                            "type": "ordre_invalide",
                            "severite": "avertissement",
                            "coursId": etape["id"],
                            "message": (
                                f"Inversion pédagogique : le cours « {etape['nom']} » "
                                f"(étape {idx + 1}) requiert la compétence "
                                f"« {req_comp_nom} » ({desc_pre}), qui est "
                                f"développée plus tard dans le parcours par {noms_prod}."
                            ),
                        }
                    )
                else:
                    # Compétence non développée dans le parcours -> prérequis d'entrée
                    if pre["id"] not in prerequis_entree_ids:
                        prerequis_entree_ids.add(pre["id"])
                        prerequis_entree.append(
                            {
                                "id": pre["id"],
                                "description": desc_pre,
                                "competence": req_comp_nom,
                                "pourCours": etape["nom"],
                            }
                        )
                    # Chercher dans le catalogue global un cours développant cette compétence
                    candidats = [
                        c
                        for c in catalogue_cours.values()
                        if c["id"] not in ordre_actuel
                        and any(
                            k["id"] == req_comp_id
                            for k in c["competencesDetails"]
                        )
                    ]
                    if candidats:
                        for cand in candidats:
                            suggestions_cours_map[cand["id"]] = {
                                "coursId": cand["id"],
                                "coursNom": cand["nom"],
                                "duree": cand["duree"],
                                "raison": (
                                    f"Couvre la compétence prérequise « {req_comp_nom} » "
                                    f"nécessaire avant « {etape['nom']} »."
                                ),
                            }
                        alertes.append(
                            {
                                "type": "lacune_competence",
                                "severite": "info",
                                "coursId": etape["id"],
                                "message": (
                                    f"Prérequis externe : « {etape['nom']} » demande "
                                    f"la compétence « {req_comp_nom} » ({desc_pre}). "
                                    f"Celle-ci constitue un prérequis d'entrée du parcours "
                                    f"(ou ajoutez {', '.join('« ' + c['nom'] + ' »' for c in candidats)} en amont)."
                                ),
                            }
                        )
            else:
                if pre["id"] not in prerequis_entree_ids:
                    prerequis_entree_ids.add(pre["id"])
                    prerequis_entree.append(
                        {
                            "id": pre["id"],
                            "description": desc_pre,
                            "competence": None,
                            "pourCours": etape["nom"],
                        }
                    )

        for comp in etape.get("competencesDetails", []):
            competences_vues_avant.add(comp["id"])

    # Cohérence du niveau OWL (ParcoursDebutant vs ParcoursAvance)
    comp_avancees = [
        c["nom"]
        for c in parcours.get("competencesDetails", [])
        if "avanc" in (c.get("niveau") or "").lower()
    ]
    if parcours["niveau"] == "Debutant" and nb_prerequis_avances >= 2:
        alertes.append(
            {
                "type": "coherence_niveau",
                "severite": "avertissement",
                "coursId": None,
                "message": (
                    "Ce parcours est typé « Parcours Débutant » mais comporte "
                    f"{nb_prerequis_avances} prérequis de niveau avancé. "
                    "Envisagez le niveau « Parcours Avancé » ou l'ajout de cours d'initiation."
                ),
            }
        )
    elif (
        parcours["niveau"] == "Avance"
        and len(etapes) <= 1
        and not comp_avancees
    ):
        alertes.append(
            {
                "type": "coherence_niveau",
                "severite": "info",
                "coursId": None,
                "message": (
                    "Ce parcours est typé « Parcours Avancé » mais ne contient "
                    "qu'un seul cours sans compétence de niveau avancé."
                ),
            }
        )

    # Tri topologique stable (algorithme de Kahn avec conservation de l'ordre relatif)
    n = len(etapes)
    adj: dict[int, set[int]] = {i: set() for i in range(n)}
    indegree: dict[int, int] = {i: 0 for i in range(n)}

    for i in range(n):
        comps_i = {c["id"] for c in etapes[i].get("competencesDetails", [])}
        if not comps_i:
            continue
        for j in range(n):
            if i == j:
                continue
            reqs_j = {
                p["competenceId"]
                for p in etapes[j].get("prerequisDetails", [])
                if p.get("competenceId")
            }
            if comps_i & reqs_j and j not in adj[i]:
                adj[i].add(j)
                indegree[j] += 1

    tas: list[int] = [i for i in range(n) if indegree[i] == 0]
    heapq.heapify(tas)
    indices_tries: list[int] = []

    while tas:
        u = heapq.heappop(tas)
        indices_tries.append(u)
        for v in sorted(adj[u]):
            indegree[v] -= 1
            if indegree[v] == 0:
                heapq.heappush(tas, v)

    # En cas de cycle éventuel dans les données, conserver les éléments restants dans l'ordre initial
    if len(indices_tries) < n:
        restants = [i for i in range(n) if i not in indices_tries]
        indices_tries.extend(restants)

    ordre_suggere = [etapes[i]["id"] for i in indices_tries]
    ordre_suggere_noms = [etapes[i]["nom"] for i in indices_tries]
    amelioration_ordre = ordre_suggere != ordre_actuel

    nb_erreurs = sum(1 for a in alertes if a["severite"] == "erreur")
    nb_avert = sum(1 for a in alertes if a["severite"] == "avertissement")
    score = max(0, 100 - nb_erreurs * 50 - nb_avert * 25)

    return {
        "parcoursId": parcours["id"],
        "nom": parcours["nom"],
        "niveau": parcours["niveau"],
        "valide": nb_erreurs == 0 and nb_avert == 0,
        "scoreCoherence": score,
        "ordreActuel": ordre_actuel,
        "ordreActuelNoms": [e["nom"] for e in etapes],
        "ordreSuggere": ordre_suggere,
        "ordreSuggereNoms": ordre_suggere_noms,
        "ameliorationOrdre": amelioration_ordre,
        "prerequisEntree": prerequis_entree,
        "competencesCouvertes": parcours["competences"],
        "alertes": alertes,
        "suggestionsCours": list(suggestions_cours_map.values()),
    }


# ----------------------------------------- écriture Fuseki + export OWL ----
def _executer_sparql(mise_a_jour: str) -> None:
    try:
        ecriture.executer(mise_a_jour)
    except ecriture.EcritureError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc


def _persister_tous_les_parcours_owl() -> None:
    """Exporte l'état courant de tous les parcours de Fuseki vers le fichier `.owl`."""
    bruts = _lire_parcours_bruts()
    liste_export: list[dict[str, Any]] = []
    for pid in sorted(bruts.keys()):
        b = bruts[pid]
        ordonnes = stockage.reconcilier_ordre(pid, list(b["coursOwlSet"]))
        liste_export.append(
            {
                "id": pid,
                "nom": b["nom"],
                "description": b.get("description"),
                "objectif": b.get("objectif"),
                "statut": b["statut"],
                "niveauClasse": b["niveauClasse"],
                "coursIds": ordonnes,
            }
        )
    export_owl.exporter_parcours_sans_erreur(liste_export)


def _valider_et_nettoyer_cours_ids(
    cours_ids: list[str],
    catalogue_cours: dict[str, dict[str, Any]],
    statut_cible: str,
) -> list[str]:
    propres: list[str] = []
    vus: set[str] = set()
    for brut in cours_ids:
        cid = _valider_slug(brut, "Identifiant de cours")
        if cid in vus:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le cours « {cid} » apparaît plusieurs fois dans le parcours.",
            )
        if cid not in catalogue_cours:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cours introuvable dans l'ontologie : « {cid} ».",
            )
        vus.add(cid)
        propres.append(cid)

    if statut_cible == "publie" and len(propres) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Impossible de publier un parcours sans aucun cours : "
                "ajoutez au moins un cours ou enregistrez-le en brouillon."
            ),
        )
    return propres


def _verifier_unicite_nom(nom: str, exclure_id: str | None = None) -> None:
    cible = nom.strip().lower()
    for pid, brut in _lire_parcours_bruts().items():
        if exclure_id and pid == exclure_id:
            continue
        if (brut.get("nom") or "").strip().lower() == cible:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Un parcours portant le nom « {nom.strip()} » existe déjà.",
            )


def _ecrire_parcours_fuseki(
    identifiant: str,
    nom: str,
    description: str | None,
    objectif: str | None,
    classe_owl: str,
    statut_parcours: str,
    cours_ids: list[str],
) -> None:
    sujet = f"<{EDU}{identifiant}>"
    morceaux = [
        f"{sujet} a <{OWL_NS}NamedIndividual> , <{EDU}{classe_owl}>",
        f'    <{RDFS_NS}label> "{ecriture.echapper(nom)}"@fr',
        f'    <{EDU}nomParcours> "{ecriture.echapper(nom)}"',
        f'    <{EDU}statutParcours> "{ecriture.echapper(statut_parcours)}"',
    ]
    if description and description.strip():
        morceaux.append(
            f'    <{EDU}descriptionParcours> "{ecriture.echapper(description.strip())}"'
        )
    if objectif and objectif.strip():
        morceaux.append(
            f'    <{EDU}objectifParcours> "{ecriture.echapper(objectif.strip())}"'
        )
    for cid in cours_ids:
        morceaux.append(f"    <{EDU}contientCoursParcours> <{EDU}{cid}>")

    triplets = " ;\n".join(morceaux) + " ."
    _executer_sparql(
        f"DELETE WHERE {{ {sujet} ?p ?o . }} ;\n"
        f"INSERT DATA {{\n{triplets}\n}}"
    )
    stockage.enregistrer_ordre(identifiant, cours_ids)
    _persister_tous_les_parcours_owl()


def _synchroniser_suit_cours_fuseki_et_owl(individu: str, ajouter_cid: str | None = None, retirer_cids: list[str] | None = None) -> None:
    instructions: list[str] = []
    if retirer_cids:
        for cid in retirer_cids:
            instructions.append(
                f"DELETE DATA {{ <{EDU}{individu}> <{EDU}suitCours> <{EDU}{cid}> . }}"
            )
    if ajouter_cid:
        instructions.append(
            f"INSERT DATA {{ <{EDU}{individu}> <{EDU}suitCours> <{EDU}{ajouter_cid}> . }}"
        )
    if instructions:
        _executer_sparql(" ;\n".join(instructions))

    rows = exec_(
        PREFIX + f"SELECT ?c WHERE {{ <{EDU}{individu}> edu:suitCours ?c }}"
    )
    actuels = [
        ecriture.nom_local(r.get("c") or "") for r in rows if r.get("c")
    ]
    export_owl.maj_suit_cours_individu_sans_erreur(individu, actuels)


# ============================================================ ROUTES API ===
# Attention à l'ordre : les chemins fixes (/mes-parcours, /recommandations,
# /statistiques, /proprietes-owl) DOIVENT précéder /{parcours_id}.


@router.get(
    "",
    summary="Lister les parcours d'apprentissage (filtres, recherche, tri, agrégats)",
)
def lister_parcours(
    niveau: str | None = Query(
        default=None, description="Filtrer par niveau (Debutant ou Avance)"
    ),
    q: str | None = Query(
        default=None, description="Recherche plein texte (nom, description, objectif, cours)"
    ),
    competence: str | None = Query(
        default=None, description="Filtrer par compétence visée (nom ou identifiant)"
    ),
    statut_filtre: str | None = Query(
        default=None,
        alias="statut",
        description="Filtrer par statut (brouillon | publie, réservé admin/formateur)",
    ),
    tri: Literal["nom", "duree", "cours", "inscrits"] = Query(default="nom"),
    ordre: Literal["asc", "desc"] = Query(default="asc"),
    limite: int | None = Query(default=None, ge=1, le=200),
    decalage: int = Query(default=0, ge=0),
    utilisateur: Annotated[
        dict[str, Any] | None, Depends(utilisateur_optionnel)
    ] = None,
) -> list[dict[str, Any]]:
    est_encadrant = bool(
        utilisateur and utilisateur.get("role") in ("admin", "formateur")
    )
    est_etudiant = bool(utilisateur and utilisateur.get("role") == "etudiant")

    catalogue = _catalogue_cours_graphe()
    compteurs = stockage.compter_inscrits_par_parcours()
    bruts = _lire_parcours_bruts()

    inscriptions_map: dict[str, dict[str, Any]] = {}
    etat_etud: dict[str, Any] | None = None
    if est_etudiant and utilisateur:
        for ins in stockage.inscriptions_utilisateur(int(utilisateur["id"])):
            inscriptions_map[ins["parcoursId"]] = ins
        etat_etud = _etat_etudiant_graphe(utilisateur)

    resultats: list[dict[str, Any]] = []
    for pid, brut in bruts.items():
        # Visiteurs et étudiants ne voient jamais les brouillons
        if not est_encadrant and brut["statut"] != "publie":
            continue
        if statut_filtre and brut["statut"] != statut_filtre.strip().lower():
            continue

        fiche = _assembler_parcours(brut, catalogue, compteurs)

        if niveau:
            try:
                classe_attendue = _normaliser_niveau(niveau)
                if fiche["niveauClasse"] != classe_attendue:
                    continue
            except ValueError:
                continue

        if competence:
            cible_comp = competence.strip().lower()
            if not any(
                cible_comp in c["nom"].lower() or cible_comp == c["id"].lower()
                for c in fiche["competencesDetails"]
            ):
                continue

        if q and q.strip():
            terme = q.strip().lower()
            texte_complet = " ".join(
                [
                    fiche["nom"] or "",
                    fiche.get("description") or "",
                    fiche.get("objectif") or "",
                    " ".join(fiche["cours"]),
                    " ".join(fiche["competences"]),
                ]
            ).lower()
            if terme not in texte_complet:
                continue

        if est_etudiant and etat_etud is not None:
            est_ins = pid in inscriptions_map
            prog = (
                _calculer_progression_parcours(fiche, etat_etud, est_ins)
                if est_ins
                else None
            )
            fiche["estInscrit"] = est_ins
            fiche["progression"] = prog["pourcentage"] if prog else None
            fiche["prochainCours"] = prog["prochainCours"] if prog else None
            fiche["estTermine"] = prog["estTermine"] if prog else False
        else:
            fiche["estInscrit"] = False
            fiche["progression"] = None
            fiche["prochainCours"] = None
            fiche["estTermine"] = False

        resultats.append(fiche)

    cles_tri = {
        "nom": lambda p: (p["nom"] or "").lower(),
        "duree": lambda p: float(p["dureeHeures"]),
        "cours": lambda p: int(p["nombreCours"]),
        "inscrits": lambda p: int(p["nombreInscrits"]),
    }
    resultats.sort(key=cles_tri[tri], reverse=(ordre == "desc"))

    if limite is not None:
        return resultats[decalage : decalage + limite]
    return resultats[decalage:] if decalage else resultats


@router.get(
    "/mes-parcours",
    summary="Parcours auxquels l'étudiant connecté est inscrit, avec progression dérivée",
)
def mes_parcours(
    utilisateur: Annotated[dict[str, Any], Depends(exiger_etudiant)],
) -> list[dict[str, Any]]:
    uid = int(utilisateur["id"])
    inscriptions = stockage.inscriptions_utilisateur(uid)
    if not inscriptions:
        return []

    catalogue = _catalogue_cours_graphe()
    compteurs = stockage.compter_inscrits_par_parcours()
    bruts = _lire_parcours_bruts()
    etat_etud = _etat_etudiant_graphe(utilisateur)

    fiches: list[dict[str, Any]] = []
    for ins in inscriptions:
        pid = ins["parcoursId"]
        brut = bruts.get(pid)
        if not brut or brut["statut"] != "publie":
            continue
        fiche = _assembler_parcours(brut, catalogue, compteurs)
        prog = _calculer_progression_parcours(fiche, etat_etud, True)
        fiches.append(
            {
                **fiche,
                "estInscrit": True,
                "dateInscription": ins["creeLe"],
                "statutInscription": (
                    "termine" if prog["estTermine"] else ins["statut"]
                ),
                "progression": prog["pourcentage"],
                "coursTermines": prog["coursTermines"],
                "coursEnCours": prog["coursEnCours"],
                "estTermine": prog["estTermine"],
                "prochainCours": prog["prochainCours"],
                "etapes": prog["etapes"],
                "certificationsLiees": _certifications_liees_parcours(fiche),
            }
        )
    return fiches


@router.get(
    "/recommandations",
    summary="Suggestions personnalisées de parcours pour l'étudiant connecté",
)
def recommandations_parcours(
    utilisateur: Annotated[dict[str, Any], Depends(exiger_etudiant)],
) -> list[dict[str, Any]]:
    uid = int(utilisateur["id"])
    deja_inscrits = {
        ins["parcoursId"] for ins in stockage.inscriptions_utilisateur(uid)
    }

    catalogue = _catalogue_cours_graphe()
    compteurs = stockage.compter_inscrits_par_parcours()
    bruts = _lire_parcours_bruts()
    etat_etud = _etat_etudiant_graphe(utilisateur)

    comp_validees: set[str] = etat_etud["competencesValidees"]
    cours_suivis: set[str] = etat_etud["coursSuivis"]
    niveau_texte = (etat_etud.get("niveau") or "").lower()
    profil_avance = (
        any(m in niveau_texte for m in ("4", "5", "master", "avanc", "ingénieur"))
        or len(comp_validees) >= 1
    )

    suggestions: list[dict[str, Any]] = []
    for pid, brut in bruts.items():
        if pid in deja_inscrits or brut["statut"] != "publie":
            continue
        fiche = _assembler_parcours(brut, catalogue, compteurs)
        if fiche["nombreCours"] == 0:
            continue

        prog = _calculer_progression_parcours(fiche, etat_etud, False)
        if prog["estTermine"]:
            continue

        score = 50
        raisons: list[str] = []

        # 1. Adéquation au niveau de l'étudiant
        if fiche["niveau"] == "Avance" and profil_avance:
            score += 25
            raisons.append(
                "Adapté à votre profil avancé et à vos acquis déjà validés"
            )
        elif fiche["niveau"] == "Debutant" and not profil_avance:
            score += 25
            raisons.append(
                "Idéal pour démarrer progressivement sans prérequis complexe"
            )
        elif fiche["niveau"] == "Debutant":
            score += 10

        # 2. Compétences prérequises déjà validées
        reqs_parcours = {
            p["competenceId"]
            for e in fiche["etapes"]
            for p in e.get("prerequisDetails", [])
            if p.get("competenceId")
        }
        reqs_couverts = reqs_parcours & comp_validees
        if reqs_couverts:
            score += 20
            raisons.append(
                "Vos compétences validées couvrent les prérequis clés de ce parcours"
            )
        elif not reqs_parcours:
            score += 10
            raisons.append("Accessible immédiatement sans compétence préalable bloquante")

        # 3. Nouvelles compétences à développer
        comps_cibles = [
            c["nom"]
            for c in fiche["competencesDetails"]
            if c["id"] not in comp_validees
        ]
        if comps_cibles:
            score += 15 * len(comps_cibles)
            raisons.append(
                f"Développe de nouvelles compétences : {', '.join(comps_cibles)}"
            )

        # 4. Cours déjà entamés dans ce parcours
        en_commun = cours_suivis & set(fiche["coursIds"])
        if en_commun or prog["coursTermines"] > 0:
            score += 20
            raisons.append(
                f"Capitalise sur {len(en_commun) or prog['coursTermines']} cours que vous suivez déjà"
            )

        # 5. Certifications associées
        certs_liees = _certifications_liees_parcours(fiche)
        certs_non_obtenues = [
            c["nom"]
            for c in certs_liees
            if c["nom"] not in etat_etud["certificationsObtenues"]
        ]
        if certs_non_obtenues:
            score += 10
            raisons.append(
                f"Prépare vers : {', '.join(certs_non_obtenues[:2])}"
            )

        if not raisons:
            raisons.append(
                f"Parcours structuré de {fiche['nombreCours']} cours ({fiche['dureeTotale']})"
            )

        suggestions.append(
            {
                **fiche,
                "scorePertinence": min(score, 99),
                "raisons": raisons,
                "competencesNouvelles": comps_cibles,
                "prerequisCouverts": len(reqs_parcours - comp_validees) == 0,
                "progression": prog["pourcentage"],
            }
        )

    suggestions.sort(key=lambda s: s["scorePertinence"], reverse=True)
    return suggestions


@router.get(
    "/statistiques",
    summary="Indicateurs analytiques sur les parcours d'apprentissage (admin/formateur)",
)
def statistiques_parcours(
    _: Annotated[dict[str, Any], Depends(acces_encadrant)],
) -> dict[str, Any]:
    catalogue = _catalogue_cours_graphe()
    compteurs = stockage.compter_inscrits_par_parcours()
    bruts = _lire_parcours_bruts()
    inscriptions = stockage.toutes_inscriptions()

    fiches = [
        _assembler_parcours(b, catalogue, compteurs) for b in bruts.values()
    ]
    total = len(fiches)
    par_niveau = {
        "Debutant": sum(1 for f in fiches if f["niveau"] == "Debutant"),
        "Avance": sum(1 for f in fiches if f["niveau"] == "Avance"),
    }
    par_statut = {
        "publie": sum(1 for f in fiches if f["statut"] == "publie"),
        "brouillon": sum(1 for f in fiches if f["statut"] == "brouillon"),
    }

    moyenne_cours = (
        round(sum(f["nombreCours"] for f in fiches) / total, 1) if total else 0.0
    )
    moyenne_heures = (
        round(sum(f["dureeHeures"] for f in fiches) / total, 1) if total else 0.0
    )

    # Taux de complétion par parcours et global
    cache_etats: dict[int, dict[str, Any]] = {}
    progressions_par_parcours: dict[str, list[int]] = {}
    termines_global = 0

    for ins in inscriptions:
        uid = ins["utilisateurId"]
        pid = ins["parcoursId"]
        fiche_cible = next((f for f in fiches if f["id"] == pid), None)
        if fiche_cible is None:
            continue
        if uid not in cache_etats:
            ligne_u = db.trouver_par_id(uid)
            if ligne_u is None:
                continue
            cache_etats[uid] = _etat_etudiant_graphe(dict(ligne_u))
        prog = _calculer_progression_parcours(
            fiche_cible, cache_etats[uid], True
        )
        progressions_par_parcours.setdefault(pid, []).append(
            prog["pourcentage"]
        )
        if prog["estTermine"]:
            termines_global += 1

    tous_pcts = [p for lst in progressions_par_parcours.values() for p in lst]
    progression_moyenne = (
        round(sum(tous_pcts) / len(tous_pcts), 1) if tous_pcts else 0.0
    )
    taux_completion = (
        round((termines_global / len(tous_pcts)) * 100, 1)
        if tous_pcts
        else 0.0
    )

    # Cours réutilisés dans plusieurs parcours
    usage_cours: dict[str, list[str]] = {}
    for f in fiches:
        for cid in f["coursIds"]:
            usage_cours.setdefault(cid, []).append(f["nom"])

    cours_partages = [
        {
            "coursId": cid,
            "coursNom": catalogue.get(cid, {}).get("nom", cid),
            "nombreParcours": len(noms_p),
            "parcours": noms_p,
        }
        for cid, noms_p in sorted(
            usage_cours.items(), key=lambda x: len(x[1]), reverse=True
        )
    ]

    top_parcours = [
        {
            "id": f["id"],
            "nom": f["nom"],
            "niveau": f["niveau"],
            "statut": f["statut"],
            "nombreInscrits": f["nombreInscrits"],
            "nombreCours": f["nombreCours"],
            "dureeHeures": f["dureeHeures"],
            "progressionMoyenne": (
                round(
                    sum(progressions_par_parcours[f["id"]])
                    / len(progressions_par_parcours[f["id"]]),
                    1,
                )
                if progressions_par_parcours.get(f["id"])
                else 0.0
            ),
        }
        for f in sorted(
            fiches, key=lambda x: x["nombreInscrits"], reverse=True
        )
    ]

    return {
        "totalParcours": total,
        "parNiveau": par_niveau,
        "parStatut": par_statut,
        "moyenneCoursParParcours": moyenne_cours,
        "moyenneHeuresParParcours": moyenne_heures,
        "totalInscriptions": len(inscriptions),
        "progressionMoyenne": progression_moyenne,
        "tauxCompletionGlobal": taux_completion,
        "topParcours": top_parcours,
        "coursPartages": cours_partages,
    }


@router.get(
    "/proprietes-owl",
    summary="Propriétés OWL déclarées sur la classe ParcoursApprentissage",
)
def proprietes_owl_parcours() -> list[dict[str, Any]]:
    rows = exec_(PROPRIETES_PARCOURS)
    return [
        {
            "id": ecriture.nom_local(r.get("propriete") or ""),
            "type": ecriture.nom_local(r.get("typeProp") or ""),
            "label": r.get("label"),
            "domaine": ecriture.nom_local(r.get("domaine") or ""),
            "portee": ecriture.nom_local(r.get("portee") or ""),
        }
        for r in rows
    ]


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Créer un nouveau parcours d'apprentissage (administrateur)",
)
def creer_parcours(
    donnees: ParcoursEntree,
    _: Annotated[dict[str, Any], Depends(exiger_admin)],
) -> dict[str, Any]:
    _verifier_unicite_nom(donnees.nom)
    catalogue = _catalogue_cours_graphe()
    cours_ids = _valider_et_nettoyer_cours_ids(
        donnees.cours_ids or [], catalogue, donnees.statut
    )
    identifiant = ecriture.generer_id("Parcours", donnees.nom)

    _ecrire_parcours_fuseki(
        identifiant=identifiant,
        nom=donnees.nom,
        description=donnees.description,
        objectif=donnees.objectif,
        classe_owl=donnees.niveau,
        statut_parcours=donnees.statut,
        cours_ids=cours_ids,
    )

    bruts = _lire_parcours_bruts()
    compteurs = stockage.compter_inscrits_par_parcours()
    return _assembler_parcours(bruts[identifiant], catalogue, compteurs)


# =========================================== ROUTES PAR IDENTIFIANT /{id} ===


def _recuperer_brut_ou_404(
    parcours_id: str, est_encadrant: bool
) -> tuple[str, dict[str, Any]]:
    pid = _valider_slug(parcours_id, "Identifiant de parcours")
    bruts = _lire_parcours_bruts()
    brut = bruts.get(pid)
    if brut is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Parcours introuvable : « {pid} ».",
        )
    if not est_encadrant and brut["statut"] != "publie":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ce parcours n'est pas publié.",
        )
    return pid, brut


@router.get(
    "/{parcours_id}",
    summary="Détail complet d'un parcours (cours ordonnés, compétences, inscrits, progression)",
)
def detail_parcours(
    parcours_id: str,
    utilisateur: Annotated[
        dict[str, Any] | None, Depends(utilisateur_optionnel)
    ] = None,
) -> dict[str, Any]:
    est_encadrant = bool(
        utilisateur and utilisateur.get("role") in ("admin", "formateur")
    )
    est_etudiant = bool(utilisateur and utilisateur.get("role") == "etudiant")

    pid, brut = _recuperer_brut_ou_404(parcours_id, est_encadrant)
    catalogue = _catalogue_cours_graphe()
    compteurs = stockage.compter_inscrits_par_parcours()
    fiche = _assembler_parcours(brut, catalogue, compteurs)
    fiche["certificationsLiees"] = _certifications_liees_parcours(fiche)

    if est_etudiant and utilisateur:
        uid = int(utilisateur["id"])
        ins = stockage.trouver_inscription(uid, pid)
        etat_etud = _etat_etudiant_graphe(utilisateur)
        prog = _calculer_progression_parcours(
            fiche, etat_etud, ins is not None
        )
        fiche["estInscrit"] = ins is not None
        fiche["dateInscription"] = ins["creeLe"] if ins else None
        fiche["progression"] = prog["pourcentage"]
        fiche["coursTermines"] = prog["coursTermines"]
        fiche["coursEnCours"] = prog["coursEnCours"]
        fiche["estTermine"] = prog["estTermine"]
        fiche["prochainCours"] = prog["prochainCours"]
        fiche["etapes"] = prog["etapes"]
    elif est_encadrant:
        inscrits = stockage.inscrits_parcours(pid)
        enrichis: list[dict[str, Any]] = []
        for ins in inscrits:
            ligne_u = db.trouver_par_id(ins["utilisateurId"])
            pct = 0
            cours_done = 0
            if ligne_u is not None:
                etat = _etat_etudiant_graphe(dict(ligne_u))
                prog = _calculer_progression_parcours(fiche, etat, True)
                pct = prog["pourcentage"]
                cours_done = prog["coursTermines"]
            enrichis.append(
                {
                    **ins,
                    "progression": pct,
                    "coursTermines": cours_done,
                    "nombreCours": fiche["nombreCours"],
                }
            )
        fiche["inscrits"] = enrichis

    return fiche


@router.put(
    "/{parcours_id}",
    summary="Modifier les métadonnées, le niveau OWL et/ou les cours d'un parcours (administrateur)",
)
def modifier_parcours(
    parcours_id: str,
    donnees: ParcoursEntree,
    _: Annotated[dict[str, Any], Depends(exiger_admin)],
) -> dict[str, Any]:
    pid, brut = _recuperer_brut_ou_404(parcours_id, est_encadrant=True)
    _verifier_unicite_nom(donnees.nom, exclure_id=pid)

    catalogue = _catalogue_cours_graphe()
    if donnees.cours_ids is not None:
        cours_ids = _valider_et_nettoyer_cours_ids(
            donnees.cours_ids, catalogue, donnees.statut
        )
    else:
        cours_actuels = stockage.reconcilier_ordre(
            pid, list(brut["coursOwlSet"])
        )
        cours_ids = _valider_et_nettoyer_cours_ids(
            cours_actuels, catalogue, donnees.statut
        )

    _ecrire_parcours_fuseki(
        identifiant=pid,
        nom=donnees.nom,
        description=donnees.description,
        objectif=donnees.objectif,
        classe_owl=donnees.niveau,
        statut_parcours=donnees.statut,
        cours_ids=cours_ids,
    )

    bruts = _lire_parcours_bruts()
    compteurs = stockage.compter_inscrits_par_parcours()
    return _assembler_parcours(bruts[pid], catalogue, compteurs)


@router.put(
    "/{parcours_id}/cours",
    summary="Remplacer ou réordonner la liste complète des cours d'un parcours (administrateur)",
)
def remplacer_cours_parcours(
    parcours_id: str,
    donnees: ParcoursCoursOrdreEntree,
    _: Annotated[dict[str, Any], Depends(exiger_admin)],
) -> dict[str, Any]:
    pid, brut = _recuperer_brut_ou_404(parcours_id, est_encadrant=True)
    catalogue = _catalogue_cours_graphe()
    cours_ids = _valider_et_nettoyer_cours_ids(
        donnees.cours_ids, catalogue, brut["statut"]
    )

    _ecrire_parcours_fuseki(
        identifiant=pid,
        nom=brut["nom"],
        description=brut.get("description"),
        objectif=brut.get("objectif"),
        classe_owl=brut["niveauClasse"],
        statut_parcours=brut["statut"],
        cours_ids=cours_ids,
    )

    bruts = _lire_parcours_bruts()
    compteurs = stockage.compter_inscrits_par_parcours()
    return _assembler_parcours(bruts[pid], catalogue, compteurs)


@router.post(
    "/{parcours_id}/cours",
    status_code=status.HTTP_201_CREATED,
    summary="Ajouter un cours existant à un parcours (administrateur)",
)
def ajouter_cours_parcours(
    parcours_id: str,
    donnees: ParcoursAjoutCoursEntree,
    _: Annotated[dict[str, Any], Depends(exiger_admin)],
) -> dict[str, Any]:
    pid, brut = _recuperer_brut_ou_404(parcours_id, est_encadrant=True)
    cid = _valider_slug(donnees.cours_id, "Identifiant de cours")
    catalogue = _catalogue_cours_graphe()
    if cid not in catalogue:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cours introuvable dans l'ontologie : « {cid} ».",
        )

    actuels = stockage.reconcilier_ordre(pid, list(brut["coursOwlSet"]))
    if cid in actuels:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Le cours « {catalogue[cid]['nom']} » fait déjà partie de ce parcours.",
        )

    nouveaux = list(actuels)
    if donnees.position is None or donnees.position > len(nouveaux):
        nouveaux.append(cid)
    else:
        nouveaux.insert(donnees.position - 1, cid)

    _ecrire_parcours_fuseki(
        identifiant=pid,
        nom=brut["nom"],
        description=brut.get("description"),
        objectif=brut.get("objectif"),
        classe_owl=brut["niveauClasse"],
        statut_parcours=brut["statut"],
        cours_ids=nouveaux,
    )

    bruts = _lire_parcours_bruts()
    compteurs = stockage.compter_inscrits_par_parcours()
    return _assembler_parcours(bruts[pid], catalogue, compteurs)


@router.delete(
    "/{parcours_id}/cours/{cours_id}",
    summary="Retirer un cours d'un parcours (administrateur)",
)
def retirer_cours_parcours(
    parcours_id: str,
    cours_id: str,
    _: Annotated[dict[str, Any], Depends(exiger_admin)],
) -> dict[str, Any]:
    pid, brut = _recuperer_brut_ou_404(parcours_id, est_encadrant=True)
    cid = _valider_slug(cours_id, "Identifiant de cours")
    actuels = stockage.reconcilier_ordre(pid, list(brut["coursOwlSet"]))

    if cid not in actuels:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Le cours « {cid} » n'appartient pas à ce parcours.",
        )
    nouveaux = [c for c in actuels if c != cid]
    if brut["statut"] == "publie" and len(nouveaux) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Impossible de retirer le dernier cours d'un parcours publié : "
                "passez d'abord le parcours en brouillon."
            ),
        )

    _ecrire_parcours_fuseki(
        identifiant=pid,
        nom=brut["nom"],
        description=brut.get("description"),
        objectif=brut.get("objectif"),
        classe_owl=brut["niveauClasse"],
        statut_parcours=brut["statut"],
        cours_ids=nouveaux,
    )

    catalogue = _catalogue_cours_graphe()
    bruts = _lire_parcours_bruts()
    compteurs = stockage.compter_inscrits_par_parcours()
    return _assembler_parcours(bruts[pid], catalogue, compteurs)


@router.post(
    "/{parcours_id}/dupliquer",
    status_code=status.HTTP_201_CREATED,
    summary="Dupliquer un parcours existant en tant que brouillon (administrateur)",
)
def dupliquer_parcours(
    parcours_id: str,
    _: Annotated[dict[str, Any], Depends(exiger_admin)],
) -> dict[str, Any]:
    pid, brut = _recuperer_brut_ou_404(parcours_id, est_encadrant=True)
    bruts = _lire_parcours_bruts()
    noms_existants = {
        (b.get("nom") or "").strip().lower() for b in bruts.values()
    }

    base_nom = f"{brut['nom']} (Copie)"
    candidat_nom = base_nom
    compteur = 2
    while candidat_nom.lower() in noms_existants:
        candidat_nom = f"{brut['nom']} (Copie {compteur})"
        compteur += 1

    cours_ids = stockage.reconcilier_ordre(pid, list(brut["coursOwlSet"]))
    nouvel_id = ecriture.generer_id("Parcours", candidat_nom)

    _ecrire_parcours_fuseki(
        identifiant=nouvel_id,
        nom=candidat_nom,
        description=brut.get("description"),
        objectif=brut.get("objectif"),
        classe_owl=brut["niveauClasse"],
        statut_parcours="brouillon",
        cours_ids=cours_ids,
    )

    catalogue = _catalogue_cours_graphe()
    bruts_maj = _lire_parcours_bruts()
    compteurs = stockage.compter_inscrits_par_parcours()
    return _assembler_parcours(bruts_maj[nouvel_id], catalogue, compteurs)


@router.delete(
    "/{parcours_id}",
    summary="Supprimer un parcours, ses triplets OWL, son ordre et ses inscriptions (administrateur)",
)
def supprimer_parcours(
    parcours_id: str,
    _: Annotated[dict[str, Any], Depends(exiger_admin)],
) -> dict[str, Any]:
    pid, _ = _recuperer_brut_ou_404(parcours_id, est_encadrant=True)
    sujet = f"<{EDU}{pid}>"

    # Supprime tous les triplets où l'individu est sujet OU objet
    _executer_sparql(
        f"DELETE WHERE {{ ?s ?p {sujet} . }} ;\n"
        f"DELETE WHERE {{ {sujet} ?p ?o . }}"
    )

    nb_inscrits, suivis_orphelins = stockage.supprimer_parcours(pid)

    # Nettoie les triplets `edu:suitCours` créés uniquement par ce parcours
    par_utilisateur: dict[int, list[str]] = {}
    for uid, cid in suivis_orphelins:
        par_utilisateur.setdefault(uid, []).append(cid)

    for uid, cids in par_utilisateur.items():
        ligne_u = db.trouver_par_id(uid)
        if ligne_u is not None:
            individu = _individu_etudiant(dict(ligne_u))
            _synchroniser_suit_cours_fuseki_et_owl(
                individu, retirer_cids=cids
            )

    _persister_tous_les_parcours_owl()

    return {
        "statut": "supprime",
        "id": pid,
        "inscriptionsSupprimees": nb_inscrits,
    }


@router.get(
    "/{parcours_id}/analyse",
    summary="Analyse de cohérence pédagogique et proposition d'ordre topologique (admin/formateur)",
)
def analyser_parcours(
    parcours_id: str,
    _: Annotated[dict[str, Any], Depends(acces_encadrant)],
) -> dict[str, Any]:
    pid, brut = _recuperer_brut_ou_404(parcours_id, est_encadrant=True)
    catalogue = _catalogue_cours_graphe()
    compteurs = stockage.compter_inscrits_par_parcours()
    fiche = _assembler_parcours(brut, catalogue, compteurs)
    return _analyser_coherence(fiche, catalogue)


@router.post(
    "/{parcours_id}/inscription",
    status_code=status.HTTP_201_CREATED,
    summary="S'inscrire à un parcours publié (étudiant)",
)
def inscrire_etudiant_parcours(
    parcours_id: str,
    utilisateur: Annotated[dict[str, Any], Depends(exiger_etudiant)],
) -> dict[str, Any]:
    pid, brut = _recuperer_brut_ou_404(parcours_id, est_encadrant=False)
    catalogue = _catalogue_cours_graphe()
    compteurs_avant = stockage.compter_inscrits_par_parcours()
    fiche_init = _assembler_parcours(brut, catalogue, compteurs_avant)

    if fiche_init["nombreCours"] == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce parcours ne contient encore aucun cours.",
        )

    uid = int(utilisateur["id"])
    # Garantit l'existence de l'individu `edu:compte_<uid>` dans Fuseki
    individu = f"compte_{uid}"
    if not exec_(PREFIX + f"SELECT ?p WHERE {{ <{EDU}{individu}> ?p ?o }} LIMIT 1"):
        ontologie_sync.synchroniser(utilisateur)
        export_owl.exporter_sans_erreur()

    ins, _ = stockage.inscrire(uid, pid)

    # Identifie le premier cours non validé et ajoute `edu:suitCours` s'il n'est pas déjà suivi
    etat_avant = _etat_etudiant_graphe(utilisateur)
    prog_avant = _calculer_progression_parcours(fiche_init, etat_avant, True)
    premier_a_suivre = prog_avant.get("prochainCours")
    if premier_a_suivre:
        cid_premier = premier_a_suivre["id"]
        if cid_premier not in etat_avant["coursSuivis"]:
            stockage.marquer_cours_suivi(uid, pid, cid_premier)
            _synchroniser_suit_cours_fuseki_et_owl(
                etat_avant["individu"], ajouter_cid=cid_premier
            )

    compteurs = stockage.compter_inscrits_par_parcours()
    fiche = _assembler_parcours(brut, catalogue, compteurs)
    etat = _etat_etudiant_graphe(utilisateur)
    prog = _calculer_progression_parcours(fiche, etat, True)

    return {
        **fiche,
        "estInscrit": True,
        "dateInscription": ins["creeLe"],
        "progression": prog["pourcentage"],
        "coursTermines": prog["coursTermines"],
        "coursEnCours": prog["coursEnCours"],
        "estTermine": prog["estTermine"],
        "prochainCours": prog["prochainCours"],
        "etapes": prog["etapes"],
    }


@router.delete(
    "/{parcours_id}/inscription",
    summary="Se désinscrire d'un parcours (étudiant)",
)
def desinscrire_etudiant_parcours(
    parcours_id: str,
    utilisateur: Annotated[dict[str, Any], Depends(exiger_etudiant)],
) -> dict[str, Any]:
    pid = _valider_slug(parcours_id, "Identifiant de parcours")
    uid = int(utilisateur["id"])
    supprime, cours_a_retirer = stockage.desinscrire(uid, pid)
    if not supprime:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vous n'êtes pas inscrit à ce parcours.",
        )

    if cours_a_retirer:
        individu = _individu_etudiant(utilisateur)
        _synchroniser_suit_cours_fuseki_et_owl(
            individu, retirer_cids=cours_a_retirer
        )

    return {
        "statut": "desinscrit",
        "parcoursId": pid,
        "coursRetiresSuitCours": cours_a_retirer,
    }

