"""Client SPARQL vers Apache Jena Fuseki + utilitaires de conversion RDF -> JSON."""
from typing import Any

from SPARQLWrapper import BASIC, JSON, SPARQLWrapper
from SPARQLWrapper.SPARQLExceptions import SPARQLWrapperException

from app import config

EDU_BASE = "http://example.org/education-formation#"


class FusekiError(Exception):
    """Erreur renvoyée lorsque Fuseki est injoignable ou échoue."""


class FusekiClient:
    """Client de requêtes SPARQL SELECT/CONSTRUCT sur le dataset Fuseki."""

    def __init__(self, timeout: int = 30) -> None:
        self.query_endpoint = (
            f"{config.FUSEKI_URL}/{config.FUSEKI_DATASET}/query"
        )
        self.timeout = timeout

    def _wrapper(self) -> SPARQLWrapper:
        wrapper = SPARQLWrapper(self.query_endpoint)
        wrapper.setTimeout(self.timeout)
        if config.FUSEKI_USER:
            wrapper.setHTTPAuth(BASIC)
            wrapper.setCredentials(config.FUSEKI_USER, config.FUSEKI_PASSWORD)
        wrapper.setReturnFormat(JSON)
        return wrapper

    def select(self, query: str) -> list[dict[str, Any]]:
        """Exécute une requête SELECT et renvoie une liste de dictionnaires.
        Chaque valeur : nom de variable -> valeur littérale ou nom local d'URI."""
        wrapper = self._wrapper()
        wrapper.setQuery(query)
        try:
            response = wrapper.query().convert()
        except SPARQLWrapperException as exc:  # Fuseki injoignable / erreur HTTP
            raise FusekiError(f"Fuseki injoignable : {exc}") from exc

        try:
            bindings = response["results"]["bindings"]
        except (TypeError, KeyError) as exc:
            raise FusekiError(
                f"Réponse SPARQL inattendue : {response}"
            ) from exc

        rows = []
        for binding in bindings:
            row: dict[str, Any] = {}
            for var, raw in binding.items():
                row[var] = self._normalize(raw)
            rows.append(row)
        return rows

    # ------------------------------------------------------------------ utils
    @staticmethod
    def _normalize(raw: dict[str, Any]) -> Any:
        """Restitue un terme RDF : uri -> nom local ('Cours'), littéral -> valeur."""
        term_type = raw.get("type", "literal")
        value = raw.get("value", "")
        if term_type == "uri":
            return value.split(EDU_BASE)[-1].split("#")[-1] or value
        return value


def empty_row(*columns: str) -> dict[str, Any]:
    """Fournit une ligne vide avec clés à None (normalisation des GROUP_CONCAT)."""
    return {c: None for c in columns}
