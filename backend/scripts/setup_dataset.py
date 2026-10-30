"""Initialisation du dataset Fuseki et chargement du fichier OWL.

Prérequis :
    docker compose up -d      (dataset "education" défini par fuseki/config.ttl,
                               raisonneur OWL OWLFBRuleReasoner actif)

Usage :
    python scripts/setup_dataset.py
    python scripts/setup_dataset.py --owl ../education_formation_protege.owl
"""
import argparse
import sys
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parent.parent       # backend/
PROJECT_ROOT = BASE_DIR.parent                          # racine du projet

sys.path.insert(0, str(BASE_DIR))

from app import config  # noqa: E402

PREFIXE = """PREFIX edu: <http://example.org/education-formation#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
"""

AUTH = (config.FUSEKI_USER, config.FUSEKI_PASSWORD)


def dataset_disponible() -> bool:
    """Le service /education répond-il au SPARQL ? (config.ttl ou admin API)"""
    try:
        r = requests.get(
            f"{config.FUSEKI_URL}/{config.FUSEKI_DATASET}/query",
            params={"query": "ASK {}"},
            auth=AUTH,
            timeout=10,
        )
        return r.status_code == 200
    except requests.RequestException:
        return False


def creer_dataset() -> None:
    """Crée le dataset via l'API admin (secours si config.ttl non pris en compte)."""
    r = requests.post(
        f"{config.FUSEKI_URL}/$/datasets",
        auth=AUTH,
        data={"dbName": config.FUSEKI_DATASET, "dbType": "tdb2"},
        timeout=60,
    )
    if r.status_code not in (201, 200):
        print(f"Création dataset : HTTP {r.status_code} — {r.text}")


def charger_owl(chemin: Path) -> None:
    """PUT de l'ontologie DANS le graphe par défaut via Graph Store Protocol.

    Important : utiliser ?default (et non ?graph=urn:default) — avec un
    dataset assemblé en ja:RDFDataset/ja:InfModel, la forme ?default cible
    bien le graphe par défaut (base du raisonneur OWL).
    """
    url = f"{config.FUSEKI_URL}/{config.FUSEKI_DATASET}/data?default"
    r = requests.put(
        url,
        data=chemin.read_bytes(),
        headers={"Content-Type": "application/rdf+xml"},
        auth=AUTH,
        timeout=120,
    )
    if r.status_code not in (200, 201, 204):
        raise SystemExit(f"Échec PUT data : {r.status_code} — {r.text[:400]}")
    print(f"OK Ontologie chargée ({chemin.name}) dans /{config.FUSEKI_DATASET}")


def verifier() -> None:
    """Vérifie les données rangées puis le fonctionnement du raisonneur OWL."""
    # 1) Triangles RDF
    r = requests.get(
        f"{config.FUSEKI_URL}/{config.FUSEKI_DATASET}/query",
        params={"query": 'SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }'},
        auth=AUTH,
        timeout=30,
    )
    if r.status_code != 200:
        print("Vérification impossible :", r.text[:300])
        return
    print("Vérification des données :", r.text[:200])

    # 2) rdf:type direct (= sans prendre en compte l'inférence de sous-classage)
    direct = compter(PREFIXE + 'SELECT (COUNT(DISTINCT ?x) AS ?n) '
                                  'WHERE { ?x rdf:type edu:Evaluation }')
    # 3) avec rdfs:subClassOf* (c'est la vérité même sans raisonneur)
    chemin = compter(PREFIXE + 'SELECT (COUNT(DISTINCT ?x) AS ?n) '
                                   'WHERE { ?x rdf:type/rdfs:subClassOf* edu:Evaluation }')
    print(f"Individus Évaluation — rdf:type direct : {direct}, "
          f"rdfs:subClassOf* : {chemin}")
    if direct >= chemin and chemin > 0:
        print("✅ Raisonneur OWL actif : rdf:type direct retrouve aussi les individus des sous-classes (Examen, Quiz).")
    else:
        print("⚠️ Raisonneur OWL inactif — vérifier que fuseki/config.ttl est bien "
              "monté et redémarrer : docker compose restart")


def compter(query: str) -> int:
    r = requests.get(
        f"{config.FUSEKI_URL}/{config.FUSEKI_DATASET}/query",
        params={"query": query},
        auth=AUTH,
        timeout=30,
    )
    try:
        for bind in r.json()["results"]["bindings"]:
            return int(bind["n"]["value"])
    except Exception:
        pass
    return -1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--owl",
        default=str(PROJECT_ROOT / "education_formation_protege.owl"),
        help="Chemin du fichier OWL",
    )
    args = parser.parse_args()
    chemin = Path(args.owl)
    if not chemin.exists():
        raise SystemExit(f"Fichier OWL introuvable : {chemin}")

    if not dataset_disponible():
        creer_dataset()
        if not dataset_disponible():
            raise SystemExit(
                "Le service /education ne répond pas.\n"
                "1) Vérifier : docker compose up -d\n"
                "2) Logs : docker logs fuseki-education\n"
                "3) Ou créer le dataset à la main : http://localhost:3030 (admin)\n"
                "Puis relancer : python scripts/setup_dataset.py"
            )
    else:
        print(f"Service /{config.FUSEKI_DATASET} disponible.")

    charger_owl(chemin)
    verifier()


if __name__ == "__main__":
    main()
