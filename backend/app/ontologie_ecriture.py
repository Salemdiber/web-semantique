"""Écriture d'individus OWL dans Apache Jena Fuseki.

Utilisé par les modules d'administration (évaluations, certifications) pour
créer, modifier et supprimer des individus du graphe : les requêtes SPARQL
SELECT ne suffisent pas, il faut l'endpoint `/update` de Fuseki.
"""
from __future__ import annotations

import logging
import re
import uuid

import requests

from app import config

EDU = "http://example.org/education-formation#"
RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
RDFS = "http://www.w3.org/2000/01/rdf-schema#"
OWL = "http://www.w3.org/2002/07/owl#"

logger = logging.getLogger("uvicorn.error")


class EcritureError(Exception):
    """Échec d'une mise à jour SPARQL (Fuseki injoignable ou en erreur)."""


def endpoint() -> str:
    return f"{config.FUSEKI_URL}/{config.FUSEKI_DATASET}/update"


def echapper(valeur: str) -> str:
    """Échappe un littéral pour l'insérer dans une requête SPARQL."""
    return (
        str(valeur)
        .replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
    )


def executer(mise_a_jour: str) -> None:
    """Envoie une opération SPARQL Update (une ou plusieurs instructions)."""
    try:
        reponse = requests.post(
            endpoint(),
            data=mise_a_jour.encode("utf-8"),
            headers={"Content-Type": "application/sparql-update"},
            auth=(config.FUSEKI_USER, config.FUSEKI_PASSWORD),
            timeout=20,
        )
        reponse.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("Écriture SPARQL impossible (%s) : %s", endpoint(), exc)
        raise EcritureError(f"Fuseki injoignable : {exc}") from exc


def nom_local(identifiant: str) -> str:
    """Renvoie le nom local d'une URI (`.../education-formation#Python`)."""
    texte = (identifiant or "").strip()
    if not texte:
        return ""
    if "education-formation#" in texte:
        return texte.split("education-formation#")[-1]
    return texte.rsplit("#", 1)[-1].rsplit("/", 1)[-1]


def iri(nom: str) -> str:
    return f"<{EDU}{nom_local(nom)}>"


def generer_id(prefixe: str, base: str | None = None) -> str:
    """Construit un identifiant lisible et unique, ex. `Examen_Python_a1b2c3`."""
    brut = nom_local(base or "") or "individu"
    slug = re.sub(r"[^A-Za-z0-9_-]+", "_", brut).strip("_") or "individu"
    return f"{prefixe}_{slug}_{uuid.uuid4().hex[:6]}"


def supprimer_individu(nom: str) -> None:
    subject = iri(nom)
    executer(f"DELETE WHERE {{ {subject} ?p ?o . }}")


def remplacer_individu(nom: str, triplets: str) -> None:
    """Supprime tous les triplets du sujet puis insère `triplets` (tout faits)."""
    subject = iri(nom)
    executer(
        f"DELETE WHERE {{ {subject} ?p ?o . }} ;\n"
        f"INSERT DATA {{\n{triplets}\n}}"
    )
