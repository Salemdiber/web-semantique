"""Configuration de l'application (variables d'environnement)."""
import os
from pathlib import Path

from dotenv import load_dotenv

# Charge backend/.env
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

FUSEKI_URL: str = os.getenv("FUSEKI_URL", "http://localhost:3030")
FUSEKI_DATASET: str = os.getenv("FUSEKI_DATASET", "education")
FUSEKI_USER: str = os.getenv("FUSEKI_USER", "admin")
FUSEKI_PASSWORD: str = os.getenv("FUSEKI_PASSWORD", "admin")

# Chemin du fichier OWL Protégé (relatif à la racine du projet)
OWL_PATH: Path = BASE_DIR / os.getenv("OWL_PATH", "..\\education_formation_protege.owl")

CORS_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        (
            "http://localhost:3000,http://localhost:3001,http://localhost:3002,"
            "http://localhost:3010,http://localhost:5173,http://localhost:5174"
        ),
    ).split(",")
    if o.strip()
]

API_PREFIX: str = "/api"

# ------------------------------------------------- module utilisateur ---
# Comptes stockés dans une base SQLite (backend/data/utilisateurs.db).
DATA_DIR: Path = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
USERS_DB_PATH: str = os.getenv("USERS_DB_PATH", str(DATA_DIR / "utilisateurs.db"))

# Clé de signature des jetons. Vide => une clé est générée et conservée
# dans backend/data/.secret (les sessions survivent au redémarrage).
SECRET_KEY: str = os.getenv("SECRET_KEY", "")
TOKEN_EXPIRE_MINUTES: int = int(os.getenv("TOKEN_EXPIRE_MINUTES", "480"))

# Compte administrateur créé au premier démarrage s'il n'en existe aucun.
ADMIN_NOM: str = os.getenv("ADMIN_NOM", "Administrateur")
ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@si-education.tn")
ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "Admin@123")
