"""API REST « éducation » : expose l'ontologie via des requêtes SPARQL
interprétées par Apache Jena Fuseki."""
from typing import Any

from fastapi import APIRouter, HTTPException

from app.queries import (
    CERTIFICATIONS,
    COMPETENCES,
    COURS_LISTE,
    ETUDIANTS,
    EVALUATIONS,
    FORMATEURS,
    FORMATIONS,
    HIERARCHIE,
    PARCOURS,
    PROGRAMMES,
    STATISTIQUES,
)
from app.sparql_client import FusekiClient, FusekiError

router = APIRouter(prefix="/education", tags=["Éducation"])

client = FusekiClient()

PREFIX = """PREFIX edu: <http://example.org/education-formation#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
"""

CLASSES_TOP: dict[str, str] = {
    "Etudiant": "Étudiant",
    "Formateur": "Formateur",
    "Cours": "Cours",
    "Formation": "Formation",
    "Competence": "Compétence",
    "Prerequis": "Prérequis",
    "Evaluation": "Évaluation",
    "Certification": "Certification",
    "ProgrammePedagogique": "Programme Pédagogique",
    "ParcoursApprentissage": "Parcours d'Apprentissage",
}


def row_to_cours(row: dict[str, Any]) -> dict[str, Any]:
    """Transforme une ligne SPARQL en objet cours exploitable côté React."""
    split = lambda v: [x for x in (v or "").split("|") if x]  # noqa: E731
    return {
        "id": row.get("cours"),
        "nom": row.get("nom"),
        "duree": row.get("duree") or "Durée non précisée",
        "description": row.get("description"),
        "type": row.get("typeLabel") or "Cours",
        "prerequis": split(row.get("prerequis")),
        "competences": split(row.get("competences")),
        "formateurs": split(row.get("formateurs")),
    }


@router.get("/sante", summary="Vérifier l'accès à Fuseki et au dataset")
def sante() -> dict[str, Any]:
    try:
        rows = client.select(
            """PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            SELECT (COUNT(DISTINCT ?s) AS ?nb) WHERE { ?s ?p ?o }""")  # noqa: E501
        return {"statut": "ok", "dataset": nb_rows(rows)}
    except FusekiError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def nb_rows(rows: list[dict[str, Any]]) -> Any:
    return rows[0].get("nb") if rows else 0


@router.get("/cours", summary="Lister tous les cours de l'ontologie")
async def lister_cours() -> list[dict[str, Any]]:
    return [row_to_cours(row) for row in exec_(COURS_LISTE)]


@router.get("/etudiants", summary="Lister les étudiants")
async def lister_etudiants() -> list[dict[str, Any]]:
    return [row_to_etudiant(row) for row in exec_(ETUDIANTS)]


@router.get("/formateurs", summary="Lister les formateurs")
async def lister_formateurs() -> list[dict[str, Any]]:
    return [row_to_formateur(row) for row in exec_(FORMATEURS)]


@router.get("/formations", summary="Lister les formations")
async def lister_formations() -> list[dict[str, Any]]:
    return [row_to_formation(row) for row in exec_(FORMATIONS)]


@router.get("/competences", summary="Lister les compétences")
async def lister_competences() -> list[dict[str, Any]]:
    return [row_to_competence(row) for row in exec_(COMPETENCES)]


@router.get("/programmes", summary="Lister les programmes pédagogiques")
async def lister_programmes() -> list[dict[str, Any]]:
    return [
        {
            "id": r["programme"],
            "nom": r.get("nom"),
            "annee": r.get("annee"),
            "formations": split(r.get("formations")),
        }
        for r in exec_(PROGRAMMES)
    ]


@router.get("/parcours", summary="Lister les parcours d'apprentissage")
async def lister_parcours() -> list[dict[str, Any]]:
    return [
        {
            "id": r["parcours"],
            "type": r.get("typeLabel"),
            "cours": split(r.get("cours")),
        }
        for r in exec_(PARCOURS)
    ]


@router.get("/evaluations", summary="Lister les évaluations (examens, quiz)")
async def lister_evaluations() -> list[dict[str, Any]]:
    return [row_to_evaluation(r) for r in exec_(EVALUATIONS)]


@router.get("/certifications", summary="Lister les certifications")
async def lister_certifications() -> list[dict[str, Any]]:
    return [
        {
            "id": r["certification"],
            "nom": r.get("nom"),
            "organisme": r.get("organisme"),
            "type": r.get("typeLabel"),
            "formation": r.get("formationNom"),
            "etudiants": split(r.get("etudiantNom")),
        }
        for r in exec_(CERTIFICATIONS)
    ]


@router.get("/statistiques", summary="Compteurs par classe de l'ontologie")
async def statistiques() -> list[dict[str, Any]]:
    rows = exec_(STATISTIQUES)
    return [
        {
            "classe": r.get("classe"),
            "nom": r.get("nomClasse"),
            "nombre": int(r.get("nombre", 0)),
        }
        for r in rows
    ]


@router.get("/hierarchie", summary="Hiérarchie des classes (arbre OWL)")
async def hierarchie() -> list[dict[str, Any]]:
    return [
        {
            "id": r.get("sousClasse"),
            "sousClasse": r.get("labelSousClasse"),
            "classeParente": r.get("classeParente"),
            "labelParent": r.get("labelParent"),
        }
        for r in exec_(HIERARCHIE)
    ]


@router.get(
    "/types-inferes",
    summary=(
        "Comptage par classe via rdf:type direct (l'inférence OWL de Fuseki "
        "rattache automatiquement les individus des sous-classes)"
    ),
)
async def types_inferes() -> list[dict[str, Any]]:
    """Compare rdf:type direct (raisonneur OWL Fuseki) au parcours
    rdfs:subClassOf*. Si raison = True, le raisonneur OWL est actif.
    """
    requete_reasoner = PREFIX + """
        SELECT ?classe ?nomClasse (COUNT(DISTINCT ?individu) AS ?nombre)
        WHERE {
            VALUES ?classe { @CELLULES }
            ?classe rdfs:label ?nomClasse .
            ?individu rdf:type ?classe .
        }
        GROUP BY ?classe ?nomClasse
    """
    requete_arbre = PREFIX + """
        SELECT ?classe (COUNT(DISTINCT ?individu) AS ?nombre)
        WHERE {
            VALUES ?classe { @CELLULES }
            ?individu rdf:type/rdfs:subClassOf* ?classe .
        }
        GROUP BY ?classe
    """
    cellules = " ".join(f"edu:{c}" for c in CLASSES_TOP)
    try:
        par_raisonneur = {
            r.get("classe"): r.get("nombre")
            for r in exec_(requete_reasoner.replace("@CELLULES", cellules))
        }
        par_arbre = {
            r.get("classe"): r.get("nombre")
            for r in exec_(requete_arbre.replace("@CELLULES", cellules))
        }
    except FusekiError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    resultat = [
        {
            "classe": classe,
            "nom": nom,
            "nombre_rdf_type_direct": int(par_raisonneur.get(classe, 0) or 0),
            "nombre_avec_sous_classes": int(par_arbre.get(classe, 0) or 0),
            "raisonneur_actif": (
                int(par_raisonneur.get(classe, 0) or 0)
                >= int(par_arbre.get(classe, 0) or 0)
                and int(par_arbre.get(classe, 0) or 0) > 0
            ),
        }
        for classe, nom in CLASSES_TOP.items()
    ]
    # Tri décroissant sur le compteur principal
    resultat.sort(
        key=lambda c: c["nombre_avec_sous_classes"], reverse=True
    )
    return resultat


@router.get("/cours/{identifiant}", summary="Détail d'un cours (nom local)")
async def detail_cours(identifiant: str) -> dict[str, Any]:
    query = COURS_LISTE.replace(
        "?cours rdf:type/rdfs:subClassOf* edu:Cours .",
        f"""?cours rdf:type/rdfs:subClassOf* edu:Cours .
        FILTER (STRENDS(STR(?cours), "#{identifiant}")) .""",
        1,
    )
    rows = exec_(query)
    if not rows:
        raise HTTPException(status_code=404, detail="Cours non trouvé")
    return row_to_cours(rows[0])


# --------------------------------------------------------------- utils ---
def exec_(query: str) -> list[dict[str, Any]]:
    try:
        return client.select(query)
    except FusekiError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def split(v: str | None) -> list[str]:
    return [x for x in (v or "").split("|") if x]


def row_to_etudiant(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("etudiant"),
        "prenom": row.get("prenom"),
        "niveau": row.get("niveau") or "Niveau non précisé",
        "formations": split(row.get("formations")),
        "cours": split(row.get("cours")),
        "certifications": split(row.get("certifications")),
    }


def row_to_formateur(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("formateur"),
        "prenom": row.get("prenom"),
        "domaine": row.get("domaines") or "Domaine non précisé",
        "cours": split(row.get("cours")),
    }


def row_to_formation(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("formation"),
        "nom": row.get("nom"),
        "duree": row.get("duree") or "Durée non précisée",
        "programme": row.get("programmeNom"),
        "certification": row.get("certificationNom"),
        "cours": split(row.get("cours")),
        "etudiants": split(row.get("etudiants")),
    }


def row_to_competence(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("competence"),
        "nom": row.get("nom"),
        "niveau": row.get("niveau"),
        "type": row.get("typeLabel"),
        "coursDeveloppant": split(row.get("cours")),
        "necessitee": split(row.get("prerequis")),
    }


def row_to_evaluation(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("evaluation"),
        "type": row.get("typeLabel"),
        "cours": row.get("coursNom") or "Cours non précisé",
        "etudiant": row.get("etudiantNom"),
        "competence": row.get("competenceNom"),
    }
