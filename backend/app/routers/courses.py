"""Module « Gestion des cours » (`edu:Cours`).

CRUD complet exposé sous `/api/courses` et adossé à l'ontologie OWL
(`education_formation_protege.owl`) interrogée en SPARQL via Fuseki.

Les écritures sont réservées aux administrateurs (comme le module parcours).
"""
from __future__ import annotations

import logging
import re
import unicodedata
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app import ontologie_ecriture as ecriture
from app.routers.auth import exiger_admin
from app.sparql_client import FusekiClient, FusekiError

router = APIRouter(prefix="/courses", tags=["Gestion des cours"])
client = FusekiClient()
logger = logging.getLogger("uvicorn.error")

EDU = "http://example.org/education-formation#"
RDFS = "http://www.w3.org/2000/01/rdf-schema#"
OWL = "http://www.w3.org/2002/07/owl#"

RE_IDENTIFIANT = re.compile(r"^[A-Za-z0-9_-]{1,160}$")

PREFIXE = """PREFIX edu: <http://example.org/education-formation#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
"""

PROPRIETES_GEREES = (
    "nomCours",
    "descriptionCours",
    "dureeCours",
    "niveauCours",
    "categorieCours",
)


class CoursEntree(BaseModel):
    """Corps attendu par POST/PUT `/api/courses`."""

    nom: str = Field(min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    duree: str = Field(min_length=1, max_length=80, examples=["30 heures"])
    niveau: str | None = Field(default=None, max_length=80)
    categorie: str | None = Field(default=None, max_length=120)
    formateur: str | None = Field(
        default=None,
        max_length=160,
        description="Identifiant local ou prénom d'un formateur existant",
    )

    @field_validator("nom", "duree")
    @classmethod
    def texte_obligatoire(cls, valeur: str) -> str:
        valeur = valeur.strip()
        if not valeur:
            raise ValueError("Ce champ est obligatoire")
        return valeur

    @field_validator("description", "niveau", "categorie", "formateur")
    @classmethod
    def texte_facultatif(cls, valeur: str | None) -> str | None:
        if valeur is None:
            return None
        valeur = valeur.strip()
        return valeur or None


def _split(valeur: Any) -> list[str]:
    if not valeur:
        return []
    elements: list[str] = []
    vus: set[str] = set()
    for element in str(valeur).split("|"):
        element = element.strip()
        if element and element not in vus:
            vus.add(element)
            elements.append(element)
    return elements


def _requete_cours(filtre: str = "") -> str:
    return (
        PREFIXE
        + """
SELECT ?cours ?nom ?description ?duree ?niveau ?categorie
       ?prerequis ?competences ?formateurs ?formateurIds
WHERE {
    ?cours rdf:type/rdfs:subClassOf* edu:Cours .
    ?cours edu:nomCours ?nom .
    FILTRE_PLACEHOLDER
    OPTIONAL { ?cours edu:descriptionCours ?description }
    OPTIONAL { ?cours edu:dureeCours ?duree }
    OPTIONAL { ?cours edu:niveauCours ?niveau }
    OPTIONAL { ?cours edu:categorieCours ?categorie }
    OPTIONAL {
        SELECT ?cours
               (GROUP_CONCAT(DISTINCT ?prerequisNom; separator="|") AS ?prerequis)
        WHERE {
            ?cours edu:aPourPrerequis ?prerequisIri .
            ?prerequisIri edu:descriptionPrerequis ?prerequisNom .
        }
        GROUP BY ?cours
    }
    OPTIONAL {
        SELECT ?cours
               (GROUP_CONCAT(DISTINCT ?competenceNom; separator="|") AS ?competences)
        WHERE {
            ?cours edu:developpeCompetence ?competence .
            ?competence edu:nomCompetence ?competenceNom .
        }
        GROUP BY ?cours
    }
    OPTIONAL {
        SELECT ?cours
               (GROUP_CONCAT(DISTINCT ?formateurNom; separator="|") AS ?formateurs)
               (GROUP_CONCAT(DISTINCT ?formateurIdentifiant; separator="|") AS ?formateurIds)
        WHERE {
            ?formateur edu:enseigne ?cours .
            OPTIONAL { ?formateur edu:prenom ?formateurNom }
            BIND(REPLACE(STR(?formateur), "^.*#", "") AS ?formateurIdentifiant)
        }
        GROUP BY ?cours
    }
}
ORDER BY ?nom
""".replace(
            "    FILTRE_PLACEHOLDER\n", f"{filtre}\n" if filtre else ""
        )
    )


def _row_to_cours(row: dict[str, Any]) -> dict[str, Any]:
    formateurs = _split(row.get("formateurs"))
    formateur_ids = _split(row.get("formateurIds"))
    return {
        "id": row.get("cours"),
        "nom": row.get("nom"),
        "duree": row.get("duree") or "Durée non précisée",
        "description": row.get("description"),
        "niveau": row.get("niveau"),
        "categorie": row.get("categorie"),
        "type": "Cours",
        "prerequis": _split(row.get("prerequis")),
        "competences": _split(row.get("competences")),
        "formateurs": formateurs,
        "formateur": formateurs[0] if formateurs else None,
        "formateurIds": formateur_ids,
    }


def _select(requete: str) -> list[dict[str, Any]]:
    try:
        return client.select(requete)
    except FusekiError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Fuseki injoignable : {exc}",
        ) from exc


def _update(mise_a_jour: str) -> None:
    try:
        ecriture.executer(mise_a_jour)
    except ecriture.EcritureError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Écriture OWL impossible : {exc}",
        ) from exc


def _verifier_identifiant(identifiant: str) -> str:
    identifiant = (identifiant or "").strip()
    if not RE_IDENTIFIANT.match(identifiant):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identifiant de cours invalide",
        )
    return identifiant


def _lire_cours(identifiant: str) -> dict[str, Any]:
    identifiant = _verifier_identifiant(identifiant)
    filtre = f'FILTER (STR(?cours) = "{EDU}{identifiant}")'
    lignes = _select(_requete_cours(filtre))
    if not lignes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cours introuvable : {identifiant}",
        )
    return _row_to_cours(lignes[0])


def _resoudre_formateur(valeur: str | None) -> str | None:
    if not valeur:
        return None

    cible = valeur.strip()
    local = ecriture.nom_local(cible)
    lignes = _select(
        PREFIXE
        + """
SELECT ?formateur ?prenom ?nom
WHERE {
    ?formateur rdf:type/rdfs:subClassOf* edu:Formateur .
    OPTIONAL { ?formateur edu:prenom ?prenom }
    OPTIONAL { ?formateur edu:nom ?nom }
}
"""
    )

    for ligne in lignes:
        identifiant = ecriture.nom_local(str(ligne.get("formateur") or ""))
        etiquettes = {
            identifiant.lower(),
            str(ligne.get("prenom") or "").strip().lower(),
            str(ligne.get("nom") or "").strip().lower(),
        }
        if cible.lower() in etiquettes or local.lower() == identifiant.lower():
            if not RE_IDENTIFIANT.match(identifiant):
                break
            return identifiant

    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Formateur introuvable : {valeur}",
    )


def _generer_identifiant(nom: str) -> str:
    normalise = (
        unicodedata.normalize("NFKD", nom)
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    slug = re.sub(r"[^A-Za-z0-9]+", "_", normalise).strip("_").lower()
    slug = (slug or "cours")[:60]
    return f"cours_{slug}_{uuid.uuid4().hex[:8]}"


def _triplets_cours(identifiant: str, donnees: CoursEntree) -> str:
    sujet = f"<{EDU}{identifiant}>"
    lignes = [
        f"{sujet} a <{OWL}NamedIndividual> , <{EDU}Cours>",
        f'    <{RDFS}label> "{ecriture.echapper(donnees.nom)}"@fr',
        f'    <{EDU}nomCours> "{ecriture.echapper(donnees.nom)}"',
        f'    <{EDU}dureeCours> "{ecriture.echapper(donnees.duree)}"',
    ]
    for propriete, valeur in (
        ("descriptionCours", donnees.description),
        ("niveauCours", donnees.niveau),
        ("categorieCours", donnees.categorie),
    ):
        if valeur:
            lignes.append(
                f'    <{EDU}{propriete}> "{ecriture.echapper(valeur)}"'
            )

    return " ;\n".join(lignes) + " ."


@router.get("", summary="Lister tous les cours")
def lister_cours() -> list[dict[str, Any]]:
    return [_row_to_cours(ligne) for ligne in _select(_requete_cours())]


@router.get("/{identifiant}", summary="Détail d'un cours")
def detail_cours(identifiant: str) -> dict[str, Any]:
    return _lire_cours(identifiant)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Créer un cours (admin)",
)
def creer_cours(
    donnees: CoursEntree,
    _: Annotated[dict[str, Any], Depends(exiger_admin)],
) -> dict[str, Any]:
    identifiant = _generer_identifiant(donnees.nom)
    formateur_id = _resoudre_formateur(donnees.formateur)
    bloc = _triplets_cours(identifiant, donnees)
    if formateur_id:
        bloc += (
            f"\n  <{EDU}{formateur_id}> <{EDU}enseigne> <{EDU}{identifiant}> ."
        )

    _update(f"INSERT DATA {{\n{bloc}\n}}")
    return _lire_cours(identifiant)


@router.put("/{identifiant}", summary="Mettre à jour un cours (admin)")
def modifier_cours(
    identifiant: str,
    donnees: CoursEntree,
    _: Annotated[dict[str, Any], Depends(exiger_admin)],
) -> dict[str, Any]:
    identifiant = _verifier_identifiant(identifiant)
    _lire_cours(identifiant)

    sujet = f"<{EDU}{identifiant}>"
    suppressions = [
        f"DELETE WHERE {{ {sujet} <{EDU}{propriete}> ?valeur . }}"
        for propriete in PROPRIETES_GEREES
    ]
    suppressions.append(f"DELETE WHERE {{ {sujet} <{RDFS}label> ?valeur . }}")
    suppressions.append(
        f"DELETE WHERE {{ ?formateur <{EDU}enseigne> {sujet} . }}"
    )

    formateur_id = _resoudre_formateur(donnees.formateur)
    triplets = _triplets_cours(identifiant, donnees)
    instructions = suppressions + [f"INSERT DATA {{\n{triplets}\n}}"]
    if formateur_id:
        instructions.append(
            f"INSERT DATA {{\n"
            f"  <{EDU}{formateur_id}> <{EDU}enseigne> {sujet} .\n"
            f"}}"
        )

    _update(" ;\n".join(instructions))
    return _lire_cours(identifiant)


@router.delete("/{identifiant}", summary="Supprimer un cours (admin)")
def supprimer_cours(
    identifiant: str,
    _: Annotated[dict[str, Any], Depends(exiger_admin)],
) -> dict[str, str]:
    identifiant = _verifier_identifiant(identifiant)
    _lire_cours(identifiant)

    sujet = f"<{EDU}{identifiant}>"
    _update(
        f"DELETE WHERE {{ {sujet} ?propriete ?valeur . }} ;\n"
        f"DELETE WHERE {{ ?sujet ?propriete {sujet} . }}"
    )
    return {"statut": "supprime", "id": identifiant}


EXEMPLES = (
    {
        "id": "Angular",
        "nom": "Angular",
        "equivalents": ("Angulaire",),
        "duree": "30 heures",
        "description": "Framework front-end TypeScript pour construire des applications web structurées.",
        "niveau": "Intermédiaire",
        "categorie": "Développement Web",
    },
    {
        "id": "Cours_Developpement_Web",
        "nom": "Développement Web",
        "equivalents": (),
        "duree": "40 heures",
        "description": "Conception et réalisation d'interfaces web modernes, accessibles et responsives.",
        "niveau": "Intermédiaire",
        "categorie": "Développement Web",
    },
    {
        "id": "Python",
        "nom": "Python",
        "equivalents": (),
        "duree": "30 heures",
        "description": "Bases du langage Python : structures de données, fonctions et scripts.",
        "niveau": "Débutant",
        "categorie": "Programmation",
    },
)


def _normaliser_nom(nom: str) -> str:
    sans_accents = (
        unicodedata.normalize("NFKD", nom)
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    return re.sub(r"\s+", " ", sans_accents).strip().lower()


def initialiser_donnees_exemple() -> None:
    """Garantit la présence d'Angular/Angulaire, Développement Web et Python.

    Idempotent : un cours déjà présent (nom, alias ou URI) n'est pas recréé.
    N'empêche jamais le démarrage de l'API si Fuseki est indisponible.
    """
    try:
        lignes = _select(
            PREFIXE
            + "SELECT ?cours ?nom WHERE { "
            "?cours rdf:type/rdfs:subClassOf* edu:Cours ; "
            "edu:nomCours ?nom }"
        )
    except Exception as exc:  # noqa: BLE001 - démarrage non bloquant
        logger.warning("Seed des cours ignoré (Fuseki indisponible) : %s", exc)
        return

    noms_existants = {
        _normaliser_nom(str(ligne.get("nom") or "")) for ligne in lignes
    }
    uris_existantes = {
        ecriture.nom_local(str(ligne.get("cours") or "")) for ligne in lignes
    }

    for exemple in EXEMPLES:
        noms_candidats = {_normaliser_nom(str(exemple["nom"]))}
        noms_candidats.update(
            _normaliser_nom(str(alias)) for alias in exemple["equivalents"]
        )
        identifiant = str(exemple["id"])
        if noms_candidats & noms_existants or identifiant in uris_existantes:
            continue

        try:
            donnees = CoursEntree(
                nom=str(exemple["nom"]),
                duree=str(exemple["duree"]),
                description=str(exemple["description"]),
                niveau=str(exemple["niveau"]),
                categorie=str(exemple["categorie"]),
            )
            _update(
                f"INSERT DATA {{\n{_triplets_cours(identifiant, donnees)}\n}}"
            )
            noms_existants.add(_normaliser_nom(str(exemple["nom"])))
            uris_existantes.add(identifiant)
            logger.info("Cours d'exemple créé : %s", exemple["nom"])
        except Exception as exc:  # noqa: BLE001 - démarrage non bloquant
            logger.warning(
                "Création du cours d'exemple « %s » impossible : %s",
                exemple.get("nom"),
                exc,
            )
