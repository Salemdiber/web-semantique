"""Questions et tentatives de quiz (SQLite).

Les évaluations de type `Quiz` vivent dans l'ontologie (Fuseki), mais leurs
questions, choix et tentatives sont stockés dans la même base SQLite que les
comptes : un questionnaire n'a pas vocation à être modélisé en OWL.

Règle métier : une évaluation quiz n'est validée qu'après une tentative
réellement effectuée dans l'interface. La note écrite dans l'ontologie est
calculée ici à partir des réponses ; la saisie manuelle est refusée.
"""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from app import db

SCHEMA = """
CREATE TABLE IF NOT EXISTS quiz_questions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    evaluation_id TEXT    NOT NULL,
    enonce        TEXT    NOT NULL,
    choix         TEXT    NOT NULL,
    bonne_reponse INTEGER NOT NULL,
    points        REAL    NOT NULL DEFAULT 1,
    ordre         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_eval
    ON quiz_questions (evaluation_id);

CREATE TABLE IF NOT EXISTS quiz_tentatives (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    evaluation_id  TEXT    NOT NULL,
    utilisateur_id INTEGER NOT NULL,
    note           REAL    NOT NULL,
    score          REAL    NOT NULL,
    total          REAL    NOT NULL,
    reponses       TEXT    NOT NULL,
    tentatives     INTEGER NOT NULL DEFAULT 1,
    cree_le        TEXT    NOT NULL DEFAULT (datetime('now')),
    maj_le         TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (evaluation_id, utilisateur_id)
);
CREATE INDEX IF NOT EXISTS idx_quiz_tentatives_eval
    ON quiz_tentatives (evaluation_id);
"""


def initialiser() -> None:
    """Crée les tables de quiz si nécessaire (au démarrage de l'API)."""
    with db.connexion() as base:
        base.executescript(SCHEMA)


def _question(ligne: sqlite3.Row, avec_reponse: bool) -> dict[str, Any]:
    question: dict[str, Any] = {
        "id": ligne["id"],
        "evaluationId": ligne["evaluation_id"],
        "enonce": ligne["enonce"],
        "choix": json.loads(ligne["choix"]),
        "points": ligne["points"],
        "ordre": ligne["ordre"],
    }
    if avec_reponse:
        question["bonneReponse"] = ligne["bonne_reponse"]
    return question


def _tentative(ligne: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": ligne["id"],
        "evaluationId": ligne["evaluation_id"],
        "utilisateurId": ligne["utilisateur_id"],
        "note": ligne["note"],
        "score": ligne["score"],
        "total": ligne["total"],
        "reponses": json.loads(ligne["reponses"]),
        "tentatives": ligne["tentatives"],
        "date": ligne["cree_le"],
        "majLe": ligne["maj_le"],
    }


def lister_questions(
    evaluation_id: str, avec_reponses: bool = False
) -> list[dict[str, Any]]:
    with db.connexion() as base:
        lignes = base.execute(
            "SELECT * FROM quiz_questions WHERE evaluation_id = ? "
            "ORDER BY ordre, id",
            (evaluation_id,),
        ).fetchall()
    return [_question(ligne, avec_reponses) for ligne in lignes]


def compter_questions(evaluation_id: str) -> int:
    with db.connexion() as base:
        ligne = base.execute(
            "SELECT COUNT(*) AS nb FROM quiz_questions WHERE evaluation_id = ?",
            (evaluation_id,),
        ).fetchone()
    return int(ligne["nb"]) if ligne else 0


def remplacer_questions(
    evaluation_id: str, questions: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Remplace le questionnaire d'un quiz (écriture transactionnelle)."""
    with db.connexion() as base:
        base.execute(
            "DELETE FROM quiz_questions WHERE evaluation_id = ?",
            (evaluation_id,),
        )
        for ordre, question in enumerate(questions):
            base.execute(
                "INSERT INTO quiz_questions "
                "(evaluation_id, enonce, choix, bonne_reponse, points, ordre) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    evaluation_id,
                    question["enonce"].strip(),
                    json.dumps(question["choix"], ensure_ascii=False),
                    int(question["bonne_reponse"]),
                    float(question.get("points", 1)),
                    ordre,
                ),
            )
    return lister_questions(evaluation_id, avec_reponses=True)


def nombre_tentatives(evaluation_id: str) -> int:
    with db.connexion() as base:
        ligne = base.execute(
            "SELECT COUNT(*) AS nb FROM quiz_tentatives "
            "WHERE evaluation_id = ?",
            (evaluation_id,),
        ).fetchone()
    return int(ligne["nb"]) if ligne else 0


def tentative(
    evaluation_id: str, utilisateur_id: int
) -> dict[str, Any] | None:
    with db.connexion() as base:
        ligne = base.execute(
            "SELECT * FROM quiz_tentatives "
            "WHERE evaluation_id = ? AND utilisateur_id = ?",
            (evaluation_id, utilisateur_id),
        ).fetchone()
    return _tentative(ligne) if ligne else None


def enregistrer_tentative(
    evaluation_id: str,
    utilisateur_id: int,
    note: float,
    score: float,
    total: float,
    reponses: dict[str, int],
) -> dict[str, Any]:
    """Enregistre une tentative en conservant le meilleur score obtenu."""
    with db.connexion() as base:
        existante = base.execute(
            "SELECT * FROM quiz_tentatives "
            "WHERE evaluation_id = ? AND utilisateur_id = ?",
            (evaluation_id, utilisateur_id),
        ).fetchone()
        if existante is None:
            base.execute(
                "INSERT INTO quiz_tentatives "
                "(evaluation_id, utilisateur_id, note, score, total, "
                " reponses, tentatives) "
                "VALUES (?, ?, ?, ?, ?, ?, 1)",
                (
                    evaluation_id,
                    utilisateur_id,
                    note,
                    score,
                    total,
                    json.dumps(reponses, ensure_ascii=False),
                ),
            )
        else:
            # Le meilleur résultat est conservé ; le nombre de tentatives
            # augmente à chaque soumission.
            garde = existante["note"] >= note
            base.execute(
                "UPDATE quiz_tentatives SET "
                "note = ?, score = ?, total = ?, reponses = ?, "
                "tentatives = tentatives + 1, maj_le = datetime('now') "
                "WHERE id = ?",
                (
                    existante["note"] if garde else note,
                    existante["score"] if garde else score,
                    existante["total"] if garde else total,
                    existante["reponses"] if garde else json.dumps(
                        reponses, ensure_ascii=False
                    ),
                    existante["id"],
                ),
            )
        ligne = base.execute(
            "SELECT * FROM quiz_tentatives "
            "WHERE evaluation_id = ? AND utilisateur_id = ?",
            (evaluation_id, utilisateur_id),
        ).fetchone()
    return _tentative(ligne)


def supprimer_evaluation(evaluation_id: str) -> None:
    with db.connexion() as base:
        base.execute(
            "DELETE FROM quiz_questions WHERE evaluation_id = ?",
            (evaluation_id,),
        )
        base.execute(
            "DELETE FROM quiz_tentatives WHERE evaluation_id = ?",
            (evaluation_id,),
        )


def supprimer_utilisateur(utilisateur_id: int) -> None:
    with db.connexion() as base:
        base.execute(
            "DELETE FROM quiz_tentatives WHERE utilisateur_id = ?",
            (utilisateur_id,),
        )


def reinitialiser_tentatives(evaluation_id: str) -> int:
    with db.connexion() as base:
        curseur = base.execute(
            "DELETE FROM quiz_tentatives WHERE evaluation_id = ?",
            (evaluation_id,),
        )
    return curseur.rowcount
