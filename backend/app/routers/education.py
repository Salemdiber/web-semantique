"""API REST « éducation » : expose l'ontologie via des requêtes SPARQL
interprétées par Apache Jena Fuseki, et permet d'administrer les évaluations
et les certifications (création, modification, suppression).
"""
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app import ontologie_ecriture as ecriture
from app import quiz as quiz_stockage
from app.routers.auth import utilisateur_courant

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
    evaluations_etudiant,
)
from app.sparql_client import FusekiClient, FusekiError

router = APIRouter(prefix="/education", tags=["Éducation"])

client = FusekiClient()

PREFIX = """PREFIX edu: <http://example.org/education-formation#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
"""

EDU = "http://example.org/education-formation#"
OWL_NS = "http://www.w3.org/2002/07/owl#"
RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#"

TYPES_EVALUATION = {
    "Evaluation": "Évaluation",
    "Examen": "Examen",
    "Quiz": "Quiz",
}

TYPES_CERTIFICATION = {
    "Certification": "Certification",
    "CertificationProfessionnelle": "Certification professionnelle",
    "CertificationTechnique": "Certification technique",
    "CertificationCompetence": "Certification de compétence",
}

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


def acces_encadrant(
    utilisateur: Annotated[dict[str, Any], Depends(utilisateur_courant)],
) -> dict[str, Any]:
    """Les listes nominatives sont réservées aux admins et formateurs."""
    if utilisateur.get("role") not in ("admin", "formateur"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Réservé aux administrateurs et aux formateurs",
        )
    return utilisateur


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
async def lister_evaluations(
    _: Annotated[dict[str, Any], Depends(acces_encadrant)],
) -> list[dict[str, Any]]:
    """Liste complète réservée aux encadrants : un étudiant passe par
    `/mes-evaluations` pour ne voir que ses propres résultats.
    """
    return _annoter_quiz(_fusionner_evaluations(exec_(EVALUATIONS)))


@router.get(
    "/mes-evaluations",
    summary="Mes évaluations et quiz (étudiant connecté)",
)
def mes_evaluations(
    utilisateur: Annotated[dict[str, Any], Depends(utilisateur_courant)],
) -> list[dict[str, Any]]:
    """Un étudiant ne voit que les évaluations qui lui sont attribuées.

    L'individu OWL du compte est `edu:compte_<id>` (voir `ontologie_sync`).
    """
    if utilisateur.get("role") != "etudiant":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Réservé aux étudiants",
        )
    individu = _individu_etudiant(utilisateur)
    fiches = _fusionner_evaluations(exec_(evaluations_etudiant(individu)))
    return _annoter_quiz(fiches, int(utilisateur["id"]))


def _individu_etudiant(utilisateur: dict[str, Any]) -> str:
    """Retrouve l'individu OWL du compte (`compte_<id>`, sinon par e-mail)."""
    candidat = f"compte_{int(utilisateur['id'])}"
    if exec_(PREFIX + f"SELECT ?p WHERE {{ <{EDU}{candidat}> ?p ?o }} LIMIT 1"):
        return candidat
    email = ecriture.echapper(str(utilisateur.get("email", "")))
    rows = exec_(
        PREFIX + f'SELECT ?s WHERE {{ ?s edu:email "{email}" }} LIMIT 1'
    )
    if rows:
        return ecriture.nom_local(rows[0].get("s"))
    return candidat


def _fusionner_evaluations(
    rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Fusionne les lignes SPARQL d'une même évaluation (types multiples)."""
    fiches: dict[str, dict[str, Any]] = {}
    for row in rows:
        fiche = row_to_evaluation(row)
        ancienne = fiches.get(fiche["id"])
        if ancienne is None:
            fiches[fiche["id"]] = fiche
            continue
        for cle, valeur in fiche.items():
            if valeur is None or valeur == "":
                continue
            actuelle = ancienne.get(cle)
            if (
                actuelle is None
                or actuelle == ""
                or (cle == "type" and actuelle == "Évaluation")
            ):
                ancienne[cle] = valeur
    return list(fiches.values())


def _annoter_quiz(
    fiches: list[dict[str, Any]], utilisateur_id: int | None = None
) -> list[dict[str, Any]]:
    """Ajoute l'état du questionnaire et de la tentative à chaque quiz.

    Pour un étudiant, un quiz sans tentative est forcément « à faire » : la
    note éventuellement présente dans l'ontologie est ignorée. Une évaluation
    quiz n'est donc validée qu'après un passage réel dans l'interface.
    """
    for fiche in fiches:
        if fiche.get("type") != "Quiz":
            fiche["quizQuestions"] = 0
            fiche["quizPasse"] = None
            continue
        fiche["quizQuestions"] = quiz_stockage.compter_questions(fiche["id"])
        if utilisateur_id is None:
            fiche["quizPasse"] = None
            continue
        tentative = quiz_stockage.tentative(fiche["id"], utilisateur_id)
        fiche["quizPasse"] = tentative is not None
        if tentative is None:
            fiche["note"] = None
            fiche["reussi"] = None
        else:
            fiche["note"] = tentative["note"]
            fiche["reussi"] = tentative["note"] >= fiche["noteMin"]
    return fiches


@router.get("/certifications", summary="Lister les certifications")
async def lister_certifications() -> list[dict[str, Any]]:
    return [row_to_certification(r) for r in exec_(CERTIFICATIONS)]


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


def nombre(valeur: Any) -> float | None:
    """Convertit un littéral SPARQL en nombre (None si absent/invalide)."""
    if valeur is None or valeur == "":
        return None
    try:
        return float(str(valeur).replace(",", "."))
    except ValueError:
        return None


def row_to_evaluation(row: dict[str, Any]) -> dict[str, Any]:
    cours_nom = row.get("coursNom") or "Cours non précisé"
    type_eval = row.get("typeLabel") or "Évaluation"
    note = nombre(row.get("noteObtenue"))
    note_min_saisie = nombre(row.get("noteMinimaleReussite"))
    # Seuil effectif : 12/20 par défaut, identique à l'affichage et au calcul.
    note_min = note_min_saisie if note_min_saisie is not None else 12.0
    note_max = nombre(row.get("noteMaximale")) or 20.0
    return {
        "id": row.get("evaluation"),
        "nom": row.get("nomEvaluation") or f"{type_eval} — {cours_nom}",
        "type": type_eval,
        "cours": cours_nom,
        "coursId": row.get("cours"),
        "etudiant": row.get("etudiantNom"),
        "etudiantId": row.get("etudiant"),
        "competence": row.get("competenceNom"),
        "competenceId": row.get("competence"),
        "date": row.get("dateEvaluation"),
        "noteMax": note_max,
        "noteMin": note_min,
        "note": note,
        # Une évaluation sans note est « à faire », jamais « échouée ».
        "reussi": None if note is None else note >= note_min,
    }


def row_to_certification(row: dict[str, Any]) -> dict[str, Any]:
    seuil = nombre(row.get("noteMinimaleCertification"))
    return {
        "id": row.get("certification"),
        "nom": row.get("nom"),
        "organisme": row.get("organisme"),
        "type": row.get("typeLabel") or "Certification",
        "formation": row.get("formationNom"),
        "formationId": row.get("formation"),
        "competence": row.get("competenceNom"),
        "competenceId": row.get("competence"),
        "evaluationId": row.get("evaluation"),
        "evaluationNom": row.get("evaluationNom"),
        "seuil": seuil,
        "dateObtention": row.get("dateObtention"),
        "etudiants": split(row.get("etudiantNoms")),
        "etudiantIds": [
            ecriture.nom_local(x) for x in split(row.get("etudiants"))
        ],
    }


