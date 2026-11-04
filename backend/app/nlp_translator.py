"""Traduction déterministe de questions françaises vers SPARQL.

Le module ne fait aucun appel à un modèle distant. NLTK est utilisé pour
segmenter la question, puis des règles lexicales et l'ontologie locale
déterminent la projection SPARQL.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from nltk.tokenize import wordpunct_tokenize
from rdflib.plugins.sparql.parser import parseQuery

from app.queries import PREFIXE


class TraductionNLPError(ValueError):
    """Question impossible à relier de façon non ambiguë à l'ontologie."""


@dataclass(frozen=True)
class TraductionSPARQL:
    """Résultat explicite d'une traduction."""

    question: str
    intention: str
    type_ressource: str
    requete: str
    jetons: tuple[str, ...]


_TYPES = {
    "cours": ("Cours", "nomCours"),
    "formation": ("Formation", "nomFormation"),
    "formations": ("Formation", "nomFormation"),
    "competence": ("Competence", "nomCompetence"),
    "competences": ("Competence", "nomCompetence"),
    "étudiant": ("Etudiant", "prenom"),
    "etudiant": ("Etudiant", "prenom"),
    "étudiants": ("Etudiant", "prenom"),
    "etudiants": ("Etudiant", "prenom"),
    "formateur": ("Formateur", "prenom"),
    "formateurs": ("Formateur", "prenom"),
    "quiz": ("Quiz", "nomEvaluation"),
    "quizs": ("Quiz", "nomEvaluation"),
    "programme": ("ProgrammePedagogique", "nomProgramme"),
    "programmes": ("ProgrammePedagogique", "nomProgramme"),
    "parcours": ("ParcoursApprentissage", "nomParcours"),
    "certification": ("Certification", "nomCertification"),
    "certifications": ("Certification", "nomCertification"),
}
_STOPWORDS = {
    "un", "une", "des", "du", "de", "d", "le", "la", "les", "l", "et",
    "qui", "que", "quel", "quelle", "quels", "quelles", "sont", "est",
    "dans", "pour", "sur", "avec", "a", "au", "aux", "je", "moi",
    "existe", "il", "t", "ils", "elles", "comment", "combien",
    "propose", "proposee", "proposees", "offert", "offerte", "offertes",
    "disponible", "disponibles",
}


def _normaliser(texte: str) -> str:
    decomposed = unicodedata.normalize("NFD", texte.lower())
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn")


def _litteral(texte: str) -> str:
    """Échappe un littéral SPARQL sans permettre d'injecter une clause."""
    return texte.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")


def _ressource(question: str) -> tuple[str, str] | None:
    normalisee = _normaliser(question)
    for terme in sorted(_TYPES, key=len, reverse=True):
        if re.search(rf"\b{re.escape(_normaliser(terme))}\b", normalisee):
            return _TYPES[terme]
    return None


def _terme_cible(question: str, type_ressource: str) -> str | None:
    """Extrait un nom après un marqueur de ressource (« cours Python »)."""
    normalisee = _normaliser(question)
    if "combien" in normalisee:
        return None
    noms = {
        "Cours": "cours",
        "Formation": "formation",
        "Competence": "competence",
        "Etudiant": "etudiant",
        "Formateur": "formateur",
        "Prerequis": "prerequis",
        "Quiz": "quiz",
        "ProgrammePedagogique": "programme",
        "ParcoursApprentissage": "parcours",
        "Certification": "certification",
    }
    marqueur = noms[type_ressource]
    match = re.search(
        rf"\b{marqueur}s?\s+(?:de|du|d'|pour|sur|nomme|nommee|le|la|les|un|une)?\s*"
        r"([a-z0-9][a-z0-9 '&-]{1,80}?)(?:\s*[?.!,]|$)",
        normalisee,
    )
    if not match:
        return None
    candidat = re.sub(r"\s+", " ", match.group(1)).strip(" -'")
    mots = [mot for mot in candidat.split() if mot not in _STOPWORDS]
    return " ".join(mots) or None


def _filtre(nom_variable: str, valeur: str | None) -> str:
    if not valeur:
        return ""
    return (
        f'FILTER(CONTAINS(LCASE(STR(?{nom_variable})), '
        f'LCASE("{_litteral(valeur)}")))'
    )


def _requete_liste(classe: str, propriete: str, cible: str | None) -> str:
    return PREFIXE + f"""
SELECT DISTINCT ?ressource ?nom
WHERE {{
    ?ressource rdf:type/rdfs:subClassOf* edu:{classe} .
    ?ressource edu:{propriete} ?nom .
    {_filtre("nom", cible)}
}}
ORDER BY ?nom
"""


def _requete_relation(
    question: str, cible: str | None, classe_selectionnee: str
) -> tuple[str, str] | None:
    normalisee = _normaliser(question)
    relations = (
        (("competence", "competences"), "developpeCompetence", "Cours", "nomCours",
         "Competence", "nomCompetence", "competences_de_cours"),
        (("prerequis", "prerequis"), "aPourPrerequis", "Cours", "nomCours",
         "Prerequis", "descriptionPrerequis", "prerequis_de_cours"),
        (("contient", "contiennent"), "contientCours", "Formation", "nomFormation",
         "Cours", "nomCours", "cours_de_formation"),
        (("enseigne", "enseignent"), "enseigne", "Formateur", "prenom",
         "Cours", "nomCours", "cours_d_un_formateur"),
        (("suit", "suivent"), "suitFormation", "Etudiant", "prenom",
         "Formation", "nomFormation", "formations_d_un_etudiant"),
    )
    for mots, predicate, source_class, source_prop, target_class, target_prop, intent in relations:
        if any(re.search(rf"\b{mot}\b", normalisee) for mot in mots):
            cible = _terme_cible(question, source_class)
            if not cible:
                raise TraductionNLPError(
                    "Précisez le nom de la ressource liée à la question."
                )
            if classe_selectionnee == target_class:
                bloc = f"""
SELECT ?ressource ?nom
WHERE {{
    ?source rdf:type/rdfs:subClassOf* edu:{source_class} ;
            edu:{predicate} ?ressource .
    ?source edu:{source_prop} ?cible .
    ?ressource rdf:type/rdfs:subClassOf* edu:{target_class} ;
               edu:{target_prop} ?nom .
    {_filtre("cible", cible)}
}}
ORDER BY ?nom
"""
            elif predicate == "aPourPrerequis":
                bloc = f"""
SELECT DISTINCT ?ressource ?nom
WHERE {{
    ?cours rdf:type/rdfs:subClassOf* edu:{source_class} ;
           edu:{source_prop} ?nomCours ;
           edu:{predicate} ?ressource .
    ?ressource rdf:type/rdfs:subClassOf* edu:{target_class} ;
               edu:{target_prop} ?nom .
    {_filtre("nomCours", cible)}
}}
ORDER BY ?nom
"""
            else:
                bloc = f"""
SELECT ?ressource ?nom
WHERE {{
    ?ressource rdf:type/rdfs:subClassOf* edu:{source_class} ;
               edu:{source_prop} ?nom ;
               edu:{predicate} ?cibleRessource .
    ?cibleRessource rdf:type/rdfs:subClassOf* edu:{target_class} ;
                    edu:{target_prop} ?cible .
    {_filtre("nom", cible)}
}}
ORDER BY ?nom
"""
            return intent, PREFIXE + bloc
    return None


def traduire_question(question: str) -> TraductionSPARQL:
    """Transforme une question française en requête SELECT SPARQL exécutable."""
    if not isinstance(question, str) or not question.strip():
        raise TraductionNLPError("La question ne peut pas être vide.")

    jetons = tuple(wordpunct_tokenize(question.strip()))
    ressource = _ressource(question)
    if ressource is None:
        raise TraductionNLPError(
            "Ressource inconnue. Utilisez cours, formations, compétences, "
            "étudiants, formateurs, quiz, programmes, parcours ou certifications."
        )

    classe, propriete = ressource
    cible = _terme_cible(question, classe)
    relation = _requete_relation(question, cible, classe)
    if relation:
        intention, requete = relation
    else:
        intention = "compter" if re.search(r"\bcombien\b", _normaliser(question)) else "lister"
        if intention == "compter":
            requete = PREFIXE + f"""
SELECT (COUNT(DISTINCT ?ressource) AS ?total)
WHERE {{
    ?ressource rdf:type/rdfs:subClassOf* edu:{classe} .
    OPTIONAL {{ ?ressource edu:{propriete} ?nom }}
    {_filtre("nom", cible)}
}}
"""
        else:
            requete = _requete_liste(classe, propriete, cible)

    # Vérifie la syntaxe côté serveur avant de remettre la requête au client.
    parseQuery(requete)
    return TraductionSPARQL(question, intention, classe, requete.strip(), jetons)
