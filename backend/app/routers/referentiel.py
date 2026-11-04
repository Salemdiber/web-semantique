"""CRUD des compétences et prérequis stockés dans l'ontologie OWL."""
from typing import Annotated, Any
import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app import ontologie_ecriture as ecriture
from app.routers.auth import utilisateur_courant
from app.routers.education import EDU, PREFIX, exec_

router = APIRouter(prefix="/education", tags=["Compétences & prérequis"])

TYPES_COMPETENCE = {"Competence", "CompetenceTechnique", "CompetenceLinguistique"}
TYPES_PREREQUIS = {"PrerequisCompetence"}
NIVEAUX = {"Débutant", "Intermédiaire", "Difficile"}


class CompetenceEntree(BaseModel):
    nom: str = Field(min_length=2, max_length=120)
    niveau: str | None = Field(default=None, max_length=80)
    type: str = "CompetenceTechnique"
    cours_ids: list[str] = Field(default_factory=list, max_length=100)

    @field_validator("nom")
    @classmethod
    def nom_non_vide(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Le nom est obligatoire")
        return value.strip()

    @field_validator("niveau")
    @classmethod
    def niveau_valide(cls, value: str | None) -> str | None:
        if value == "Avancé":  # compatibilité avec les données saisies avant ce changement
            return "Difficile"
        if value is not None and value not in NIVEAUX:
            raise ValueError("Niveau attendu : Débutant, Intermédiaire ou Difficile")
        return value

    @field_validator("type")
    @classmethod
    def type_valide(cls, value: str) -> str:
        if value not in TYPES_COMPETENCE:
            raise ValueError("Type de compétence invalide")
        return value


class PrerequisEntree(BaseModel):
    description: str = Field(min_length=2, max_length=240)
    niveau: str = Field(min_length=1, max_length=80)
    type: str = "PrerequisCompetence"
    competence_id: str = Field(min_length=1, max_length=240)
    cours_ids: list[str] = Field(default_factory=list, max_length=100)

    @field_validator("description")
    @classmethod
    def description_non_vide(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("La description est obligatoire")
        return value.strip()

    @field_validator("niveau")
    @classmethod
    def niveau_valide(cls, value: str | None) -> str | None:
        if value == "Avancé":  # compatibilité avec les données saisies avant ce changement
            return "Difficile"
        if value is not None and value not in NIVEAUX:
            raise ValueError("Niveau attendu : Débutant, Intermédiaire ou Difficile")
        return value

    @field_validator("type")
    @classmethod
    def type_valide(cls, value: str) -> str:
        if value not in TYPES_PREREQUIS:
            raise ValueError("Type de prérequis invalide")
        return value


def exiger_edition(
    utilisateur: Annotated[dict[str, Any], Depends(utilisateur_courant)],
) -> dict[str, Any]:
    if utilisateur.get("role") not in ("admin", "formateur"):
        raise HTTPException(status_code=403, detail="Réservé aux administrateurs et formateurs")
    return utilisateur


def _local(value: str) -> str:
    local = ecriture.nom_local(value)
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,119}", local):
        raise HTTPException(status_code=422, detail="Identifiant OWL invalide")
    return local


def _existe(local: str, classe: str) -> bool:
    return bool(exec_(PREFIX + f"SELECT ?type WHERE {{ <{EDU}{local}> rdf:type/rdfs:subClassOf* edu:{classe} ; rdf:type ?type }} LIMIT 1"))


def _litteral(value: str) -> str:
    return f'"{ecriture.echapper(value)}"'


def _update(query: str) -> None:
    try:
        ecriture.executer(query)
    except ecriture.EcritureError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _identifiant(type_id: str, nom: str) -> str:
    local = ecriture.generer_id(type_id, nom)
    rows = exec_(PREFIX + f"SELECT ?p WHERE {{ <{EDU}{local}> ?p ?o }} LIMIT 1")
    while rows:
        local = ecriture.generer_id(type_id, nom)
        rows = exec_(PREFIX + f"SELECT ?p WHERE {{ <{EDU}{local}> ?p ?o }} LIMIT 1")
    return local


def _prerequis_deja_present(description: str) -> bool:
    valeur = ecriture.echapper(description.strip().casefold())
    rows = exec_(PREFIX + f"""
        SELECT ?id WHERE {{
          ?id rdf:type/rdfs:subClassOf* edu:Prerequis ;
              edu:descriptionPrerequis ?description .
          FILTER(LCASE(STR(?description)) = "{valeur}")
        }} LIMIT 1
    """)
    return bool(rows)


@router.get("/prerequis", summary="Lister les prérequis et leurs relations")
def lister_prerequis() -> list[dict[str, Any]]:
    rows = exec_(PREFIX + """
        SELECT ?id ?description ?niveau ?competence ?competenceNom
               (GROUP_CONCAT(DISTINCT STR(?cours); separator="|") AS ?coursIds)
        WHERE {
          ?id rdf:type/rdfs:subClassOf* edu:Prerequis .
          OPTIONAL { ?id edu:descriptionPrerequis ?description }
          OPTIONAL { ?id edu:niveauRequis ?niveau }
          OPTIONAL { ?id edu:necessiteCompetence ?competence .
                     OPTIONAL { ?competence edu:nomCompetence ?competenceNom } }
          OPTIONAL { ?cours edu:aPourPrerequis ?id }
        }
        GROUP BY ?id ?description ?niveau ?competence ?competenceNom
        ORDER BY ?description
    """)
    # Les jointures RDF et les individus historiques peuvent produire
    # plusieurs lignes pour le même sujet; le tableau doit rester une ligne
    # par individu OWL.
    par_id: dict[str, dict[str, Any]] = {}
    for row in rows:
        identifiant = str(row.get("id") or "")
        if not identifiant:
            continue
        fiche = par_id.setdefault(identifiant, {
            "id": identifiant,
            "description": row.get("description") or "",
            "niveau": row.get("niveau"),
            "competenceId": row.get("competence"),
            "competenceNom": row.get("competenceNom"),
            "coursIds": [],
        })
        fiche["competenceId"] = fiche["competenceId"] or row.get("competence")
        fiche["competenceNom"] = fiche["competenceNom"] or row.get("competenceNom")
        fiche["niveau"] = fiche["niveau"] or row.get("niveau")
        for cours_id in (row.get("coursIds") or "").split("|"):
            local = ecriture.nom_local(cours_id)
            if local and local not in fiche["coursIds"]:
                fiche["coursIds"].append(local)
    return list(par_id.values())


@router.post("/competences", status_code=status.HTTP_201_CREATED, summary="Créer une compétence")
def creer_competence(donnees: CompetenceEntree, _: Annotated[dict[str, Any], Depends(exiger_edition)]) -> dict[str, Any]:
    identifiant = _identifiant(donnees.type, donnees.nom)
    cours = [_local(item) for item in donnees.cours_ids]
    for cours_id in cours:
        if not _existe(cours_id, "Cours"):
            raise HTTPException(status_code=404, detail=f"Cours introuvable : {cours_id}")
    paires = [f"<{EDU}nomCompetence> {_litteral(donnees.nom)}"]
    if donnees.niveau:
        paires.append(f"<{EDU}niveauCompetence> {_litteral(donnees.niveau)}")
    triplets = [f"<{EDU}{identifiant}> a <{EDU}{donnees.type}> ; " + " ; ".join(paires) + " ."]
    triplets.extend(f"<{EDU}{cours_id}> <{EDU}developpeCompetence> <{EDU}{identifiant}> ." for cours_id in cours)
    _update("INSERT DATA { " + " ".join(triplets) + " }")
    return {"id": identifiant, "nom": donnees.nom, "niveau": donnees.niveau, "type": donnees.type, "coursDeveloppant": [], "coursIds": cours, "necessitee": []}


@router.put("/competences/{identifiant}", summary="Modifier une compétence")
def modifier_competence(identifiant: str, donnees: CompetenceEntree, _: Annotated[dict[str, Any], Depends(exiger_edition)]) -> dict[str, Any]:
    local = _local(identifiant)
    if not _existe(local, "Competence"):
        raise HTTPException(status_code=404, detail="Compétence introuvable")
    cours = [_local(item) for item in donnees.cours_ids]
    for cours_id in cours:
        if not _existe(cours_id, "Cours"):
            raise HTTPException(status_code=404, detail=f"Cours introuvable : {cours_id}")
    paires = [f"<{EDU}nomCompetence> {_litteral(donnees.nom)}"]
    if donnees.niveau:
        paires.append(f"<{EDU}niveauCompetence> {_litteral(donnees.niveau)}")
    bloc = f"<{EDU}{local}> a <{EDU}{donnees.type}> ; " + " ; ".join(paires) + " ."
    suppressions = [
        f"DELETE WHERE {{ <{EDU}{local}> ?p ?o }}",
        f"DELETE WHERE {{ ?cours <{EDU}developpeCompetence> <{EDU}{local}> }}",
    ]
    insertions = [bloc] + [
        f"<{EDU}{cours_id}> <{EDU}developpeCompetence> <{EDU}{local}> ."
        for cours_id in cours
    ]
    _update(" ; ".join(suppressions) + " ; INSERT DATA { " + " ".join(insertions) + " }")
    return {"id": local, "nom": donnees.nom, "niveau": donnees.niveau, "type": donnees.type, "coursDeveloppant": [], "coursIds": cours, "necessitee": []}


@router.delete("/competences/{identifiant}", summary="Supprimer une compétence")
def supprimer_competence(identifiant: str, _: Annotated[dict[str, Any], Depends(exiger_edition)]) -> dict[str, str]:
    local = _local(identifiant)
    if not _existe(local, "Competence"):
        raise HTTPException(status_code=404, detail="Compétence introuvable")
    _update(f"DELETE WHERE {{ <{EDU}{local}> ?p ?o }} ; DELETE WHERE {{ ?s ?p <{EDU}{local}> }}")
    return {"statut": "supprime", "id": local}


def _ecrire_prerequis(local: str, donnees: PrerequisEntree) -> None:
    competence = _local(donnees.competence_id)
    if not _existe(competence, "Competence"):
        raise HTTPException(status_code=404, detail="Compétence liée introuvable")
    cours = [_local(item) for item in donnees.cours_ids]
    for cours_id in cours:
        if not _existe(cours_id, "Cours"):
            raise HTTPException(status_code=404, detail=f"Cours introuvable : {cours_id}")
    paires = [
        f"<{EDU}descriptionPrerequis> {_litteral(donnees.description)}",
        f"<{EDU}niveauRequis> {_litteral(donnees.niveau)}",
    ]
    paires.append(f"<{EDU}necessiteCompetence> <{EDU}{competence}>")
    bloc = f"<{EDU}{local}> a <{EDU}PrerequisCompetence> ; " + " ; ".join(paires) + " ."
    suppressions = [f"DELETE WHERE {{ <{EDU}{local}> ?p ?o }}", f"DELETE WHERE {{ ?cours <{EDU}aPourPrerequis> <{EDU}{local}> }}"]
    insertions = [bloc] + [f"<{EDU}{cid}> <{EDU}aPourPrerequis> <{EDU}{local}> ." for cid in cours]
    _update(" ; ".join(suppressions) + " ; INSERT DATA { " + " ".join(insertions) + " }")


@router.post("/prerequis", status_code=status.HTTP_201_CREATED, summary="Créer un prérequis")
def creer_prerequis(donnees: PrerequisEntree, _: Annotated[dict[str, Any], Depends(exiger_edition)]) -> dict[str, Any]:
    if _prerequis_deja_present(donnees.description):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un prérequis portant cette description existe déjà. Modifiez-le dans la liste au lieu de le recréer.",
        )
    identifiant = _identifiant("PrerequisCompetence", donnees.description)
    _ecrire_prerequis(identifiant, donnees)
    return {"id": identifiant, **donnees.model_dump()}


@router.put("/prerequis/{identifiant}", summary="Modifier un prérequis")
def modifier_prerequis(identifiant: str, donnees: PrerequisEntree, _: Annotated[dict[str, Any], Depends(exiger_edition)]) -> dict[str, Any]:
    local = _local(identifiant)
    if not _existe(local, "Prerequis"):
        raise HTTPException(status_code=404, detail="Prérequis introuvable")
    _ecrire_prerequis(local, donnees)
    return {"id": local, **donnees.model_dump()}


@router.delete("/prerequis/{identifiant}", summary="Supprimer un prérequis")
def supprimer_prerequis(identifiant: str, _: Annotated[dict[str, Any], Depends(exiger_edition)]) -> dict[str, str]:
    local = _local(identifiant)
    if not _existe(local, "Prerequis"):
        raise HTTPException(status_code=404, detail="Prérequis introuvable")
    _update(f"DELETE WHERE {{ <{EDU}{local}> ?p ?o }} ; DELETE WHERE {{ ?s ?p <{EDU}{local}> }}")
    return {"statut": "supprime", "id": local}
