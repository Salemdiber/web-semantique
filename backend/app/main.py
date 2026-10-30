"""Point d'entrée de l'API FastAPI.

Lancement :
    uvicorn app.main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.routers import education, ontologie

app = FastAPI(
    title="API Sémantique — Éducation & Formation",
    description=(
        "API REST construite sur le serveur Apache Jena Fuseki. "
        "Les données proviennent de l'ontologie OWL (Protégé) interrogée "
        "en SPARQL : cours, formations, étudiants, formateurs, compétences, "
        "prérequis, évaluations, certifications, programmes et parcours."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(education.router, prefix=config.API_PREFIX)
app.include_router(ontologie.router, prefix=config.API_PREFIX)


@app.get("/", tags=["Système"])
def racine() -> dict[str, str]:
    return {
        "message": "API Sémantique Éducation & Formation",
        "docs": "/docs",
        "sante": f"{config.API_PREFIX}/education/sante",
    }
