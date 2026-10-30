"""Chargement et administration de l'ontologie OWL dans Jena Fuseki."""
import xml.etree.ElementTree  # noqa: F401 (validation basique du contenu RDF/XML)

import requests
from fastapi import APIRouter, HTTPException, UploadFile

from app import config
from app.queries import HIERARCHIE
from app.sparql_client import FusekiClient, FusekiError

router = APIRouter(prefix="/ontologie", tags=["Ontologie"])

client = FusekiClient()


def _graph_store_url(graph: str = "default") -> str:
    pour_default = graph == "default"
    cible = "?default" if pour_default else f"?graph={graph}"
    return f"{config.FUSEKI_URL}/{config.FUSEKI_DATASET}/data{cible}"


def _envoyer_owl(contenu: bytes, graph: str = "urn:default") -> None:
    """Envoie le OWL dans Fuseki via le protocole Graph Store (PUT = remplace)."""
    url = _graph_store_url(graph)
    response = requests.put(
        url,
        data=contenu,
        headers={"Content-Type": "application/rdf+xml"},
        auth=(config.FUSEKI_USER, config.FUSEKI_PASSWORD) if config.FUSEKI_USER else None,  # noqa: E501
        timeout=60,
    )
    if response.status_code not in (200, 201, 204):
        raise FusekiError(
            f"Échec du chargement ({response.status_code}) : {response.text[:300]}"
        )
    # L'inférence OWL côté Fuseki nécessite éventuellement le dataset "with inference"
    # (UI Fuseki). Le formulaire UI utilisera le dataset ad hoc.


@router.post("/charger", summary="Charger le fichier OWL local dans Fuseki")
async def charger_owl_local() -> dict[str, str]:
    chemin = config.OWL_PATH
    if not chemin.exists():
        raise HTTPException(status_code=404, detail=f"Fichier introuvable : {chemin}")
    _envoyer_owl(chemin.read_bytes())
    return {"statut": "chargé", "fichier": str(chemin)}


@router.post("/televerser", summary="Téléverser un fichier OWL (.owl) via l'UI")
async def televerser(fichier: UploadFile) -> dict[str, str]:
    if not fichier.filename.endswith((".owl", ".rdf", ".xml")):
        raise HTTPException(status_code=400, detail="Extension .owl/.rdf attendue")
    contenu = await fichier.read()
    _envoyer_owl(contenu)
    return {"statut": "chargé", "fichier": fichier.filename}


@router.get("/prerequis-competences", summary="Chaîne complète prérequis → cours → compétences")
def prerequis_competences() -> list[dict]:
    query = """
    PREFIX edu: <http://example.org/education-formation#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT ?coursNom ?prerequisNom ?prerequisCompetence ?competenceNom ?competenceNiveau ?duree
    WHERE {
        ?cours rdf:type/rdfs:subClassOf* edu:Cours .
        ?cours edu:nomCours ?coursNom .
        OPTIONAL { ?cours edu:dureeCours ?duree }
        OPTIONAL {
            ?cours edu:aPourPrerequis ?prerequis.
            ?prerequis edu:descriptionPrerequis ?prerequisNom .
            OPTIONAL { ?prerequis edu:necessiteCompetence ?pc.
                       ?pc edu:nomCompetence ?prerequisCompetence }
        }
        OPTIONAL {
            ?cours edu:developpeCompetence ?comp.
            ?comp edu:nomCompetence ?competenceNom .
            OPTIONAL { ?comp edu:niveauCompetence ?competenceNiveau }
        }
    }
    ORDER BY ?coursNom
    """
    try:
        return client.select(query)
    except FusekiError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/hierarchie-classes", summary="Arbre des classes OWL")
def hierarchie_classes() -> list[dict]:
    try:
        return client.select(HIERARCHIE)
    except FusekiError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
