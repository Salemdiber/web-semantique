# Intégration Full-Stack — Ontologie Éducation & Formation

Architecture sémantique complète :

```
┌─────────────────┐      ┌──────────────┐      ┌────────────────┐      ┌──────────────┐
│  Landing Next.js │  →   │    FastAPI    │  →   │  Apache Jena   │  ←   │  Ontologie   │
│   (front-office) │      │   (Python)    │      │    Fuseki      │      │ OWL Protégé  │
│  React (catalogue)│ SPARQL /api/*   │ SPARQLWrapper │      │  22 individus│
└─────────────────┘      └──────────────┘      └────────────────┘      └──────────────┘
      ▲
      │  /education (dashboard back-office React, Vite)
```

- **Front-office** : landing Next.js — nouvelle section « Catalogue des cours issu du graphe de connaissances » (`src/app/components/Home/CoursesOntology`).
- **Back-office** : dashboard React (Vite) — page `/education` avec statistiques (requête SPARQL comptant les individus), tables Cours / Étudiants / Formateurs et graphe Prérequis → Cours → Compétences.
- **Backend** : FastAPI (`backend/`) — expose 12+ endpoints REST.
- **Serveur sémantique** : Jena Fuseki en Docker (`docker-compose.yml`), dataset TDB2 persistant.
- **Ontologie** : `education_formation_protege.owl` (non modifié).

## 1) Démarrer Jena Fuseki (avec inférence OWL)

```bash
docker compose up -d
# Interface web : http://localhost:3030  (utilisateur : admin / admin)
```

Le dataset `education` est défini par **`fuseki/config.ttl`** (lu automatiquement par
fuseki-server via son volume) :

- **stockage TDB2 persistant** : volume `fuseki-data` → `/fuseki/databases/education`
- **raisonneur OWL** : `OWLFBRuleReasoner` sur le graphe par défaut (`ja:InfModel`)

Nouvel endpoint permettant de vérifier le raisonnement :

| Endpoint                          | Description                                        |
|-----------------------------------|----------------------------------------------------|
| `GET /api/education/types-inferes` | comptage `rdf:type` direct (individus **déduits** par le raisonneur, ex. `Examen_Python` vu comme `Evaluation`) comparé à `rdfs:subClassOf*` ; champ `raisonneur_actif` par ligne |

> ⚠️ Sans raisonneur, `rdf:type edu:Evaluation` renvoie 0 (les individus sont
> typés avec les sous-classes `Examen`/`Quiz`). Avec l'inférence OWL il renvoie 2.
> Le widget « Raisonneur OWL — Fuseki » du back-office contrôle cette égalité.

Le script `backend/scripts/setup_dataset.py` a été adapté : il détecte le service
config.ttl (sinon crée le dataset en secours via l'API admin), charge le OWL puis
vérifie l'activation du raisonneur.

## 2) Charger l'ontologie OWL dans Fuseki

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
python scripts\setup_dataset.py
```

Le script : crée le dataset si absent → PUT du fichier OWL (Graph Store Protocol) → exécute une requête de vérification.

## 3) Démarrer l'API FastAPI

```bash
# backend/ (toujours avec le venv actif)
uvicorn app.main:app --reload --port 8000
```

- Swagger UI : http://localhost:8000/docs

Endpoints principaux (préfixe `/api`) :

| Endpoint                          | Données OWL extraites                              |
|-----------------------------------|----------------------------------------------------|
| `GET /api/education/sante`        | disponibilité du dataset                           |
| `GET /api/education/cours`        | cours + durée + type + prérequis + compétences + formateurs |
| `GET /api/education/etudiants`    | étudiants + niveau + cours/formations/certifications |
| `GET /api/education/formateurs`   | formateurs + domaine + cours enseignés             |
| `GET /api/education/formations`   | formations + programme + certification + étudiants |
| `GET /api/education/competences`  | compétences + cours développeurs + prérequis       |
| `GET /api/education/programmes`   | programmes pédagogiques + formations               |
| `GET /api/education/parcours`     | parcours d'apprentissage + cours                   |
| `GET /api/education/evaluations`  | examens et quiz                                    |
| `GET /api/education/certifications`| certifications + organismes                       |
| `GET /api/education/statistiques` | compteurs par classe (rdfs:subClassOf utilisés)    |
| `GET /api/education/hierarchie`   | arbre des classes OWL                              |
| `POST /api/ontologie/charger`     | recharge le fichier OWL dans Fuseki                |
| `POST /api/ontologie/televerser`  | upload d'un autre fichier OWL via l'UI             |
| `GET /api/ontologie/prerequis-competences` | chaîne complète Prérequis → Cours → Compétence |

## 4) Dashboard back-office (React / Vite)

```bash
cd dashboard
# éventuellement : créer dashboard/.env avec VITE_API_URL=http://localhost:8000/api
npm install
npm run dev
```

Se rendre sur la page **« Ontologie Éducation »** (menu Apps → /education).

## 5) Landing front-office (Next.js)

```bash
# racine du projet
npm install
npm run dev
```

La section « Catalogue des cours issu du graphe de connaissances » s'affiche sur la page
d'accueil après la section des cours statiques. Configurable via
`.env.local` : `NEXT_PUBLIC_API_URL=http://localhost:8000/api`.

## Critère de réussite

1. `curl http://localhost:8000/api/education/statistiques` → 10 classes avec compteurs ≥ 1.
2. `curl http://localhost:8000/api/education/types-inferes` → `raisonneur_actif: true`
   (preuve que l'inférence OWL est en service).
3. Fuseki UI : dataset `education` présent, requête `SELECT * { ?s ?p ?o } LIMIT 5` renvoie des triplets.
4. La page d'accueil affiche Python / JavaScript / Angular avec durées et prérequis issus de l'ontologie.

## Notes techniques

- Les requêtes SPARQL (13) sont centralisées dans `backend/app/queries.py` et ont été
  **validées contre le fichier OWL réel** (337 triplets) — variables optionnelles
  protégées par `COALESCE` pour compatibilité ARQ **et** rdflib.
- Le client SPARQL (`backend/app/sparql_client.py`) utilise `SPARQLWrapper` et renvoie
  les URIs **en nom local** (`#Angular` → `Angular`).
- Le OWL est chargé via le protocole Graph Store (PUT `?graph=urn:default`).
- CORS ouvert sur `http://localhost:3000` (Next.js) et `http://localhost:5173` (Vite).
