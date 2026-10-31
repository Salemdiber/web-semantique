"""Requêtes SPARQL mappées sur l'ontologie Éducation et Formation (Protégé).

Namespace : http://example.org/education-formation#
Propriétés objet du fichier OWL :
    aPourPrerequis, contientCours, contientCoursParcours, contientFormation,
    developpeCompetence, enseigne, evalue, evalueCompetence, faitPartieDe,
    meneVers, necessiteCompetence, obtientCertification, porteSur,
    suitCours, suitFormation
Propriétés données :
    anneeProgramme, descriptionCours, descriptionFormation, descriptionPrerequis,
    dureeCours, dureeFormation, niveau, niveauCompetence, niveauRequis,
    nomCertification, nomCompetence, nomCours, nomFormation, nomProgramme,
    organisme, prenom
"""

PREFIXE = """PREFIX edu: <http://example.org/education-formation#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
"""

# ----------------------------------------------------------------- Cours ---
COURS_LISTE = PREFIXE + """
SELECT ?cours ?nom ?duree ?description ?typeLabel
       (GROUP_CONCAT(DISTINCT COALESCE(?prerequisNom, ""); separator="|") AS ?prerequis)
       (GROUP_CONCAT(DISTINCT COALESCE(?competenceNom, ""); separator="|") AS ?competences)
       (GROUP_CONCAT(DISTINCT COALESCE(?formateurNom, ""); separator="|") AS ?formateurs)
WHERE {
    ?cours rdf:type/rdfs:subClassOf* edu:Cours .
    ?cours edu:nomCours ?nom .
    OPTIONAL { ?cours edu:dureeCours ?duree }
    OPTIONAL { ?cours edu:descriptionCours ?description }
    OPTIONAL {
        ?cours rdf:type ?typedirect .
        ?typedirect rdfs:subClassOf edu:Cours .
        ?typedirect rdfs:label ?typeLabel .
    }
    OPTIONAL {
        ?cours edu:aPourPrerequis ?pre.
        ?pre edu:descriptionPrerequis ?prerequisNom .
    }
    OPTIONAL {
        ?cours edu:developpeCompetence ?competence.
        ?competence edu:nomCompetence ?competenceNom .
    }
    OPTIONAL {
        ?formateur edu:enseigne ?cours .
        ?formateur edu:prenom ?formateurNom .
    }
}
GROUP BY ?cours ?nom ?duree ?description ?typeLabel
ORDER BY ?nom
"""

# -------------------------------------------------------------- Étudiants ---
ETUDIANTS = PREFIXE + """
SELECT ?etudiant ?prenom ?niveau
       (GROUP_CONCAT(DISTINCT COALESCE(?formationNom, ""); separator="|") AS ?formations)
       (GROUP_CONCAT(DISTINCT COALESCE(?coursNom, ""); separator="|") AS ?cours)
       (GROUP_CONCAT(DISTINCT COALESCE(?certNom, ""); separator="|") AS ?certifications)
WHERE {
    ?etudiant rdf:type/rdfs:subClassOf* edu:Etudiant .
    ?etudiant edu:prenom ?prenom .
    OPTIONAL { ?etudiant edu:niveau ?niveau }
    OPTIONAL {
        ?etudiant edu:suitFormation ?formation .
        ?formation edu:nomFormation ?formationNom .
    }
    OPTIONAL {
        ?etudiant edu:suitCours ?crs.
        ?crs edu:nomCours ?coursNom .
    }
    OPTIONAL {
        ?etudiant edu:obtientCertification ?cert.
        ?cert edu:nomCertification ?certNom .
    }
}
GROUP BY ?etudiant ?prenom ?niveau
ORDER BY ?prenom
"""

# -------------------------------------------------------------- Formateurs ---
FORMATEURS = PREFIXE + """
SELECT ?formateur ?prenom (GROUP_CONCAT(DISTINCT COALESCE(?coursNom, ""); separator="|") AS ?cours)
       (GROUP_CONCAT(DISTINCT COALESCE(?domaine, ""); separator="|") AS ?domaines)
WHERE {
    ?formateur rdf:type/rdfs:subClassOf* edu:Formateur .
    ?formateur edu:prenom ?prenom .
    OPTIONAL {
        ?formateur edu:enseigne ?crs.
        ?crs edu:nomCours ?coursNom .
    }
    OPTIONAL { ?formateur edu:descriptionFormation ?domaine }
}
GROUP BY ?formateur ?prenom
ORDER BY ?prenom
"""

# ------------------------------------------------------------ Formations ---
FORMATIONS = PREFIXE + """
SELECT ?formation ?nom ?duree ?programmeNom ?certificationNom
       (GROUP_CONCAT(DISTINCT COALESCE(?coursNom, ""); separator="|") AS ?cours)
       (GROUP_CONCAT(DISTINCT COALESCE(?etudiantNom, ""); separator="|") AS ?etudiants)
WHERE {
    ?formation rdf:type/rdfs:subClassOf* edu:Formation .
    ?formation edu:nomFormation ?nom .
    OPTIONAL { ?formation edu:dureeFormation ?duree }
    OPTIONAL {
        ?formation edu:faitPartieDe ?programme.
        ?programme edu:nomProgramme ?programmeNom .
    }
    OPTIONAL {
        ?formation edu:meneVers ?certification.
        ?certification edu:nomCertification ?certificationNom .
    }
    OPTIONAL {
        ?formation edu:contientCours ?crs.
        ?crs edu:nomCours ?coursNom .
    }
    OPTIONAL {
        ?etudiant edu:suitFormation ?formation.
        ?etudiant edu:prenom ?etudiantNom .
    }
}
GROUP BY ?formation ?nom ?duree ?programmeNom ?certificationNom
ORDER BY ?nom
"""

# ------------------------------------------------------------ Compétences ---
COMPETENCES = PREFIXE + """
SELECT ?competence ?nom ?niveau ?typeLabel
       (GROUP_CONCAT(DISTINCT COALESCE(?coursNom, ""); separator="|") AS ?cours)
       (GROUP_CONCAT(DISTINCT COALESCE(?prerequisNom, ""); separator="|") AS ?prerequis)
WHERE {
    ?competence rdf:type/rdfs:subClassOf* edu:Competence .
    ?competence edu:nomCompetence ?nom .
    OPTIONAL { ?competence edu:niveauCompetence ?niveau }
    OPTIONAL {
        ?competence rdf:type ?typedirect .
        ?typedirect rdfs:subClassOf edu:Competence .
        ?typedirect rdfs:label ?typeLabel .
    }
    OPTIONAL {
        ?crs edu:developpeCompetence ?competence .
        ?crs edu:nomCours ?coursNom .
    }
    OPTIONAL {
        ?pre edu:necessiteCompetence ?competence .
        ?pre edu:descriptionPrerequis ?prerequisNom .
    }
}
GROUP BY ?competence ?nom ?niveau ?typeLabel
ORDER BY ?nom
"""

# ----------------------------------------------------- Programmes pédagogiques ---
PROGRAMMES = PREFIXE + """
SELECT ?programme ?nom ?annee
       (GROUP_CONCAT(DISTINCT COALESCE(?formationNom, ""); separator="|") AS ?formations)
WHERE {
    ?programme rdf:type/rdfs:subClassOf* edu:ProgrammePedagogique .
    ?programme edu:nomProgramme ?nom .
    OPTIONAL { ?programme edu:anneeProgramme ?annee }
    OPTIONAL {
        ?programme edu:contientFormation ?formation .
        ?formation edu:nomFormation ?formationNom .
    }
}
GROUP BY ?programme ?nom ?annee
ORDER BY ?nom
"""

# ----------------------------------------------------- Parcours d'apprentissage ---
PARCOURS = PREFIXE + """
SELECT ?parcours ?typeLabel
       (GROUP_CONCAT(DISTINCT COALESCE(?coursNom, ""); separator="|") AS ?cours)
WHERE {
    ?parcours rdf:type/rdfs:subClassOf* edu:ParcoursApprentissage .
    OPTIONAL {
        ?parcours rdf:type ?typedirect .
        ?typedirect rdfs:subClassOf edu:ParcoursApprentissage .
        ?typedirect rdfs:label ?typeLabel .
    }
    OPTIONAL {
        ?parcours edu:contientCoursParcours ?crs.
        ?crs edu:nomCours ?coursNom .
    }
}
GROUP BY ?parcours ?typeLabel
"""

# -------------------------------------------------------- Évaluations ---
EVALUATIONS = PREFIXE + """
SELECT DISTINCT ?evaluation ?typeLabel ?cours ?coursNom ?etudiant
       ?etudiantNom ?competence ?competenceNom
       ?nomEvaluation ?dateEvaluation ?noteMaximale
       ?noteMinimaleReussite ?noteObtenue
       (GROUP_CONCAT(DISTINCT ?typedirect; separator="|") AS ?types)
WHERE {
    ?evaluation rdf:type/rdfs:subClassOf* edu:Evaluation .
    OPTIONAL {
        ?evaluation rdf:type ?typedirect .
        ?typedirect rdfs:subClassOf edu:Evaluation .
        FILTER (?typedirect != edu:Evaluation)
        OPTIONAL { ?typedirect rdfs:label ?typeLabel }
    }
    OPTIONAL { ?evaluation edu:nomEvaluation ?nomEvaluation }
    OPTIONAL { ?evaluation edu:dateEvaluation ?dateEvaluation }
    OPTIONAL { ?evaluation edu:noteMaximale ?noteMaximale }
    OPTIONAL {
        ?evaluation edu:noteMinimaleReussite ?noteMinimaleReussite
    }
    OPTIONAL { ?evaluation edu:noteObtenue ?noteObtenue }
    OPTIONAL {
        ?evaluation edu:porteSur ?cours.
        ?cours edu:nomCours ?coursNom .
    }
    OPTIONAL {
        ?evaluation edu:evalue ?etudiant.
        ?etudiant edu:prenom ?etudiantNom .
    }
    OPTIONAL {
        ?evaluation edu:evalueCompetence ?competence.
        ?competence edu:nomCompetence ?competenceNom .
    }
}
GROUP BY ?evaluation ?typeLabel ?cours ?coursNom ?etudiant ?etudiantNom
         ?competence ?competenceNom ?nomEvaluation ?dateEvaluation
         ?noteMaximale ?noteMinimaleReussite ?noteObtenue
ORDER BY ?evaluation
"""

def evaluations_etudiant(individu: str) -> str:
    """Évaluations et quiz attribués à un étudiant donné (nom local OWL)."""
    return PREFIXE + f"""
SELECT DISTINCT ?evaluation ?typeLabel ?cours ?coursNom ?etudiant
       ?etudiantNom ?competence ?competenceNom
       ?nomEvaluation ?dateEvaluation ?noteMaximale
       ?noteMinimaleReussite ?noteObtenue
WHERE {{
    ?evaluation rdf:type/rdfs:subClassOf* edu:Evaluation .
    ?evaluation edu:evalue edu:{individu} .
    BIND (edu:{individu} AS ?etudiant)
    OPTIONAL {{
        ?evaluation rdf:type ?typedirect .
        ?typedirect rdfs:subClassOf edu:Evaluation .
        FILTER (?typedirect != edu:Evaluation)
        OPTIONAL {{ ?typedirect rdfs:label ?typeLabel }}
    }}
    OPTIONAL {{ ?evaluation edu:nomEvaluation ?nomEvaluation }}
    OPTIONAL {{ ?evaluation edu:dateEvaluation ?dateEvaluation }}
    OPTIONAL {{ ?evaluation edu:noteMaximale ?noteMaximale }}
    OPTIONAL {{
        ?evaluation edu:noteMinimaleReussite ?noteMinimaleReussite
    }}
    OPTIONAL {{ ?evaluation edu:noteObtenue ?noteObtenue }}
    OPTIONAL {{
        ?evaluation edu:porteSur ?cours.
        ?cours edu:nomCours ?coursNom .
    }}
    OPTIONAL {{
        edu:{individu} edu:prenom ?etudiantNom .
    }}
    OPTIONAL {{
        ?evaluation edu:evalueCompetence ?competence.
        ?competence edu:nomCompetence ?competenceNom .
    }}
}}
ORDER BY ?evaluation
"""


# ------------------------------------------------------ Certifications ---
CERTIFICATIONS = PREFIXE + """
SELECT ?certification ?nom ?organisme ?typeLabel ?formation ?formationNom
       ?competence ?competenceNom ?evaluation ?evaluationNom
       ?noteMinimaleCertification ?dateObtention
       (GROUP_CONCAT(DISTINCT ?typedirect; separator="|") AS ?types)
       (GROUP_CONCAT(DISTINCT ?etudiantNom; separator="|") AS ?etudiantNoms)
       (GROUP_CONCAT(DISTINCT ?etudiant; separator="|") AS ?etudiants)
WHERE {
    ?certification rdf:type/rdfs:subClassOf* edu:Certification .
    ?certification edu:nomCertification ?nom .
    OPTIONAL { ?certification edu:organisme ?organisme }
    OPTIONAL { ?certification edu:dateObtention ?dateObtention }
    OPTIONAL {
        ?certification edu:noteMinimaleCertification
            ?noteMinimaleCertification
    }
    OPTIONAL {
        ?certification edu:certifieCompetence ?competence .
        OPTIONAL { ?competence edu:nomCompetence ?competenceNom }
    }
    OPTIONAL {
        ?certification edu:certifieEvaluation ?evaluation .
        OPTIONAL { ?evaluation edu:nomEvaluation ?evaluationNom }
    }
    OPTIONAL {
        ?certification rdf:type ?typedirect .
        ?typedirect rdfs:subClassOf edu:Certification .
        FILTER (?typedirect != edu:Certification)
        OPTIONAL { ?typedirect rdfs:label ?typeLabel }
    }
    OPTIONAL {
        ?formation edu:meneVers ?certification .
        OPTIONAL { ?formation edu:nomFormation ?formationNom }
    }
    OPTIONAL {
        ?etudiant edu:obtientCertification ?certification .
        OPTIONAL { ?etudiant edu:prenom ?etudiantNom }
    }
}
GROUP BY ?certification ?nom ?organisme ?typeLabel ?formation ?formationNom
         ?competence ?competenceNom ?evaluation ?evaluationNom
         ?noteMinimaleCertification ?dateObtention
ORDER BY ?nom
"""

# ---------------------------------------------------------- Statistiques ---
STATISTIQUES = PREFIXE + """
SELECT ?classe ?nomClasse (COUNT(DISTINCT ?individu) AS ?nombre)
WHERE {
    VALUES ?classe {
        edu:Etudiant           edu:Formateur             edu:Cours
        edu:Formation          edu:Competence            edu:Prerequis
        edu:Evaluation         edu:Certification         edu:ProgrammePedagogique
        edu:ParcoursApprentissage
    }
    ?classe rdfs:label ?nomClasse.
    ?individu rdf:type/rdfs:subClassOf* ?classe .
}
GROUP BY ?classe ?nomClasse
ORDER BY DESC(?nombre)
"""

# --------------------------------------------------- Hiérarchie de classes ---
HIERARCHIE = PREFIXE + """
SELECT ?sousClasse ?labelSousClasse ?classeParente ?labelParent
WHERE {
    ?sousClasse rdf:type owl:Class .
    ?sousClasse rdfs:label ?labelSousClasse .
    FILTER (STRSTARTS(STR(?sousClasse), "http://example.org/education-formation#"))
    OPTIONAL {
        ?sousClasse rdfs:subClassOf ?classeParente .
        ?classeParente rdfs:label ?labelParent .
    }
}
ORDER BY ?classeParente ?labelSousClasse
"""
