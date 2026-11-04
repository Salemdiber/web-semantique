# Intégration Full-Stack — Ontologie Éducation & Formation

Architecture sémantique complète :

```
┌─────────────────┐      ┌──────────────┐      ┌────────────────┐      ┌──────────────┐
│  Landing React  │  →   │    FastAPI    │  →   │  Apache Jena   │  ←   │  Ontologie   │
│  (:3001 Vite 7) │      │   (Python)    │      │    Fuseki      │      │ OWL Protégé  │
│ Cours & Parcours│ SPARQL /api/*   │ SPARQLWrapper │      │ TDB2 + Inf.  │
└─────────────────┘      └──────────────┘      └────────────────┘      └──────────────┘
      ▲
      │  /education, /parcours, /evaluations (dashboard back-office React, Vite :5173)
```

- **Front-office** (`src/`, `:3001`) : sections dynamiques « Catalogue des cours » (`src/app/components/Home/CoursesOntology`) et « Parcours d'apprentissage » (`src/app/components/Home/Parcours`, routes `/parcours` et `/parcours/:id`), conscientes de la session partagée (Visiteur / Étudiant / Encadrant).
- **Back-office** (`dashboard/`, `:5173`) :
  - `/education` : statistiques SPARQL, tables Cours / Étudiants / Formateurs et graphe Prérequis → Cours → Compétences.
  - `/parcours` : module complet **Gestion des parcours d'apprentissage** (`edu:ParcoursApprentissage`) avec vue Administrateur/Formateur (CRUD OWL, compositeur séquentiel drag-and-drop, analyse de cohérence pédagogique + tri topologique en un clic, graphiques ApexCharts) et portail Étudiant (catalogue filtrable, inscription/désinscription, progression dérivée des évaluations, recommandations personnalisées).
  - `/evaluations` : gestion des évaluations, quiz QCM auto-corrigés et certifications.
- **Backend** : FastAPI (`backend/`, `:8000`) — expose les endpoints REST sémantiques et persiste les écritures à la fois dans Fuseki et dans `education_formation_protege.owl`.
- **Serveur sémantique** : Jena Fuseki en Docker (`docker-compose.yml`), dataset TDB2 persistant + raisonneur `OWLFBRuleReasoner`.
- **Base opérationnelle hybride** : SQLite (`backend/data/utilisateurs.db`) pour les comptes, les questionnaires/tentatives de quiz et l'ordonnancement/suivi des inscriptions aux parcours.

## 1) Démarrer Jena Fuseki (avec inférence OWL)

```bash
docker compose up -d
# Interface web : http://localhost:3030  (utilisateur : admin / admin)
```

Le dataset `education` est défini par **`fuseki/config.ttl`** (lu automatiquement par
fuseki-server via son volume) :

- **stockage TDB2 persistant** : volume `fuseki-data` → `/fuseki/databases/education`
- **raisonneur OWL** : `OWLFBRuleReasoner` sur le graphe par défaut (`ja:InfModel`)

Endpoint permettant de vérifier le raisonnement :

| Endpoint                          | Description                                        |
|-----------------------------------|----------------------------------------------------|
| `GET /api/education/types-inferes` | comptage `rdf:type` direct (individus **déduits** par le raisonneur, ex. `Examen_Python` vu comme `Evaluation`, et `Parcours_Web`/`Parcours_FullStack` vus comme `ParcoursApprentissage`) comparé à `rdfs:subClassOf*` ; champ `raisonneur_actif` par ligne |

## 2) Charger l'ontologie OWL dans Fuseki

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
python scripts\setup_dataset.py
```

Le script crée le dataset si absent → PUT du fichier OWL (`?default` via Graph Store Protocol) → initialise les tables et l'ordre séquentiel des parcours dans SQLite → vérifie l'inférence OWL sur `Evaluation` et `ParcoursApprentissage`.

## 3) Démarrer l'API FastAPI

```bash
# backend/ (toujours avec le venv actif)
uvicorn app.main:app --reload --port 8000
```

- Swagger UI : http://localhost:8000/docs

### Endpoints généraux (préfixe `/api`)

| Endpoint                          | Données OWL extraites                              |
|-----------------------------------|----------------------------------------------------|
| `GET /api/education/sante`        | disponibilité du dataset                           |
| `GET /api/education/cours`        | cours + durée + type + prérequis + compétences + formateurs |
| `GET /api/education/etudiants`    | étudiants + niveau + cours/formations/certifications |
| `GET /api/education/formateurs`   | formateurs + domaine + cours enseignés             |
| `GET /api/education/formations`   | formations + programme + certification + étudiants |
| `GET /api/education/competences`  | compétences + cours développeurs + prérequis       |
| `GET /api/education/programmes`   | programmes pédagogiques + formations               |
| `GET /api/education/evaluations`  | examens et quiz                                    |
| `GET /api/education/mes-evaluations` | évaluations et quiz de l'étudiant connecté (Bearer) |
| `GET /api/education/quiz/{id}`     | questionnaire d'un quiz attribué (Bearer étudiant)  |
| `POST /api/education/quiz/{id}/soumettre` | correction automatique + note (Bearer étudiant) |
| `GET /api/education/quiz/{id}/questions` | questionnaire complet (admin/formateur)      |
| `PUT /api/education/quiz/{id}/questions` | remplace le questionnaire (admin/formateur) |
| `DELETE /api/education/quiz/{id}/tentatives` | réinitialise les tentatives (admin/formateur) |
| `GET /api/education/certifications`| certifications + organismes                       |
| `GET /api/education/statistiques` | compteurs par classe (`rdfs:subClassOf*` sur les 10 classes racines, incluant `ParcoursApprentissage`) |
| `GET /api/education/hierarchie`   | arbre des classes OWL                              |
| `POST /api/ontologie/charger`     | recharge le fichier OWL dans Fuseki                |
| `POST /api/ontologie/televerser`  | upload d'un autre fichier OWL via l'UI             |
| `GET /api/ontologie/prerequis-competences` | chaîne complète Prérequis → Cours → Compétence |

### Module « Gestion des parcours d'apprentissage » (`backend/app/routers/parcours.py`)

Propriétés OWL déclarées sur `edu:ParcoursApprentissage` dans `education_formation_protege.owl` :
- **Sous-classes de niveau** : `edu:ParcoursDebutant`, `edu:ParcoursAvance` (inférées comme `edu:ParcoursApprentissage` par `OWLFBRuleReasoner`).
- **Propriété objet** : `edu:contientCoursParcours` (`ParcoursApprentissage → Cours`) — source de vérité sémantique de l'appartenance des cours.
- **Propriétés de données** (`xsd:string`) : `edu:nomParcours` (unique, insensible à la casse), `edu:descriptionParcours`, `edu:objectifParcours`, `edu:statutParcours` (`brouillon` | `publie`).

| Endpoint | Rôle requis | Description |
|----------|-------------|-------------|
| `GET /api/education/parcours` | Public / Tous | Liste enrichie (filtres `niveau`, `q`, `competence`, `statut`, `tri`, `ordre`). Masque les brouillons aux visiteurs et étudiants. |
| `GET /api/education/parcours/{id}` | Public / Tous | Détail complet : étapes ordonnées, durée totale calculée, compétences/prérequis agrégés, inscrits (encadrants) ou progression (étudiant). |
| `POST /api/education/parcours` | `admin` | Création d'un parcours dans Fuseki + `.owl` + ordre SQLite. |
| `PUT /api/education/parcours/{id}` | `admin` | Mise à jour des métadonnées, du statut et remplacement du `rdf:type` (`ParcoursDebutant` / `ParcoursAvance`). |
| `PUT /api/education/parcours/{id}/cours` | `admin` | Remplacement ou réordonnancement complet de la séquence de cours. |
| `POST /api/education/parcours/{id}/cours` | `admin` | Insertion d'un cours existant à une position donnée. |
| `DELETE /api/education/parcours/{id}/cours/{coursId}` | `admin` | Retrait d'un cours d'un parcours. |
| `POST /api/education/parcours/{id}/dupliquer` | `admin` | Duplication d'un parcours existant sous forme de `brouillon`. |
| `DELETE /api/education/parcours/{id}` | `admin` | Suppression de l'individu OWL (sujet/objet), de l'ordre SQLite, des inscriptions et des `edu:suitCours` orphelins. |
| `GET /api/education/parcours/{id}/analyse` | `admin`, `formateur` | Analyse de cohérence pédagogique (`aPourPrerequis` → `necessiteCompetence` ↔ `developpeCompetence`), prérequis d'entrée et ordre topologique suggéré (algorithme de Kahn). |
| `GET /api/education/parcours/statistiques` | `admin`, `formateur` | Répartition par niveau/statut, moyennes, top parcours inscrits, taux de complétion et cours mutualisés. |
| `GET /api/education/parcours/proprietes-owl` | Public / Tous | Métadonnées OWL des propriétés ayant `rdfs:domain edu:ParcoursApprentissage`. |
| `POST /api/education/parcours/{id}/inscription` | `etudiant` | Inscription à un parcours publié + ajout réversible de `edu:suitCours` sur le 1er cours non validé. |
| `DELETE /api/education/parcours/{id}/inscription` | `etudiant` | Désinscription + retrait propre des triplets `edu:suitCours` non partagés avec un autre parcours actif. |
| `GET /api/education/parcours/mes-parcours` | `etudiant` | Parcours suivis avec progression dérivée par cours (`non_commence`, `en_cours`, `termine`) et prochaine étape recommandée. |
| `GET /api/education/parcours/recommandations` | `etudiant` | Suggestions personnalisées avec score de pertinence et justifications explicites. |

## 4) Dashboard back-office (React / Vite :5173)

```bash
cd dashboard
npm install
npm run dev
```

Pages principales :
- **Accueil** (`/`) : indicateurs OWL (dont `ParcoursApprentissage`) et accès rapides.
- **Ontologie Éducation** (`/education`) : explorateur SPARQL et contrôle du raisonneur OWL.
- **Parcours d'apprentissage** (`/parcours`, `/parcours/:id`) : administration complète (Admin), analyse pédagogique (Formateur) ou portail d'apprentissage et feuille de route (Étudiant).
- **Évaluations & Certifications** (`/evaluations`).

## 5) Landing front-office (React / Vite :3001)

```bash
# racine du projet
npm install
npm run dev
```

Ou lancement unifié de toute la pile sous Windows PowerShell :

```powershell
.\start-all.ps1
```

## Notes d'architecture & choix techniques

- **Ordonnancement hybride des cours (`parcours_cours_ordre`)** : les propriétés objet RDF (`edu:contientCoursParcours`) étant non ordonnées par nature, l'appartenance sémantique demeure dans Fuseki/OWL via `edu:contientCoursParcours`, tandis que l'ordre séquentiel exact (`position` 1..N) est persisté dans SQLite (`parcours_cours_ordre`) et réconcilié automatiquement à la lecture.
- **Durée totale calculée** : agrégée dynamiquement à partir des `edu:dureeCours` des cours liés afin d'éviter toute désynchronisation documentaire.
- **Progression étudiante dérivée** : aucune case à cocher arbitraire n'est stockée ; un cours est `termine` lorsque l'étudiant possède une `Evaluation` (`porteSur` + `evalue`) réussie (`noteObtenue >= COALESCE(noteMinimaleReussite, 12)`), et `en_cours` lorsqu'il suit le cours (`edu:suitCours`) ou possède une évaluation en attente.
- **Synchronisation réversible `edu:suitCours`** : l'inscription à un parcours ajoute `edu:suitCours` sur le premier cours non validé de l'individu `edu:compte_<id>` (tracé dans `parcours_cours_suivis`) et met à jour le `.owl` ; la désinscription retire uniquement les triplets non mutualisés avec un autre parcours suivi.
