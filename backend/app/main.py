"""Point d'entrée de l'API FastAPI.

Lancement :
    uvicorn app.main:app --reload --port 8000
"""
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config, db
from app import parcours_stockage
from app import quiz as stockage_quiz
from app.routers import auth, courses, education, gestion, ontologie, parcours, referentiel
from app.routers import quiz as routeur_quiz


@asynccontextmanager
async def cycle_de_vie(_: FastAPI):
    """Prépare les tables SQLite (comptes, quiz, parcours) et l'administrateur initial."""
    db.initialiser()
    stockage_quiz.initialiser()
    parcours_stockage.initialiser()
    # Non bloquant : Fuseki peut être indisponible au démarrage.
    threading.Thread(
        target=courses.initialiser_donnees_exemple,
        name="seed-cours",
        daemon=True,
    ).start()
    yield


app = FastAPI(
    title="API Sémantique — Éducation & Formation",
    description=(
        "API REST construite sur le serveur Apache Jena Fuseki. "
        "Les données proviennent de l'ontologie OWL (Protégé) interrogée "
        "en SPARQL : cours, formations, étudiants, formateurs, compétences, "
        "prérequis, évaluations, certifications, programmes et parcours "
        "d'apprentissage."
    ),
    version="1.1.0",
    lifespan=cycle_de_vie,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# `parcours.router` est monté avant `education.router` pour la priorité de `/education/parcours/*`
app.include_router(parcours.router, prefix=config.API_PREFIX)
app.include_router(courses.router, prefix=config.API_PREFIX)
app.include_router(education.router, prefix=config.API_PREFIX)
app.include_router(referentiel.router, prefix=config.API_PREFIX)
app.include_router(gestion.router, prefix=config.API_PREFIX)
app.include_router(routeur_quiz.router, prefix=config.API_PREFIX)
app.include_router(ontologie.router, prefix=config.API_PREFIX)
app.include_router(auth.router, prefix=config.API_PREFIX)


@app.get("/", tags=["Système"])
def racine() -> dict[str, str]:
    return {
        "message": "API Sémantique Éducation & Formation",
        "docs": "/docs",
        "sante": f"{config.API_PREFIX}/education/sante",
    }
