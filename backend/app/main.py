"""Point d'entrée de l'API FastAPI.

Lancement :
    uvicorn app.main:app --reload --port 8000
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config, db
from app import quiz as stockage_quiz
from app.routers import auth, education, gestion, ontologie
from app.routers import quiz as routeur_quiz


@asynccontextmanager
async def cycle_de_vie(_: FastAPI):
    """Prépare la base des comptes et le compte administrateur initial."""
    db.initialiser()
    stockage_quiz.initialiser()
    yield


app = FastAPI(
    title="API Sémantique — Éducation & Formation",
    description=(
        "API REST construite sur le serveur Apache Jena Fuseki. "
        "Les données proviennent de l'ontologie OWL (Protégé) interrogée "
        "en SPARQL : cours, formations, étudiants, formateurs, compétences, "
        "prérequis, évaluations, certifications, programmes et parcours."
    ),
    version="1.0.0",
    lifespan=cycle_de_vie,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(education.router, prefix=config.API_PREFIX)
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
