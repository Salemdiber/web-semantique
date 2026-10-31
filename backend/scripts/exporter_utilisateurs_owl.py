"""Réécrit dans le fichier OWL les individus des comptes utilisateurs.

L'export est aussi déclenché automatiquement par l'API après chaque
inscription, changement de rôle ou suppression de compte. Ce script permet
de le lancer à la main (par exemple après avoir restauré une sauvegarde).

Utilisation (depuis backend/) :
    .venv\\Scripts\\python.exe scripts\\exporter_utilisateurs_owl.py
"""
from __future__ import annotations

import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))

from app import db, export_owl  # noqa: E402


def main() -> int:
    db.initialiser()
    try:
        bilan = export_owl.exporter()
    except export_owl.ExportOwlErreur as exc:
        print(f"[ERREUR] {exc}")
        return 1

    print(f"Fichier OWL      : {bilan['fichier']}")
    print(f"Sauvegarde       : {bilan['fichier']}.bak")
    print(f"Comptes exportés : {bilan['comptes']}")
    print(f"Blocs remplacés  : {bilan['blocs_remplaces']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
