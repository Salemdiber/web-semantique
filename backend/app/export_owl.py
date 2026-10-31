"""Export des comptes utilisateurs vers le fichier OWL d'origine.

Chaque compte `etudiant` ou `formateur` est écrit comme individu nommé
`edu:compte_<id>` dans `education_formation_protege.owl`. Les blocs déjà
générés sont remplacés à chaque appel (idempotent), les autres parties du
fichier ne sont pas modifiées.

Utilisé automatiquement par l'API après chaque inscription, changement de
rôle ou suppression, et par le script `scripts/exporter_utilisateurs_owl.py`.
"""
from __future__ import annotations

import logging
import os
import re
import shutil
import threading
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from app import config, db

EDU = "http://example.org/education-formation#"
TYPES_ROLE = {
    "etudiant": "Etudiant",
    "formateur": "Formateur",
}

_EDU = re.escape(EDU)

# Bloc complet, avec son commentaire facultatif, pour un compte donné.
MOTIF_COMPTE_COMPILE = re.compile(
    r"\n?[ \t]*<!--\s*" + _EDU + r"compte_\d+\s*-->\s*\n?"
    r"[ \t]*<owl:NamedIndividual rdf:about=\"" + _EDU + r"compte_\d+\">"
    r".*?</owl:NamedIndividual>\n?",
    re.S,
)
MOTIF_BLOC_SEUL_COMPILE = re.compile(
    r"\n?[ \t]*<owl:NamedIndividual rdf:about=\"" + _EDU + r"compte_\d+\">"
    r".*?</owl:NamedIndividual>\n?",
    re.S,
)

# Évite deux écritures simultanées du même fichier (requêtes FastAPI en threads).
_verrou = threading.Lock()
logger = logging.getLogger("uvicorn.error")


class ExportOwlErreur(Exception):
    """Erreur d'export (fichier absent, XML invalide, écriture impossible)."""


def _bloc(utilisateur: dict[str, Any]) -> str:
    identifiant = utilisateur["id"]
    nom = escape(str(utilisateur["nom"]), {'"': "&quot;"})
    email = escape(str(utilisateur["email"]), {'"': "&quot;"})
    classe = TYPES_ROLE[utilisateur["role"]]
    return (
        f"    <!-- {EDU}compte_{identifiant} -->\n\n"
        f'    <owl:NamedIndividual rdf:about="{EDU}compte_{identifiant}">\n'
        f'        <rdf:type rdf:resource="{EDU}{classe}"/>\n'
        f"        <email>{email}</email>\n"
        f"        <nom>{nom}</nom>\n"
        f"        <prenom>{nom}</prenom>\n"
        f'        <rdfs:label xml:lang="fr">{nom}</rdfs:label>\n'
        f"    </owl:NamedIndividual>\n"
    )


def exporter(chemin: Path | str | None = None) -> dict[str, Any]:
    """Réécrit les individus des comptes dans le fichier OWL.

    Renvoie un bilan : fichier, nombre de comptes exportés, blocs remplacés.
    Lève `ExportOwlErreur` en cas de problème ; le fichier n'est alors pas
    modifié (écriture atomique via un fichier temporaire).
    """
    fichier = Path(chemin) if chemin else Path(config.OWL_PATH)

    with _verrou:
        if not fichier.exists():
            raise ExportOwlErreur(f"Fichier OWL introuvable : {fichier}")

        comptes = [
            utilisateur
            for utilisateur in db.lister()
            if utilisateur["role"] in TYPES_ROLE
        ]

        # newline="" : on conserve les fins de ligne d'origine.
        with fichier.open("r", encoding="utf-8", newline="") as flux:
            texte = flux.read()

        texte, nb_commentes = MOTIF_COMPTE_COMPILE.subn("", texte)
        texte, nb_isoles = MOTIF_BLOC_SEUL_COMPILE.subn("", texte)

        if "</rdf:RDF>" not in texte:
            raise ExportOwlErreur(
                f"Balise </rdf:RDF> absente de {fichier} : fichier inattendu."
            )

        # Insertion déterministe : les blocs générés restent en fin de fichier,
        # séparés par exactement une ligne vide (pas d'accumulation).
        avant, apres = texte.split("</rdf:RDF>", 1)
        nouveaux = "\n".join(_bloc(utilisateur) for utilisateur in comptes)
        avant = avant.rstrip()
        texte = (
            avant
            + "\n\n"
            + (nouveaux + "\n" if nouveaux else "")
            + "</rdf:RDF>"
            + apres
        )

        try:
            ET.fromstring(texte)
        except ET.ParseError as exc:
            raise ExportOwlErreur(f"XML invalide après export : {exc}") from exc

        temporaire = fichier.with_name(fichier.name + ".tmp")
        try:
            shutil.copyfile(fichier, fichier.with_suffix(fichier.suffix + ".bak"))
            with temporaire.open("w", encoding="utf-8", newline="") as flux:
                flux.write(texte)
            os.replace(temporaire, fichier)
        except OSError as exc:
            temporaire.unlink(missing_ok=True)
            raise ExportOwlErreur(f"Écriture impossible : {exc}") from exc

        return {
            "fichier": str(fichier),
            "comptes": len(comptes),
            "blocs_remplaces": nb_commentes + nb_isoles,
        }


def exporter_sans_erreur() -> dict[str, Any] | None:
    """Variante pour l'API : journalise l'échec sans interrompre la requête."""
    try:
        return exporter()
    except ExportOwlErreur as exc:
        logger.warning("Export OWL impossible : %s", exc)
        return None
