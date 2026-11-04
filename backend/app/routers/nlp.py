"""API de traduction de questions naturelles en requêtes SPARQL."""
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.nlp_translator import TraductionNLPError, traduire_question
from app.sparql_client import FusekiClient, FusekiError

router = APIRouter(prefix="/nlp", tags=["NLP / TALN"])
client = FusekiClient()


class QuestionNLP(BaseModel):
    question: str = Field(..., min_length=2, max_length=500)
    executer: bool = Field(
        default=True,
        description="Exécute la requête traduite sur Fuseki si vrai.",
    )


@router.post("/traduire", summary="Traduire une question en SPARQL")
def traduire(question: QuestionNLP) -> dict[str, Any]:
    try:
        resultat = traduire_question(question.question)
    except TraductionNLPError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    reponse: dict[str, Any] = {
        "question": resultat.question,
        "intention": resultat.intention,
        "typeRessource": resultat.type_ressource,
        "requete": resultat.requete,
        "jetons": list(resultat.jetons),
    }
    if question.executer:
        try:
            reponse["resultats"] = client.select(resultat.requete)
        except FusekiError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
    return reponse
