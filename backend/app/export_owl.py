"""Export atomique vers le fichier OWL d'origine (`education_formation_protege.owl`).

1. Comptes utilisateurs (`exporter` / `exporter_sans_erreur`) :
   Chaque compte `etudiant` ou `formateur` est écrit comme individu nommé
   `edu:compte_<id>` (en préservant ses éventuels liens `suitCours`,
   `suitFormation`, `obtientCertification`).

2. Parcours d'apprentissage (`exporter_parcours` / `exporter_parcours_sans_erreur`) :
   Synchronise tous les individus de `ParcoursApprentissage` (`ParcoursDebutant`,
   `ParcoursAvance`) ainsi que leurs métadonnées et relations
   `edu:contientCoursParcours` depuis Fuseki vers le fichier `.owl`, avec
   validation XML stricte (`ElementTree`) et remplacement atomique.
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
CLASSES_PARCOURS = ("ParcoursApprentissage", "ParcoursDebutant", "ParcoursAvance")

_EDU = re.escape(EDU)

# Bloc complet, avec son commentaire facultatif, pour un compte donné.
MOTIF_COMPTE_COMPILE = re.compile(
    r"\n?[ \t]*<!--\s*" + _EDU + r"(compte_\d+)\s*-->\s*\n*"
    r"[ \t]*<owl:NamedIndividual rdf:about=\"" + _EDU + r"\1\">"
    r"(.*?)</owl:NamedIndividual>\n?",
    re.S,
)
MOTIF_BLOC_SEUL_COMPILE = re.compile(
    r"\n?[ \t]*<owl:NamedIndividual rdf:about=\"" + _EDU + r"(compte_\d+)\">"
    r"(.*?)</owl:NamedIndividual>\n?",
    re.S,
)

# Bloc générique d'individu nommé (avec son commentaire d'en-tête éventuel).
MOTIF_INDIVIDU_COMPILE = re.compile(
    r"\n?(?:[ \t]*<!--\s*" + _EDU + r"([^>\s]+)\s*-->\s*\n+)?"
    r"[ \t]*<owl:NamedIndividual rdf:about=\"" + _EDU + r"([^\"]+)\">"
    r"(.*?)</owl:NamedIndividual>\n?",
    re.S,
)

# Évite deux écritures simultanées du même fichier (requêtes FastAPI en threads).
_verrou = threading.Lock()
logger = logging.getLogger("uvicorn.error")


class ExportOwlErreur(Exception):
    """Erreur d'export (fichier absent, XML invalide, écriture impossible)."""


def _echapper_xml(valeur: Any) -> str:
    return escape(str(valeur), {'"': "&quot;", "'": "&apos;"})


def _ecrire_atomique(fichier: Path, texte: str) -> None:
    """Valide le RDF/XML puis remplace atomiquement le fichier `.owl`."""
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


def _extraire_liens_compte(corps_xml: str) -> list[str]:
    """Préserve les relations pédagogiques déjà présentes sur un `compte_<id>`."""
    liens: list[str] = []
    for prop in ("suitCours", "suitFormation", "obtientCertification", "enseigne"):
        for m in re.finditer(
            rf'<{prop}\s+rdf:resource="([^"]+)"\s*/>', corps_xml
        ):
            ligne = f'        <{prop} rdf:resource="{m.group(1)}"/>'
            if ligne not in liens:
                liens.append(ligne)
    return liens


def _bloc(utilisateur: dict[str, Any], liens_existants: list[str] | None = None) -> str:
    identifiant = utilisateur["id"]
    nom = _echapper_xml(utilisateur["nom"])
    email = _echapper_xml(utilisateur["email"])
    classe = TYPES_ROLE[utilisateur["role"]]
    lignes = [
        f"    <!-- {EDU}compte_{identifiant} -->\n",
        f'    <owl:NamedIndividual rdf:about="{EDU}compte_{identifiant}">',
        f'        <rdf:type rdf:resource="{EDU}{classe}"/>',
    ]
    if liens_existants:
        lignes.extend(liens_existants)
    lignes.extend(
        [
            f"        <email>{email}</email>",
            f"        <nom>{nom}</nom>",
            f"        <prenom>{nom}</prenom>",
            f'        <rdfs:label xml:lang="fr">{nom}</rdfs:label>',
            "    </owl:NamedIndividual>\n",
        ]
    )
    return "\n".join(lignes)


def exporter(chemin: Path | str | None = None) -> dict[str, Any]:
    """Réécrit les individus des comptes dans le fichier OWL."""
    fichier = Path(chemin) if chemin else Path(config.OWL_PATH)

    with _verrou:
        if not fichier.exists():
            raise ExportOwlErreur(f"Fichier OWL introuvable : {fichier}")

        comptes = [
            utilisateur
            for utilisateur in db.lister()
            if utilisateur["role"] in TYPES_ROLE
        ]

        with fichier.open("r", encoding="utf-8", newline="") as flux:
            texte = flux.read()

        liens_par_compte: dict[str, list[str]] = {}
        for m in MOTIF_COMPTE_COMPILE.finditer(texte):
            liens_par_compte[m.group(1)] = _extraire_liens_compte(m.group(2))
        for m in MOTIF_BLOC_SEUL_COMPILE.finditer(texte):
            if m.group(1) not in liens_par_compte:
                liens_par_compte[m.group(1)] = _extraire_liens_compte(m.group(2))

        texte, nb_commentes = MOTIF_COMPTE_COMPILE.subn("", texte)
        texte, nb_isoles = MOTIF_BLOC_SEUL_COMPILE.subn("", texte)

        if "</rdf:RDF>" not in texte:
            raise ExportOwlErreur(
                f"Balise </rdf:RDF> absente de {fichier} : fichier inattendu."
            )

        avant, apres = texte.split("</rdf:RDF>", 1)
        nouveaux = "\n".join(
            _bloc(u, liens_par_compte.get(f"compte_{u['id']}")) for u in comptes
        )
        avant = avant.rstrip()
        texte = (
            avant
            + "\n\n"
            + (nouveaux + "\n" if nouveaux else "")
            + "</rdf:RDF>"
            + apres
        )

        _ecrire_atomique(fichier, texte)

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


# ---------------------------------------------- export des parcours OWL -----
def _est_individu_parcours(corps_xml: str) -> bool:
    for cls in CLASSES_PARCOURS:
        if f'rdf:resource="{EDU}{cls}"' in corps_xml:
            return True
    return False


def _bloc_parcours(fiche: dict[str, Any]) -> str:
    identifiant = str(fiche["id"]).strip()
    classe = str(fiche.get("niveauClasse") or "ParcoursDebutant")
    if classe not in CLASSES_PARCOURS:
        classe = "ParcoursDebutant"

    nom = _echapper_xml(fiche.get("nom") or identifiant)
    description = fiche.get("description")
    objectif = fiche.get("objectif")
    statut = str(fiche.get("statut") or "publie")
    cours_ids: list[str] = [str(c) for c in (fiche.get("coursIds") or []) if c]

    lignes = [
        f"    <!-- {EDU}{identifiant} -->\n",
        f'    <owl:NamedIndividual rdf:about="{EDU}{identifiant}">',
        f'        <rdf:type rdf:resource="{EDU}{classe}"/>',
    ]
    for cid in cours_ids:
        cid_propre = _echapper_xml(cid)
        lignes.append(
            f'        <contientCoursParcours rdf:resource="{EDU}{cid_propre}"/>'
        )
    lignes.append(f"        <nomParcours>{nom}</nomParcours>")
    if description:
        lignes.append(
            f"        <descriptionParcours>{_echapper_xml(description)}</descriptionParcours>"
        )
    if objectif:
        lignes.append(
            f"        <objectifParcours>{_echapper_xml(objectif)}</objectifParcours>"
        )
    lignes.append(f"        <statutParcours>{_echapper_xml(statut)}</statutParcours>")
    lignes.append(f'        <rdfs:label xml:lang="fr">{nom}</rdfs:label>')
    lignes.append("    </owl:NamedIndividual>\n")
    return "\n".join(lignes)


def exporter_parcours(
    parcours_liste: list[dict[str, Any]],
    chemin: Path | str | None = None,
) -> dict[str, Any]:
    """Synchronise la liste complète des individus `ParcoursApprentissage` dans le `.owl`."""
    fichier = Path(chemin) if chemin else Path(config.OWL_PATH)

    with _verrou:
        if not fichier.exists():
            raise ExportOwlErreur(f"Fichier OWL introuvable : {fichier}")

        with fichier.open("r", encoding="utf-8", newline="") as flux:
            texte = flux.read()

        nb_supprimes = 0

        def _filtrer(match: re.Match[str]) -> str:
            nonlocal nb_supprimes
            comment_id = match.group(1)
            about_id = match.group(2)
            corps = match.group(3)
            # Si un commentaire précédent appartenait à un autre individu, ne pas l'avaler !
            if comment_id is not None and comment_id != about_id:
                if _est_individu_parcours(corps):
                    nb_supprimes += 1
                    return f"\n    <!-- {EDU}{comment_id} -->\n"
                return match.group(0)
            if _est_individu_parcours(corps):
                nb_supprimes += 1
                return ""
            return match.group(0)

        texte = MOTIF_INDIVIDU_COMPILE.sub(_filtrer, texte)

        if "</rdf:RDF>" not in texte:
            raise ExportOwlErreur(
                f"Balise </rdf:RDF> absente de {fichier} : fichier inattendu."
            )

        avant, apres = texte.split("</rdf:RDF>", 1)
        blocs = "\n".join(_bloc_parcours(p) for p in parcours_liste)
        avant = avant.rstrip()
        texte = (
            avant
            + "\n\n"
            + (blocs + "\n" if blocs else "")
            + "</rdf:RDF>"
            + apres
        )

        _ecrire_atomique(fichier, texte)
        return {
            "fichier": str(fichier),
            "parcours": len(parcours_liste),
            "blocs_remplaces": nb_supprimes,
        }


def exporter_parcours_sans_erreur(
    parcours_liste: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Variante non bloquante pour l'API FastAPI."""
    try:
        return exporter_parcours(parcours_liste)
    except ExportOwlErreur as exc:
        logger.warning("Export OWL des parcours impossible : %s", exc)
        return None


def maj_suit_cours_individu_sans_erreur(
    individu_id: str, cours_ids: list[str]
) -> None:
    """Met à jour les liens `<suitCours>` d'un individu étudiant dans le `.owl`."""
    fichier = Path(config.OWL_PATH)
    with _verrou:
        if not fichier.exists():
            return
        try:
            with fichier.open("r", encoding="utf-8", newline="") as flux:
                texte = flux.read()

            motif = re.compile(
                r'(<owl:NamedIndividual rdf:about="'
                + re.escape(f"{EDU}{individu_id}")
                + r'">)(.*?)(</owl:NamedIndividual>)',
                re.S,
            )
            match = motif.search(texte)
            if not match:
                return

            corps = re.sub(
                r'[ \t]*<suitCours\s+rdf:resource="[^"]+"\s*/>\r?\n?',
                "",
                match.group(2),
            )
            lignes_suit = "".join(
                f'        <suitCours rdf:resource="{EDU}{_echapper_xml(cid)}"/>\n'
                for cid in sorted(set(cours_ids))
                if cid
            )
            # Insérer juste après la déclaration <rdf:type .../>
            corps_maj, n = re.subn(
                r'(<rdf:type\s+rdf:resource="[^"]+"\s*/>\r?\n)',
                r"\1" + lignes_suit,
                corps,
                count=1,
            )
            if n == 0:
                corps_maj = "\n" + lignes_suit + corps.lstrip("\r\n")

            nouveau_texte = (
                texte[: match.start()]
                + match.group(1)
                + corps_maj
                + match.group(3)
                + texte[match.end() :]
            )
            _ecrire_atomique(fichier, nouveau_texte)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Mise à jour suitCours OWL ignorée : %s", exc)
