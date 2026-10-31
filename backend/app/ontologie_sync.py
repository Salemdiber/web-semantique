"""Synchronisation des comptes utilisateurs vers l'ontologie OWL de Fuseki.

Chaque compte de rôle `etudiant` ou `formateur` devient un individu nommé
`edu:compte_<id>` typé `edu:Etudiant` ou `edu:Formateur`, avec les propriétés
`edu:nom`, `edu:prenom`, `edu:email` et un `rdfs:label`.

Un compte `admin` n'a pas d'équivalent dans l'ontologie : son individu est
supprimé s'il existe.

Les erreurs Fuseki ne bloquent jamais l'inscription : elles sont journalisées
et la fonction renvoie `False`.
"""
from __future__ import annotations

import logging
from typing import Any

import requests

from app import config

EDU = "http://example.org/education-formation#"
RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
RDFS = "http://www.w3.org/2000/01/rdf-schema#"
OWL = "http://www.w3.org/2002/07/owl#"

CLASSES_ROLE = {
    "etudiant": f"{EDU}Etudiant",
    "formateur": f"{EDU}Formateur",
}

logger = logging.getLogger("uvicorn.error")


def _endpoint() -> str:
    return f"{config.FUSEKI_URL}/{config.FUSEKI_DATASET}/update"


def _echapper(valeur: str) -> str:
    return (
        valeur.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
    )


def _sujet(utilisateur_id: int) -> str:
    return f"<{EDU}compte_{utilisateur_id}>"


def _executer(mise_a_jour: str) -> bool:
    try:
        reponse = requests.post(
            _endpoint(),
            data=mise_a_jour.encode("utf-8"),
            headers={"Content-Type": "application/sparql-update"},
            auth=(config.FUSEKI_USER, config.FUSEKI_PASSWORD),
            timeout=10,
        )
        reponse.raise_for_status()
        return True
    except requests.RequestException as exc:
        logger.warning(
            "Synchronisation ontologie impossible (%s) : %s",
            _endpoint(),
            exc,
        )
        return False


def synchroniser(utilisateur: dict[str, Any]) -> bool:
    """Crée, met à jour ou retire l'individu OWL correspondant au compte."""
    identifiant = int(utilisateur["id"])
    sujet = _sujet(identifiant)

    # On repart toujours d'un individu propre (idempotent).
    suppression = f"DELETE WHERE {{ {sujet} ?p ?o . }}"
    if not _executer(suppression):
        return False

    role = utilisateur.get("role")
    if role == "admin":
        # Les administrateurs ne font pas partie de l'ontologie.
        return True

    classe = CLASSES_ROLE.get(role)
    if classe is None:
        return False

    nom = _echapper(utilisateur.get("nom", ""))
    email = _echapper(utilisateur.get("email", ""))

    insertion = f"""
        INSERT DATA {{
            {sujet} a <{OWL}NamedIndividual> , <{classe}> ;
                <{RDFS}label> "{nom}"@fr ;
                <{EDU}nom> "{nom}" ;
                <{EDU}prenom> "{nom}" ;
                <{EDU}email> "{email}" .
        }}
    """
    return _executer(insertion)


def supprimer(utilisateur_id: int) -> bool:
    """Retire l'individu OWL lié à un compte supprimé."""
    return _executer(f"DELETE WHERE {{ {_sujet(utilisateur_id)} ?p ?o . }}")


def synchroniser_tous(utilisateurs: list[dict[str, Any]]) -> dict[str, Any]:
    """Resynchronise tous les comptes ; renvoie un petit bilan."""
    reussis = 0
    echecs = 0
    for utilisateur in utilisateurs:
        if synchroniser(utilisateur):
            reussis += 1
        else:
            echecs += 1
    return {
        "total": len(utilisateurs),
        "synchronises": reussis,
        "echecs": echecs,
        "fuseki": _endpoint(),
    }
