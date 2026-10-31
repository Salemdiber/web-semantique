"""Passage et administration des quiz.

Côté étudiant :
- `GET  /education/quiz/{id}`            : questionnaire (sans les réponses)
- `POST /education/quiz/{id}/soumettre`  : correction automatique + note

Côté encadrant :
- `GET  /education/quiz/{id}/questions`  : questionnaire complet
- `PUT  /education/quiz/{id}/questions`  : remplacement du questionnaire
- `DELETE /education/quiz/{id}/tentatives` : remise à zéro des tentatives

La note d'un quiz n'est jamais saisie à la main : elle est calculée à partir
des réponses puis écrite dans l'ontologie (`edu:noteObtenue`), ce qui rend
l'évaluation réellement validée.
"""
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator, model_validator

from app import ontologie_ecriture as ecriture
from app import quiz as stockage
from app.routers.auth import utilisateur_courant
from app.routers.education import (
    EDU,
    PREFIX,
    _fusionner_evaluations,
    _individu_etudiant,
    exec_,
)
from app.routers.gestion import exiger_edition

router = APIRouter(prefix="/education", tags=["Quiz"])


# ------------------------------------------------------------- schémas -----
class QuestionEntree(BaseModel):
    enonce: str = Field(min_length=3, max_length=500)
    choix: list[str] = Field(min_length=2, max_length=6)
    bonne_reponse: int = Field(ge=0)
    points: float = Field(default=1, gt=0, le=100)

    @field_validator("choix")
    @classmethod
    def choix_valides(cls, valeur: list[str]) -> list[str]:
        propres = [choix.strip() for choix in valeur if choix and choix.strip()]
        if len(propres) < 2:
            raise ValueError("Au moins deux choix non vides sont requis")
        return propres

    @model_validator(mode="after")
    def bonne_reponse_valide(self) -> "QuestionEntree":
        if self.bonne_reponse >= len(self.choix):
            raise ValueError(
                "La bonne réponse doit désigner l'un des choix proposés"
            )
        return self


class QuestionsEntree(BaseModel):
    questions: list[QuestionEntree] = Field(min_length=1, max_length=50)


class ReponseEntree(BaseModel):
    question_id: int
    choix: int = Field(ge=0, le=5)


class SoumissionEntree(BaseModel):
    reponses: list[ReponseEntree] = Field(min_length=1, max_length=50)


# ------------------------------------------------------------------ utils ---
def _evaluation(evaluation_id: str) -> dict[str, Any]:
    """Fiche d'une évaluation, avec vérification qu'il s'agit bien d'un quiz."""
    nom = ecriture.nom_local(evaluation_id)
    rows = exec_(
        PREFIX
        + f"""
    SELECT ?evaluation ?typeLabel ?cours ?coursNom ?etudiant ?etudiantNom
           ?nomEvaluation ?dateEvaluation ?noteMaximale
           ?noteMinimaleReussite ?noteObtenue
    WHERE {{
        BIND (<{EDU}{nom}> AS ?evaluation)
        OPTIONAL {{
            ?evaluation rdf:type ?typedirect .
            ?typedirect rdfs:subClassOf edu:Evaluation .
            FILTER (?typedirect != edu:Evaluation)
            OPTIONAL {{ ?typedirect rdfs:label ?typeLabel }}
        }}
        OPTIONAL {{ ?evaluation edu:nomEvaluation ?nomEvaluation }}
        OPTIONAL {{ ?evaluation edu:dateEvaluation ?dateEvaluation }}
        OPTIONAL {{ ?evaluation edu:noteMaximale ?noteMaximale }}
        OPTIONAL {{
            ?evaluation edu:noteMinimaleReussite ?noteMinimaleReussite
        }}
        OPTIONAL {{ ?evaluation edu:noteObtenue ?noteObtenue }}
        OPTIONAL {{
            ?evaluation edu:porteSur ?cours .
            OPTIONAL {{ ?cours edu:nomCours ?coursNom }}
        }}
        OPTIONAL {{
            ?evaluation edu:evalue ?etudiant .
            OPTIONAL {{ ?etudiant edu:prenom ?etudiantNom }}
        }}
    }}
    """
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")
    fiche = _fusionner_evaluations(rows)[0]
    if fiche.get("type") != "Quiz":
        raise HTTPException(
            status_code=400, detail="Cette évaluation n'est pas un quiz"
        )
    return fiche


def _verifier_proprietaire(
    fiche: dict[str, Any], utilisateur: dict[str, Any]
) -> None:
    """Un étudiant ne peut passer que le quiz qui lui est attribué."""
    if utilisateur.get("role") != "etudiant":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Réservé aux étudiants",
        )
    individu = _individu_etudiant(utilisateur)
    if fiche.get("etudiantId") != individu:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce quiz ne vous est pas attribué",
        )


def _ecrire_note(evaluation_id: str, note: float) -> None:
    """Écrit la note calculée dans l'ontologie (source de vérité sémantique)."""
    try:
        ecriture.executer(
            f"DELETE WHERE {{ <{EDU}{evaluation_id}> "
            f"<{EDU}noteObtenue> ?n }} ;\n"
            f"INSERT DATA {{ <{EDU}{evaluation_id}> "
            f"<{EDU}noteObtenue> {note} }}"
        )
    except ecriture.EcritureError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Écriture de la note impossible : {exc}",
        ) from exc


# ------------------------------------------------------- côté étudiant ------
@router.get(
    "/quiz/{evaluation_id}",
    summary="Questionnaire d'un quiz attribué à l'étudiant connecté",
)
def detail_quiz(
    evaluation_id: str,
    utilisateur: Annotated[dict[str, Any], Depends(utilisateur_courant)],
) -> dict[str, Any]:
    fiche = _evaluation(evaluation_id)
    _verifier_proprietaire(fiche, utilisateur)
    tentative = stockage.tentative(fiche["id"], int(utilisateur["id"]))
    return {
        "evaluationId": fiche["id"],
        "nom": fiche["nom"],
        "cours": fiche["cours"],
        "noteMax": fiche["noteMax"],
        "noteMin": fiche["noteMin"],
        "questions": stockage.lister_questions(fiche["id"]),
        "tentative": tentative,
        "dejaReussi": bool(
            tentative and tentative["note"] >= fiche["noteMin"]
        ),
    }


@router.post(
    "/quiz/{evaluation_id}/soumettre",
    summary="Corriger un quiz et enregistrer la note",
)
def soumettre_quiz(
    evaluation_id: str,
    donnees: SoumissionEntree,
    utilisateur: Annotated[dict[str, Any], Depends(utilisateur_courant)],
) -> dict[str, Any]:
    fiche = _evaluation(evaluation_id)
    _verifier_proprietaire(fiche, utilisateur)

    questions = stockage.lister_questions(fiche["id"], avec_reponses=True)
    if not questions:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce quiz n'a pas encore de questions : contactez le formateur.",
        )
    tentative = stockage.tentative(fiche["id"], int(utilisateur["id"]))
    if tentative and tentative["note"] >= fiche["noteMin"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vous avez déjà réussi ce quiz.",
        )

    par_question = {question["id"]: question for question in questions}
    reponses: dict[str, int] = {}
    for reponse in donnees.reponses:
        question = par_question.get(reponse.question_id)
        if question is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Réponse associée à une question inconnue",
            )
        if str(reponse.question_id) in reponses:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Une question ne peut recevoir qu'une seule réponse",
            )
        if reponse.choix >= len(question["choix"]):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Choix de réponse invalide",
            )
        reponses[str(reponse.question_id)] = reponse.choix

    if len(reponses) != len(questions):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Répondez à toutes les questions avant de valider.",
        )

    score = sum(
        question["points"]
        for question in questions
        if reponses[str(question["id"])] == question["bonneReponse"]
    )
    total = sum(question["points"] for question in questions)
    note = round((score / total) * fiche["noteMax"], 2) if total > 0 else 0.0

    resultat = stockage.enregistrer_tentative(
        fiche["id"],
        int(utilisateur["id"]),
        note,
        score,
        total,
        reponses,
    )
    _ecrire_note(fiche["id"], resultat["note"])

    return {
        "evaluationId": fiche["id"],
        "note": resultat["note"],
        "noteMax": fiche["noteMax"],
        "noteMin": fiche["noteMin"],
        "score": resultat["score"],
        "total": resultat["total"],
        "reussi": resultat["note"] >= fiche["noteMin"],
        "tentatives": resultat["tentatives"],
        "corrections": [
            {
                "questionId": question["id"],
                "choix": reponses[str(question["id"])],
                "bonneReponse": question["bonneReponse"],
                "correcte": reponses[str(question["id"])]
                == question["bonneReponse"],
            }
            for question in questions
        ],
    }


# ------------------------------------------------------ côté encadrant -----
@router.get(
    "/quiz/{evaluation_id}/questions",
    summary="Questionnaire complet d'un quiz (administrateur/formateur)",
)
def questions_quiz(
    evaluation_id: str,
    _: Annotated[dict[str, Any], Depends(exiger_edition)],
) -> dict[str, Any]:
    fiche = _evaluation(evaluation_id)
    return {
        "evaluationId": fiche["id"],
        "nom": fiche["nom"],
        "questions": stockage.lister_questions(
            fiche["id"], avec_reponses=True
        ),
        "tentatives": stockage.nombre_tentatives(fiche["id"]),
    }


@router.put(
    "/quiz/{evaluation_id}/questions",
    summary="Remplacer le questionnaire d'un quiz (administrateur/formateur)",
)
def enregistrer_questions(
    evaluation_id: str,
    donnees: QuestionsEntree,
    _: Annotated[dict[str, Any], Depends(exiger_edition)],
) -> dict[str, Any]:
    fiche = _evaluation(evaluation_id)
    questions = stockage.remplacer_questions(
        fiche["id"], [question.model_dump() for question in donnees.questions]
    )
    return {
        "evaluationId": fiche["id"],
        "questions": questions,
    }


@router.delete(
    "/quiz/{evaluation_id}/tentatives",
    summary="Réinitialiser les tentatives d'un quiz (administrateur/formateur)",
)
def reinitialiser_quiz(
    evaluation_id: str,
    _: Annotated[dict[str, Any], Depends(exiger_edition)],
) -> dict[str, Any]:
    fiche = _evaluation(evaluation_id)
    supprimees = stockage.reinitialiser_tentatives(fiche["id"])
    # On retire complètement la note : le quiz redevient « à faire ».
    try:
        ecriture.executer(
            f"DELETE WHERE {{ <{EDU}{fiche['id']}> <{EDU}noteObtenue> ?n }}"
        )
    except ecriture.EcritureError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Réinitialisation impossible : {exc}",
        ) from exc
    return {"statut": "reinitialise", "tentatives_supprimees": supprimees}
