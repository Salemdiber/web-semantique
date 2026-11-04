"""Stockage opérationnel des parcours d'apprentissage (SQLite).

Architecture hybride cohérente avec `quiz.py` :
- `edu:contientCoursParcours` dans Fuseki/OWL demeure l'unique source de vérité
  sémantique d'appartenance des cours à un parcours.
- `parcours_cours_ordre` persiste l'ordre séquentiel des étapes (RDF n'ayant
  pas d'ordre natif sur les propriétés objet simples sans listes RDF lourdes).
- `parcours_inscriptions` gère les inscriptions des étudiants aux parcours.
- `parcours_cours_suivis` trace les triplets `edu:suitCours` ajoutés
  automatiquement lors d'une inscription afin de pouvoir les retirer proprement
  et sans effet de bord lors d'une désinscription ou suppression de parcours.
"""
from __future__ import annotations

import sqlite3
from typing import Any

from app import db

SCHEMA = """
CREATE TABLE IF NOT EXISTS parcours_cours_ordre (
    parcours_id TEXT    NOT NULL,
    cours_id    TEXT    NOT NULL,
    position    INTEGER NOT NULL,
    PRIMARY KEY (parcours_id, cours_id)
);
CREATE INDEX IF NOT EXISTS idx_parcours_ordre_id
    ON parcours_cours_ordre (parcours_id, position);

CREATE TABLE IF NOT EXISTS parcours_inscriptions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id INTEGER NOT NULL,
    parcours_id    TEXT    NOT NULL,
    statut         TEXT    NOT NULL DEFAULT 'inscrit'
                           CHECK (statut IN ('inscrit', 'en_cours', 'termine')),
    cree_le        TEXT    NOT NULL DEFAULT (datetime('now')),
    maj_le         TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (utilisateur_id, parcours_id)
);
CREATE INDEX IF NOT EXISTS idx_parcours_inscr_parcours
    ON parcours_inscriptions (parcours_id);
CREATE INDEX IF NOT EXISTS idx_parcours_inscr_user
    ON parcours_inscriptions (utilisateur_id);

CREATE TABLE IF NOT EXISTS parcours_cours_suivis (
    utilisateur_id INTEGER NOT NULL,
    parcours_id    TEXT    NOT NULL,
    cours_id       TEXT    NOT NULL,
    PRIMARY KEY (utilisateur_id, parcours_id, cours_id)
);
"""

ORDRE_INITIAL_SEED: dict[str, list[str]] = {
    "Parcours_Data": ["Python"],
    "Parcours_Web": ["JavaScript", "Angular"],
    "Parcours_FullStack": ["Python", "JavaScript", "Angular"],
}


def initialiser() -> None:
    """Crée les tables et initialise l'ordre par défaut des parcours exemples."""
    with db.connexion() as base:
        base.executescript(SCHEMA)
        for parcours_id, cours_ids in ORDRE_INITIAL_SEED.items():
            existe = base.execute(
                "SELECT 1 FROM parcours_cours_ordre WHERE parcours_id = ? LIMIT 1",
                (parcours_id,),
            ).fetchone()
            if not existe:
                for pos, cid in enumerate(cours_ids, start=1):
                    base.execute(
                        "INSERT OR IGNORE INTO parcours_cours_ordre "
                        "(parcours_id, cours_id, position) VALUES (?, ?, ?)",
                        (parcours_id, cid, pos),
                    )


# --------------------------------------------------------- ordre des cours ---
def lire_ordre(parcours_id: str) -> list[str]:
    with db.connexion() as base:
        lignes = base.execute(
            "SELECT cours_id FROM parcours_cours_ordre "
            "WHERE parcours_id = ? ORDER BY position ASC, cours_id ASC",
            (parcours_id,),
        ).fetchall()
    return [str(l["cours_id"]) for l in lignes]


def enregistrer_ordre(parcours_id: str, cours_ids: list[str]) -> None:
    """Remplace l'ordre séquentiel complet d'un parcours."""
    uniques: list[str] = []
    vus: set[str] = set()
    for cid in cours_ids:
        if cid and cid not in vus:
            vus.add(cid)
            uniques.append(cid)

    with db.connexion() as base:
        base.execute(
            "DELETE FROM parcours_cours_ordre WHERE parcours_id = ?",
            (parcours_id,),
        )
        for index, cid in enumerate(uniques, start=1):
            base.execute(
                "INSERT INTO parcours_cours_ordre (parcours_id, cours_id, position) "
                "VALUES (?, ?, ?)",
                (parcours_id, cid, index),
            )


def reconcilier_ordre(parcours_id: str, cours_owl: list[str]) -> list[str]:
    """Aligne l'ordre SQLite sur la vérité sémantique `edu:contientCoursParcours`."""
    ensemble_owl = {c for c in cours_owl if c}
    actuel = lire_ordre(parcours_id)
    ordonnes = [c for c in actuel if c in ensemble_owl]
    manquants = sorted(ensemble_owl - set(ordonnes))
    resultat = ordonnes + manquants
    if resultat != actuel:
        enregistrer_ordre(parcours_id, resultat)
    return resultat


# ------------------------------------------------------------ inscriptions ---
def _ligne_inscription(ligne: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": int(ligne["id"]),
        "utilisateurId": int(ligne["utilisateur_id"]),
        "parcoursId": str(ligne["parcours_id"]),
        "statut": str(ligne["statut"]),
        "creeLe": str(ligne["cree_le"]),
        "majLe": str(ligne["maj_le"]),
    }


def trouver_inscription(
    utilisateur_id: int, parcours_id: str
) -> dict[str, Any] | None:
    with db.connexion() as base:
        ligne = base.execute(
            "SELECT * FROM parcours_inscriptions "
            "WHERE utilisateur_id = ? AND parcours_id = ?",
            (utilisateur_id, parcours_id),
        ).fetchone()
    return _ligne_inscription(ligne) if ligne else None


def inscrire(utilisateur_id: int, parcours_id: str) -> tuple[dict[str, Any], bool]:
    """Inscrit un étudiant à un parcours. Renvoie (fiche, nouvellement_cree)."""
    existante = trouver_inscription(utilisateur_id, parcours_id)
    if existante is not None:
        return existante, False

    with db.connexion() as base:
        curseur = base.execute(
            "INSERT INTO parcours_inscriptions (utilisateur_id, parcours_id, statut) "
            "VALUES (?, ?, 'en_cours')",
            (utilisateur_id, parcours_id),
        )
        ligne = base.execute(
            "SELECT * FROM parcours_inscriptions WHERE id = ?",
            (curseur.lastrowid,),
        ).fetchone()
    return _ligne_inscription(ligne), True


def marquer_cours_suivi(
    utilisateur_id: int, parcours_id: str, cours_id: str
) -> None:
    with db.connexion() as base:
        base.execute(
            "INSERT OR IGNORE INTO parcours_cours_suivis "
            "(utilisateur_id, parcours_id, cours_id) VALUES (?, ?, ?)",
            (utilisateur_id, parcours_id, cours_id),
        )


def desinscrire(
    utilisateur_id: int, parcours_id: str
) -> tuple[bool, list[str]]:
    """Désinscrit un étudiant et renvoie la liste des `cours_id` dont le triplet
    `edu:suitCours` peut être retiré (non suivis via un autre parcours actif).
    """
    with db.connexion() as base:
        suivis = [
            str(r["cours_id"])
            for r in base.execute(
                "SELECT cours_id FROM parcours_cours_suivis "
                "WHERE utilisateur_id = ? AND parcours_id = ?",
                (utilisateur_id, parcours_id),
            ).fetchall()
        ]
        curseur = base.execute(
            "DELETE FROM parcours_inscriptions "
            "WHERE utilisateur_id = ? AND parcours_id = ?",
            (utilisateur_id, parcours_id),
        )
        base.execute(
            "DELETE FROM parcours_cours_suivis "
            "WHERE utilisateur_id = ? AND parcours_id = ?",
            (utilisateur_id, parcours_id),
        )
        a_retirer: list[str] = []
        for cid in suivis:
            encore = base.execute(
                "SELECT 1 FROM parcours_cours_suivis "
                "WHERE utilisateur_id = ? AND cours_id = ? LIMIT 1",
                (utilisateur_id, cid),
            ).fetchone()
            if not encore:
                a_retirer.append(cid)
    return curseur.rowcount > 0, a_retirer


def maj_statut_inscription(
    utilisateur_id: int, parcours_id: str, statut: str
) -> None:
    if statut not in ("inscrit", "en_cours", "termine"):
        return
    with db.connexion() as base:
        base.execute(
            "UPDATE parcours_inscriptions "
            "SET statut = ?, maj_le = datetime('now') "
            "WHERE utilisateur_id = ? AND parcours_id = ? AND statut != ?",
            (statut, utilisateur_id, parcours_id, statut),
        )


def inscriptions_utilisateur(utilisateur_id: int) -> list[dict[str, Any]]:
    with db.connexion() as base:
        lignes = base.execute(
            "SELECT * FROM parcours_inscriptions "
            "WHERE utilisateur_id = ? ORDER BY cree_le DESC",
            (utilisateur_id,),
        ).fetchall()
    return [_ligne_inscription(l) for l in lignes]


def inscrits_parcours(parcours_id: str) -> list[dict[str, Any]]:
    """Liste détaillée des étudiants inscrits à un parcours donné."""
    with db.connexion() as base:
        lignes = base.execute(
            """
            SELECT i.id, i.utilisateur_id, i.parcours_id, i.statut,
                   i.cree_le, i.maj_le,
                   u.nom, u.email, u.actif
            FROM parcours_inscriptions i
            JOIN utilisateurs u ON u.id = i.utilisateur_id
            WHERE i.parcours_id = ?
            ORDER BY i.cree_le DESC
            """,
            (parcours_id,),
        ).fetchall()
    return [
        {
            "id": int(l["id"]),
            "utilisateurId": int(l["utilisateur_id"]),
            "nom": str(l["nom"]),
            "email": str(l["email"]),
            "actif": bool(l["actif"]),
            "statut": str(l["statut"]),
            "creeLe": str(l["cree_le"]),
            "majLe": str(l["maj_le"]),
        }
        for l in lignes
    ]


def compter_inscrits_par_parcours() -> dict[str, int]:
    with db.connexion() as base:
        lignes = base.execute(
            "SELECT parcours_id, COUNT(*) AS nb "
            "FROM parcours_inscriptions GROUP BY parcours_id"
        ).fetchall()
    return {str(l["parcours_id"]): int(l["nb"]) for l in lignes}


def toutes_inscriptions() -> list[dict[str, Any]]:
    with db.connexion() as base:
        lignes = base.execute(
            "SELECT * FROM parcours_inscriptions ORDER BY cree_le DESC"
        ).fetchall()
    return [_ligne_inscription(l) for l in lignes]


def supprimer_parcours(
    parcours_id: str,
) -> tuple[int, list[tuple[int, str]]]:
    """Purge l'ordre, les inscriptions et les suivis liés à un parcours supprimé.

    Renvoie `(nb_inscriptions_supprimees, [(utilisateur_id, cours_id), ...])`
    pour permettre le nettoyage éventuel des triplets `edu:suitCours` dans Fuseki.
    """
    with db.connexion() as base:
        suivis = [
            (int(r["utilisateur_id"]), str(r["cours_id"]))
            for r in base.execute(
                "SELECT utilisateur_id, cours_id FROM parcours_cours_suivis "
                "WHERE parcours_id = ?",
                (parcours_id,),
            ).fetchall()
        ]
        base.execute(
            "DELETE FROM parcours_cours_ordre WHERE parcours_id = ?",
            (parcours_id,),
        )
        cur = base.execute(
            "DELETE FROM parcours_inscriptions WHERE parcours_id = ?",
            (parcours_id,),
        )
        base.execute(
            "DELETE FROM parcours_cours_suivis WHERE parcours_id = ?",
            (parcours_id,),
        )
        orphelins: list[tuple[int, str]] = []
        for uid, cid in suivis:
            encore = base.execute(
                "SELECT 1 FROM parcours_cours_suivis "
                "WHERE utilisateur_id = ? AND cours_id = ? LIMIT 1",
                (uid, cid),
            ).fetchone()
            if not encore:
                orphelins.append((uid, cid))
    return cur.rowcount, orphelins

