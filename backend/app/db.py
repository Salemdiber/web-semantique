"""Stockage des comptes utilisateurs (SQLite, stdlib).

Trois rôles : `admin`, `formateur`, `etudiant`.
La base est créée au premier démarrage et un compte administrateur est
ajouté s'il n'en existe aucun (identifiants dans `backend/.env`).
"""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from app import config
from app.security import hasher_mot_de_passe

ROLES = ("admin", "formateur", "etudiant")
ROLES_INSCRIPTION = ("formateur", "etudiant")

SCHEMA = """
CREATE TABLE IF NOT EXISTS utilisateurs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nom         TEXT    NOT NULL,
    email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    mot_de_passe TEXT   NOT NULL,
    role        TEXT    NOT NULL CHECK (role IN ('admin', 'formateur', 'etudiant')),
    actif       INTEGER NOT NULL DEFAULT 1,
    cree_le     TEXT    NOT NULL DEFAULT (datetime('now'))
);
"""


def chemin_base() -> Path:
    chemin = Path(config.USERS_DB_PATH)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    return chemin


def connexion() -> sqlite3.Connection:
    base = sqlite3.connect(chemin_base(), timeout=10)
    base.row_factory = sqlite3.Row
    base.execute("PRAGMA foreign_keys = ON")
    return base


def initialiser() -> None:
    """Crée la table si besoin et garantit la présence d'un administrateur."""
    with connexion() as base:
        base.executescript(SCHEMA)
        existe = base.execute(
            "SELECT COUNT(*) AS nb FROM utilisateurs WHERE role = 'admin'"
        ).fetchone()["nb"]
        if not existe:
            base.execute(
                "INSERT INTO utilisateurs (nom, email, mot_de_passe, role) "
                "VALUES (?, ?, ?, 'admin')",
                (
                    config.ADMIN_NOM,
                    config.ADMIN_EMAIL.lower(),
                    hasher_mot_de_passe(config.ADMIN_PASSWORD),
                ),
            )


def _public(ligne: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": ligne["id"],
        "nom": ligne["nom"],
        "email": ligne["email"],
        "role": ligne["role"],
        "actif": bool(ligne["actif"]),
        "cree_le": ligne["cree_le"],
    }


def lister() -> list[dict[str, Any]]:
    with connexion() as base:
        lignes = base.execute(
            "SELECT * FROM utilisateurs ORDER BY role, nom COLLATE NOCASE"
        ).fetchall()
    return [_public(l) for l in lignes]


def trouver_par_email(email: str) -> sqlite3.Row | None:
    with connexion() as base:
        return base.execute(
            "SELECT * FROM utilisateurs WHERE email = ? COLLATE NOCASE",
            (email.strip(),),
        ).fetchone()


def trouver_par_id(utilisateur_id: int) -> sqlite3.Row | None:
    with connexion() as base:
        return base.execute(
            "SELECT * FROM utilisateurs WHERE id = ?", (utilisateur_id,)
        ).fetchone()


def creer(nom: str, email: str, mot_de_passe: str, role: str) -> dict[str, Any]:
    with connexion() as base:
        curseur = base.execute(
            "INSERT INTO utilisateurs (nom, email, mot_de_passe, role) "
            "VALUES (?, ?, ?, ?)",
            (
                nom.strip(),
                email.strip().lower(),
                hasher_mot_de_passe(mot_de_passe),
                role,
            ),
        )
        ligne = base.execute(
            "SELECT * FROM utilisateurs WHERE id = ?", (curseur.lastrowid,)
        ).fetchone()
    return _public(ligne)


def modifier(utilisateur_id: int, role: str | None, actif: bool | None) -> dict[str, Any] | None:
    champs: list[str] = []
    valeurs: list[Any] = []
    if role is not None:
        champs.append("role = ?")
        valeurs.append(role)
    if actif is not None:
        champs.append("actif = ?")
        valeurs.append(1 if actif else 0)
    if not champs:
        ligne = trouver_par_id(utilisateur_id)
        return _public(ligne) if ligne else None

    valeurs.append(utilisateur_id)
    with connexion() as base:
        base.execute(
            f"UPDATE utilisateurs SET {', '.join(champs)} WHERE id = ?", valeurs
        )
        ligne = base.execute(
            "SELECT * FROM utilisateurs WHERE id = ?", (utilisateur_id,)
        ).fetchone()
    return _public(ligne) if ligne else None


def supprimer(utilisateur_id: int) -> bool:
    with connexion() as base:
        curseur = base.execute(
            "DELETE FROM utilisateurs WHERE id = ?", (utilisateur_id,)
        )
    return curseur.rowcount > 0
