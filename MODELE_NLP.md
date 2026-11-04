# Modèle NLP/TALN de traduction vers SPARQL

## 1. Objectif du module

Le module transforme une question formulée en langage naturel français en une
requête SPARQL exécutable par Apache Jena Fuseki.

Exemple :

> Quels sont les cours de Python ?

devient une requête qui recherche les individus de la classe `edu:Cours` dont
le nom contient `Python`.

Le système n'utilise pas d'API de LLM comme OpenAI, Gemini ou ChatGPT. La
traduction est réalisée localement avec des bibliothèques NLP/TALN et des
règles déterministes liées au vocabulaire de l'ontologie.

## 2. Principe général

Le traitement suit les étapes suivantes :

```text
Question française
        ↓
Tokenisation NLTK
        ↓
Normalisation du texte
        ↓
Détection de la ressource et de l'intention
        ↓
Extraction du terme recherché
        ↓
Génération SPARQL contrôlée
        ↓
Validation syntaxique RDFLib
        ↓
Exécution optionnelle sur Fuseki
```

## 3. Bibliothèques utilisées

| Bibliothèque | Rôle |
|---|---|
| NLTK | Tokenisation de la question |
| RDFLib | Validation de la syntaxe SPARQL |
| FastAPI | Exposition de l'API REST |
| SPARQLWrapper | Envoi de la requête à Fuseki |
| Apache Jena Fuseki | Exécution des requêtes sur le graphe RDF |

Aucun modèle de langage distant n'est appelé.

## 4. Analyse de la question

### 4.1 Tokenisation

NLTK découpe la question en unités lexicales.

```text
Quels sont les cours de Python ?
```

est transformé en jetons similaires à :

```text
["Quels", "sont", "les", "cours", "de", "Python", "?"]
```

### 4.2 Normalisation

Le texte est converti en minuscules et les accents sont retirés pour faciliter
la comparaison :

```text
Compétences → competences
Étudiants   → etudiants
```

### 4.3 Détection des ressources

Le système possède un vocabulaire contrôlé correspondant aux classes OWL :

| Mot reconnu | Classe OWL | Propriété principale |
|---|---|---|
| cours | `edu:Cours` | `edu:nomCours` |
| formation | `edu:Formation` | `edu:nomFormation` |
| compétence | `edu:Competence` | `edu:nomCompetence` |
| étudiant | `edu:Etudiant` | `edu:prenom` |
| formateur | `edu:Formateur` | `edu:prenom` |
| programme | `edu:ProgrammePedagogique` | `edu:nomProgramme` |
| parcours | `edu:ParcoursApprentissage` | `edu:nomParcours` |
| certification | `edu:Certification` | `edu:nomCertification` |

### 4.4 Détection de l'intention

Les expressions et verbes sont associés à des intentions :

| Expression | Intention |
|---|---|
| « quels sont », « liste » | Lister des ressources |
| « combien » | Compter des ressources |
| « développe » | Rechercher les compétences d'un cours |
| « contient » | Rechercher les cours d'une formation |
| « suit » | Rechercher les formations d'un étudiant |
| « enseigne » | Rechercher les cours d'un formateur |
| « prérequis » | Rechercher les prérequis d'un cours |

## 5. Exemples question/réponse

### Exemple 1 : recherche simple

**Question :**

> Quels sont les cours de Python ?

**Analyse :**

```text
Ressource : Cours
Intention : Lister
Terme extrait : Python
```

**SPARQL généré :**

```sparql
PREFIX edu: <http://example.org/education-formation#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?ressource ?nom
WHERE {
    ?ressource rdf:type/rdfs:subClassOf* edu:Cours .
    ?ressource edu:nomCours ?nom .
    FILTER(CONTAINS(LCASE(STR(?nom)), LCASE("python")))
}
ORDER BY ?nom
```

### Exemple 2 : comptage

**Question :**

> Combien de formations existe-t-il ?

**Analyse :**

```text
Ressource : Formation
Intention : Compter
```

**SPARQL généré :**

```sparql
SELECT (COUNT(DISTINCT ?ressource) AS ?total)
WHERE {
    ?ressource rdf:type/rdfs:subClassOf* edu:Formation .
    ?ressource edu:nomFormation ?nom .
}
```

### Exemple 3 : relation ontologique

**Question :**

> Quelles compétences développe le cours Python ?

**Analyse :**

```text
Ressource source : Cours
Ressource cible : Compétence
Relation : developpeCompetence
Terme extrait : Python
```

**Structure SPARQL générée :**

```sparql
SELECT ?ressource ?nom
WHERE {
    ?source rdf:type/rdfs:subClassOf* edu:Cours ;
            edu:developpeCompetence ?ressource .
    ?source edu:nomCours ?cible .
    ?ressource rdf:type/rdfs:subClassOf* edu:Competence ;
               edu:nomCompetence ?nom .
    FILTER(CONTAINS(LCASE(STR(?cible)), LCASE("python")))
}
ORDER BY ?nom
```

## 6. Architecture logicielle

Le cœur du traducteur est situé dans :

```text
backend/app/nlp_translator.py
```

La fonction principale est :

```python
traduire_question(question: str) -> TraductionSPARQL
```

L'API REST est exposée par :

```text
POST /api/nlp/traduire
```

Exemple d'appel :

```json
{
  "question": "Quels sont les cours de Python ?",
  "executer": true
}
```

La réponse contient :

```json
{
  "question": "Quels sont les cours de Python ?",
  "intention": "lister",
  "typeRessource": "Cours",
  "requete": "PREFIX ... SELECT ...",
  "jetons": ["Quels", "sont", "les", "cours", "de", "Python", "?"],
  "resultats": []
}
```

L'interface utilisateur est disponible dans la page **Ontologie Éducation**,
via le composant :

```text
dashboard/src/components/education/TraducteurNLP.tsx
```

## 7. Sécurité et contrôle

La génération est contrôlée par une liste blanche :

- seules les classes connues de l'ontologie sont utilisées ;
- seules les propriétés prévues par les règles sont générées ;
- les valeurs textuelles sont échappées avant insertion ;
- les requêtes produites sont validées avec RDFLib ;
- le module ne génère pas de requête SPARQL Update ;
- les questions inconnues sont refusées explicitement.

Par exemple, une question sur des livres est rejetée car `Livre` ne fait pas
partie du vocabulaire de l'ontologie.

## 8. Validation fonctionnelle

Les scénarios suivants ont été vérifiés :

| Scénario | Résultat attendu |
|---|---|
| Recherche de cours | Requête `SELECT` sur `edu:Cours` |
| Recherche par terme | Ajout d'un filtre `CONTAINS` |
| Comptage | Requête `COUNT(DISTINCT ...)` |
| Relation cours-compétence | Utilisation de `developpeCompetence` |
| Relation étudiant-formation | Utilisation de `suitFormation` |
| Question vide | Erreur explicite |
| Ressource inconnue | Erreur explicite |
| Syntaxe SPARQL | Validation RDFLib réussie |

## 9. Questions possibles du professeur

### Pourquoi ne pas utiliser une API ChatGPT ou Gemini ?

La consigne interdit l'utilisation directe d'une API LLM par simple prompt
engineering. Le système utilise donc une approche NLP symbolique locale,
reproductible et adaptée au vocabulaire fermé de l'ontologie.

### Est-ce réellement de l'intelligence artificielle ?

Il s'agit d'une approche d'IA symbolique ou hybride. La compréhension repose
sur l'analyse linguistique, la reconnaissance d'intentions et le raisonnement
sur les classes et propriétés OWL, plutôt que sur un modèle génératif.

### Pourquoi utiliser NLTK ?

NLTK fournit la tokenisation et des outils classiques de traitement du
langage. Ici, il permet de découper proprement les questions sans télécharger
de modèle externe ni dépendre d'un service distant.

### Pourquoi RDFLib ?

RDFLib est utilisé pour vérifier que la requête SPARQL générée respecte la
syntaxe attendue avant son envoi à Fuseki.

### Comment le système connaît-il les relations ?

Les relations sont définies à partir du schéma de l'ontologie :

```text
Cours --developpeCompetence--> Competence
Formation --contientCours--> Cours
Etudiant --suitFormation--> Formation
Formateur --enseigne--> Cours
Cours --aPourPrerequis--> Prerequis
```

### Que se passe-t-il si la question est ambiguë ?

Le système refuse la question lorsqu'il ne peut pas identifier une ressource
connue ou un terme exploitable. Il renvoie une erreur explicite plutôt qu'une
requête approximative.

### Quelles sont les limites du modèle ?

Le système fonctionne sur un vocabulaire et des intentions prédéfinis. Il ne
comprend pas encore toutes les formulations naturelles, les synonymes
complexes, les fautes importantes ou les questions nécessitant plusieurs
étapes de raisonnement.

### Comment peut-il être amélioré ?

Les évolutions possibles sont :

1. enrichir le dictionnaire de synonymes ;
2. ajouter davantage de patrons linguistiques ;
3. utiliser un modèle spaCy local pour l'analyse morphologique ;
4. ajouter une détection plus avancée des entités nommées ;
5. ajouter des tests automatisés pour chaque intention ;
6. proposer une demande de clarification en cas d'ambiguïté.

## 10. Conclusion

Le module réalise une traduction contrôlée et explicable entre le langage
naturel et SPARQL. Chaque résultat peut être justifié par :

1. les mots détectés dans la question ;
2. l'intention identifiée ;
3. la classe OWL sélectionnée ;
4. la propriété ontologique utilisée ;
5. la requête SPARQL produite ;
6. le résultat retourné par Fuseki.

Cette traçabilité rend le système adapté à une démonstration académique et à
la validation par un professeur.

## 11. Exemples de questions pour tester le modèle

### 11.1 Questions simples de type « liste »

Ces questions testent la détection d'une classe OWL et la génération d'une
requête `SELECT`.

| Question utilisateur | Classe détectée | Résultat attendu |
|---|---|---|
| Quels sont les cours disponibles ? | `Cours` | Liste des cours |
| Quelles sont les formations disponibles ? | `Formation` | Liste des formations |
| Quelles compétences sont enregistrées ? | `Competence` | Liste des compétences |
| Quels sont les étudiants inscrits ? | `Etudiant` | Liste des étudiants |
| Quels formateurs sont disponibles ? | `Formateur` | Liste des formateurs |
| Quels programmes pédagogiques existent ? | `ProgrammePedagogique` | Liste des programmes |
| Quels parcours d'apprentissage existent ? | `ParcoursApprentissage` | Liste des parcours |
| Quelles certifications sont proposées ? | `Certification` | Liste des certifications |

### 11.2 Questions avec un terme de recherche

Ces questions testent l'extraction d'un nom et l'ajout d'un filtre
`CONTAINS`.

| Question utilisateur | Terme extrait | Résultat attendu |
|---|---|---|
| Quels sont les cours de Python ? | `Python` | Cours dont le nom contient Python |
| Existe-t-il une formation Data Science ? | `Data Science` | Formation correspondante |
| Quelles compétences concernent la programmation ? | `programmation` | Compétences correspondantes |
| Quels étudiants s'appellent Ahmed ? | `Ahmed` | Étudiants correspondants |
| Quels formateurs enseignent le web ? | `web` | Formateurs correspondant au terme |
| Quel parcours concerne le développement web ? | `développement web` | Parcours correspondant |

### 11.3 Questions de comptage

Ces questions testent la détection du mot-clé `combien` et la génération
d'une agrégation SPARQL `COUNT`.

| Question utilisateur | Agrégation attendue |
|---|---|
| Combien de cours existe-t-il ? | `COUNT` des cours |
| Combien y a-t-il de formations ? | `COUNT` des formations |
| Combien de compétences sont disponibles ? | `COUNT` des compétences |
| Combien d'étudiants sont inscrits ? | `COUNT` des étudiants |
| Combien de formateurs travaillent dans la plateforme ? | `COUNT` des formateurs |
| Combien de quiz existe-t-il ? | `COUNT` des quiz |
| Combien de parcours sont publiés ? | `COUNT` des parcours |

### 11.4 Questions sur les relations de l'ontologie

Ces questions testent les propriétés objet RDF/OWL.

| Question utilisateur | Relation SPARQL attendue |
|---|---|
| Quelles compétences développe le cours Python ? | `edu:developpeCompetence` |
| Quels sont les prérequis du cours Python ? | `edu:aPourPrerequis` |
| Quels cours contient la formation Data Science ? | `edu:contientCours` |
| Quelles formations suit l'étudiant Ahmed ? | `edu:suitFormation` |
| Quels cours enseigne le formateur Ali ? | `edu:enseigne` |
| Quelles formations appartiennent au programme Informatique ? | `edu:contientFormation` |

### 11.5 Questions formulées différemment

Ces variantes permettent de vérifier que la détection ne dépend pas d'une
seule phrase exacte.

| Formulation 1 | Formulation 2 |
|---|---|
| Quels sont les cours de Python ? | Liste-moi les cours liés à Python |
| Combien de formations existe-t-il ? | Quel est le nombre de formations ? |
| Quelles compétences développe le cours Python ? | Le cours Python permet-il de développer quelles compétences ? |
| Quels cours contient la formation Data Science ? | Donne-moi les cours de la formation Data Science |
| Quelles formations suit Ahmed ? | Ahmed suit quelles formations ? |

### 11.6 Questions volontairement invalides

Ces questions vérifient que le système refuse proprement une demande qu'il ne
peut pas relier au vocabulaire de l'ontologie.

| Question utilisateur | Réponse attendue |
|---|---|
| | Erreur : la question ne peut pas être vide |
| Quels sont les livres disponibles ? | Erreur : ressource inconnue |
| Donne-moi la météo aujourd'hui. | Erreur : ressource inconnue |
| Fais quelque chose. | Erreur : intention ou ressource non identifiée |
| Quelle est la meilleure formation ? | Demande de précision ou erreur contrôlée |

### 11.7 Jeu minimal de validation orale

Pour une démonstration rapide devant le professeur, utiliser ces cinq
questions dans l'ordre :

1. **Quels sont les cours de Python ?**  
   Vérifie une recherche simple avec filtre.
2. **Combien de formations existe-t-il ?**  
   Vérifie l'agrégation `COUNT`.
3. **Quelles compétences développe le cours Python ?**  
   Vérifie une relation entre deux classes OWL.
4. **Quelles formations suit l'étudiant Ahmed ?**  
   Vérifie une relation étudiant-formation.
5. **Quels sont les livres disponibles ?**  
   Vérifie le rejet d'une ressource inconnue.

Pour chaque question, présenter successivement la question, l'intention
détectée, la classe OWL, la propriété utilisée, la requête SPARQL et le
résultat retourné par Fuseki.
