"""Sécurité du module utilisateur.

- Mots de passe : PBKDF2-HMAC-SHA256 avec sel aléatoire (stdlib, aucune
  dépendance supplémentaire).
- Jetons d'accès : charge utile JSON signée en HMAC-SHA256, au format
  `<payload>.<signature>` (équivalent minimal d'un JWT HS256).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from pathlib import Path
from typing import Any

from app import config

ALGORITHME = "pbkdf2_sha256"
ITERATIONS = 260_000


# --------------------------------------------------------------- mots de passe
def _b64(octets: bytes) -> str:
    return base64.urlsafe_b64encode(octets).decode().rstrip("=")


def _de_b64(texte: str) -> bytes:
    retour = "=" * (-len(texte) % 4)
    return base64.urlsafe_b64decode(texte + retour)


def hasher_mot_de_passe(mot_de_passe: str) -> str:
    """Renvoie `pbkdf2_sha256$iterations$sel$empreinte`."""
    sel = secrets.token_bytes(16)
    empreinte = hashlib.pbkdf2_hmac(
        "sha256", mot_de_passe.encode("utf-8"), sel, ITERATIONS
    )
    return f"{ALGORITHME}${ITERATIONS}${_b64(sel)}${_b64(empreinte)}"


def verifier_mot_de_passe(mot_de_passe: str, stocke: str) -> bool:
    try:
        algorithme, iterations, sel, empreinte = stocke.split("$")
        if algorithme != ALGORITHME:
            return False
        calcule = hashlib.pbkdf2_hmac(
            "sha256",
            mot_de_passe.encode("utf-8"),
            _de_b64(sel),
            int(iterations),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(calcule, _de_b64(empreinte))


# ------------------------------------------------------------------- jetons
_SECRET_MEMOIRE: bytes | None = None


def _cle_secrete() -> bytes:
    """Clé de signature : variable d'environnement, sinon fichier persistant."""
    global _SECRET_MEMOIRE
    if _SECRET_MEMOIRE is not None:
        return _SECRET_MEMOIRE

    if config.SECRET_KEY:
        _SECRET_MEMOIRE = config.SECRET_KEY.encode("utf-8")
        return _SECRET_MEMOIRE

    fichier = Path(config.DATA_DIR) / ".secret"
    fichier.parent.mkdir(parents=True, exist_ok=True)
    if fichier.exists():
        _SECRET_MEMOIRE = fichier.read_bytes()
    else:
        _SECRET_MEMOIRE = secrets.token_bytes(48)
        fichier.write_bytes(_SECRET_MEMOIRE)
    return _SECRET_MEMOIRE


def creer_jeton(utilisateur_id: int, role: str, expire_minutes: int | None = None) -> str:
    duree = expire_minutes if expire_minutes is not None else config.TOKEN_EXPIRE_MINUTES
    charge: dict[str, Any] = {
        "sub": utilisateur_id,
        "role": role,
        "exp": int(time.time()) + duree * 60,
    }
    corps = _b64(json.dumps(charge, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(
        _cle_secrete(), corps.encode("ascii"), hashlib.sha256
    ).digest()
    return f"{corps}.{_b64(signature)}"


def lire_jeton(jeton: str) -> dict[str, Any] | None:
    """Vérifie la signature et l'expiration ; renvoie la charge utile ou None."""
    try:
        corps, signature = jeton.split(".")
        attendu = hmac.new(
            _cle_secrete(), corps.encode("ascii"), hashlib.sha256
        ).digest()
        if not hmac.compare_digest(attendu, _de_b64(signature)):
            return None
        charge = json.loads(_de_b64(corps))
    except (ValueError, TypeError, json.JSONDecodeError):
        return None
    if int(charge.get("exp", 0)) < int(time.time()):
        return None
    return charge
