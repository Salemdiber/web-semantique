"""CRUD des évaluations et certifications de l'ontologie.

Une évaluation porte un nom, une date, une note maximale, une note minimale de
réussite et éventuellement le résultat obtenu par l'étudiant. Une certification
peut être reliée à une évaluation et à une compétence, avec une condition
d'obtention (note >= seuil) : l'attribution des étudiants est refusée tant que
le résultat de l'évaluation ne satisfait pas cette condition.

Ces deux classes sont des individus OWL stockés dans Fuseki : la création, la
modification et la suppression passent par son endpoint SPARQL Update (voir
`app/ontologie_ecriture.py`).

Accès en écriture : administrateurs et formateurs authentifiés.
"""
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app import ontologie_ecriture as ecriture
from app import quiz as quiz_stockage
from app.routers.auth import utilisateur_courant
from app.routers.education import (
    EDU,
    OWL_NS,
    PREFIX,
    RDFS_NS,
    TYPES_CERTIFICATION,
    TYPES_EVALUATION,
    exec_,
    row_to_certification,
    row_to_evaluation,
)

router = APIRouter(prefix="/education", tags=["Évaluations & Certifications"])


# ------------------------------------------------------------- schémas -----
class EvaluationEntree(BaseModel):
    nom: str = Field(min_length=2, max_length=120)
    type: str = "Quiz"
    cours: str = Field(min_length=1, max_length=120)
    etudiant: str | None = Field(default=None, max_length=120)
    competence: str | None = Field(default=None, max_length=120)
    date: str | None = Field(default=None, max_length=20)
    note_max: float = Field(default=20, gt=0, le=100)
    note_min: float = Field(default=12, ge=0)
    note: float | None = Field(default=None, ge=0)

    @field_validator("type")
    @classmethod
    def type_valide(cls, valeur: str) -> str:
        if valeur not in TYPES_EVALUATION:
            raise ValueError("Type attendu : " + ", ".join(TYPES_EVALUATION))
        return valeur

    @field_validator("note_min")
    @classmethod
    def note_min_valide(cls, valeur: float) -> float:
        if valeur > 100:
            raise ValueError("La note minimale de réussite est trop élevée")
        return valeur

    def verifier_notes(self) -> None:
        if self.note_min > self.note_max:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "La note minimale de réussite ne peut pas dépasser "
                    "la note maximale"
                ),
            )
        if self.note is not None and self.note > self.note_max:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La note obtenue ne peut pas dépasser la note maximale",
            )
        if self.note is not None and not self.etudiant:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Une note est forcément individuelle : choisissez "
                    "l'étudiant concerné avant de saisir le résultat."
                ),
            )
        if self.type == "Quiz" and self.note is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "La note d'un quiz est calculée automatiquement à partir "
                    "des réponses de l'étudiant : elle ne peut pas être "
                    "saisie à la main."
                ),
            )


class CertificationEntree(BaseModel):
    nom: str = Field(min_length=2, max_length=120)
    organisme: str | None = Field(default=None, max_length=120)
    type: str = "Certification"
    formation: str | None = Field(default=None, max_length=120)
    competence: str | None = Field(default=None, max_length=120)
    evaluation: str | None = Field(default=None, max_length=120)
    seuil: float = Field(default=14, ge=0)
    date_obtention: str | None = Field(default=None, max_length=20)
    etudiants: list[str] = Field(default_factory=list)

    @field_validator("type")
    @classmethod
    def type_valide(cls, valeur: str) -> str:
        if valeur not in TYPES_CERTIFICATION:
            raise ValueError(
                "Type attendu : " + ", ".join(TYPES_CERTIFICATION)
            )
        return valeur


# ----------------------------------------------------- accès en écriture ---
def exiger_edition(
    utilisateur: Annotated[dict[str, Any], Depends(utilisateur_courant)],
) -> dict[str, Any]:
    """Créer/modifier le graphe : administrateurs et formateurs."""
    if utilisateur.get("role") not in ("admin", "formateur"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Réservé aux administrateurs et aux formateurs",
        )
    return utilisateur


# ------------------------------------------------------------------ utils ---
def _existe(nom: str) -> bool:
    rows = exec_(
        PREFIX + f"SELECT ?p WHERE {{ <{EDU}{nom}> ?p ?o }} LIMIT 1"
    )
    return bool(rows)


def _verifier(nom: str | None, libelle: str) -> str | None:
    if not nom:
        return None
    local = ecriture.nom_local(nom)
    if not _existe(local):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{libelle} introuvable : {local}",
        )
    return local


def _bloc(
    identifiant: str, libelle: str, classe: str, paires: list[tuple[str, str]]
) -> str:
    morceaux = [
        f"<{EDU}{identifiant}> a <{OWL_NS}NamedIndividual> , <{EDU}{classe}>",
        f'    <{RDFS_NS}label> "{ecriture.echapper(libelle)}"@fr',
    ]
    morceaux += [f"    <{predicat}> {objet}" for predicat, objet in paires]
    return " ;\n".join(morceaux) + " ."


def _litteral(valeur: str) -> str:
    return f'"{ecriture.echapper(valeur)}"'


def _executer(mise_a_jour: str) -> None:
    try:
        ecriture.executer(mise_a_jour)
    except ecriture.EcritureError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _note_evaluation(nom: str) -> float | None:
    rows = exec_(
        PREFIX
        + f"SELECT ?note WHERE {{ <{EDU}{nom}> edu:noteObtenue ?note }} "
        "LIMIT 1"
    )
    if not rows:
        return None
    try:
        return float(str(rows[0].get("note")).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _fiche_evaluation(nom: str) -> dict[str, Any]:
    query = PREFIX + f"""
    SELECT ?evaluation ?typeLabel ?cours ?coursNom ?etudiant ?etudiantNom
           ?competence ?competenceNom ?nomEvaluation ?dateEvaluation
           ?noteMaximale ?noteMinimaleReussite ?noteObtenue
    WHERE {{
        BIND (<{EDU}{nom}> AS ?evaluation)
        OPTIONAL {{
            ?evaluation rdf:type ?typedirect .
            ?typedirect rdfs:subClassOf edu:Evaluation .
            FILTER (?typedirect != edu:Evaluation)
            OPTIONAL {{ ?typedirect rdfs:label ?typeLabel }}
        }}
        OPTIONAL {{ ?evaluation edu:nomEvaluation ?nomEvaluation }}
        OPTIONAL {{ ?evaluation edu:dateEvaluation ?dateEvaluation }}
        OPTIONAL {{ ?evaluation edu:noteMaximale ?noteMaximale }}
        OPTIONAL {{
            ?evaluation edu:noteMinimaleReussite ?noteMinimaleReussite
        }}
        OPTIONAL {{ ?evaluation edu:noteObtenue ?noteObtenue }}
        OPTIONAL {{ ?evaluation edu:porteSur ?cours .
                    OPTIONAL {{ ?cours edu:nomCours ?coursNom }} }}
        OPTIONAL {{ ?evaluation edu:evalue ?etudiant .
                    OPTIONAL {{ ?etudiant edu:prenom ?etudiantNom }} }}
        OPTIONAL {{ ?evaluation edu:evalueCompetence ?competence .
                    OPTIONAL {{ ?competence edu:nomCompetence
                                ?competenceNom }} }}
    }}
    """
    rows = exec_(query)
    return row_to_evaluation(rows[0]) if rows else row_to_evaluation({})


def _fiche_certification(nom: str) -> dict[str, Any]:
    query = PREFIX + f"""
    SELECT ?certification ?nom ?organisme ?typeLabel ?formation ?formationNom
           ?competence ?competenceNom ?evaluation ?evaluationNom
           ?noteMinimaleCertification ?dateObtention
           (GROUP_CONCAT(DISTINCT ?etudiantNom; separator="|")
            AS ?etudiantNoms)
           (GROUP_CONCAT(DISTINCT ?etudiant; separator="|") AS ?etudiants)
    WHERE {{
        BIND (<{EDU}{nom}> AS ?certification)
        ?certification edu:nomCertification ?nom .
        OPTIONAL {{ ?certification edu:organisme ?organisme }}
        OPTIONAL {{ ?certification edu:dateObtention ?dateObtention }}
        OPTIONAL {{
            ?certification edu:noteMinimaleCertification
                ?noteMinimaleCertification
        }}
        OPTIONAL {{
            ?certification edu:certifieCompetence ?competence .
            OPTIONAL {{ ?competence edu:nomCompetence ?competenceNom }}
        }}
        OPTIONAL {{
            ?certification edu:certifieEvaluation ?evaluation .
            OPTIONAL {{ ?evaluation edu:nomEvaluation ?evaluationNom }}
        }}
        OPTIONAL {{
            ?certification rdf:type ?typedirect .
            ?typedirect rdfs:subClassOf edu:Certification .
            FILTER (?typedirect != edu:Certification)
            OPTIONAL {{ ?typedirect rdfs:label ?typeLabel }}
        }}
        OPTIONAL {{
            ?formation edu:meneVers ?certification .
            OPTIONAL {{ ?formation edu:nomFormation ?formationNom }}
        }}
        OPTIONAL {{
            ?etudiant edu:obtientCertification ?certification .
            OPTIONAL {{ ?etudiant edu:prenom ?etudiantNom }}
        }}
    }}
    GROUP BY ?certification ?nom ?organisme ?typeLabel ?formation
             ?formationNom ?competence ?competenceNom ?evaluation
             ?evaluationNom ?noteMinimaleCertification ?dateObtention
    """
    rows = exec_(query)
    return (
        row_to_certification(rows[0]) if rows else row_to_certification({})
    )


# ------------------------------------------------------- écriture OWL ------
def _ecrire_evaluation(
    identifiant: str, donnees: EvaluationEntree
) -> None:
    donnees.verifier_notes()
    cours = _verifier(donnees.cours, "Cours")
    etudiant = _verifier(donnees.etudiant, "Étudiant")
    competence = _verifier(donnees.competence, "Compétence")

    # La note d'un quiz provient uniquement de la tentative de l'étudiant :
    # une modification du questionnaire ou du libellé ne doit pas l'effacer.
    note_quiz = (
        _note_evaluation(identifiant) if donnees.type == "Quiz" else None
    )

    paires: list[tuple[str, str]] = [
        (f"{EDU}nomEvaluation", _litteral(donnees.nom)),
        (f"{EDU}noteMaximale", f"{donnees.note_max}"),
        (f"{EDU}noteMinimaleReussite", f"{donnees.note_min}"),
        (f"{EDU}porteSur", ecriture.iri(cours)),
    ]
    if donnees.date:
        paires.append((f"{EDU}dateEvaluation", _litteral(donnees.date)))
    if donnees.note is not None:
        paires.append((f"{EDU}noteObtenue", f"{donnees.note}"))
    elif note_quiz is not None:
        paires.append((f"{EDU}noteObtenue", f"{note_quiz}"))
    if etudiant:
        paires.append((f"{EDU}evalue", ecriture.iri(etudiant)))
    if competence:
        paires.append((f"{EDU}evalueCompetence", ecriture.iri(competence)))

    bloc = _bloc(identifiant, donnees.nom, donnees.type, paires)
    _executer(
        f"DELETE WHERE {{ <{EDU}{identifiant}> ?p ?o . }} ;\n"
        f"INSERT DATA {{\n{bloc}\n}}"
    )


def _etudiant_evaluation(nom: str) -> str | None:
    """Étudiant évalué par une évaluation (nom local), s'il est renseigné."""
    rows = exec_(
        PREFIX
        + f"SELECT ?etudiant WHERE {{ <{EDU}{nom}> edu:evalue ?etudiant }} "
        "LIMIT 1"
    )
    if not rows:
        return None
    return ecriture.nom_local(rows[0].get("etudiant"))


def _verifier_condition(
    evaluation: str | None, seuil: float, etudiants: list[str]
) -> None:
    """L'attribution d'une certification exige un résultat suffisant."""
    if not evaluation or not etudiants:
        return
    note = _note_evaluation(evaluation)
    if note is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Aucun résultat n'est enregistré pour cette évaluation : "
                "saisissez d'abord la note obtenue."
            ),
        )
    if note < seuil:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Condition d'obtention non satisfaite : "
                f"{note:g} < {seuil:g}."
            ),
        )
    # Une note appartient à un seul étudiant : on refuse de certifier un
    # autre étudiant avec le résultat de celui-ci.
    etudiant_evalue = _etudiant_evaluation(evaluation)
    if etudiant_evalue and etudiant_evalue not in etudiants:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Cette évaluation est nominative : elle ne peut certifier "
                "que l'étudiant qui a été évalué."
            ),
        )


def _ecrire_certification(
    identifiant: str, donnees: CertificationEntree
) -> None:
    formation = _verifier(donnees.formation, "Formation")
    competence = _verifier(donnees.competence, "Compétence")
    evaluation = _verifier(donnees.evaluation, "Évaluation")
    etudiants = [_verifier(e, "Étudiant") for e in donnees.etudiants]
    _verifier_condition(
        evaluation, donnees.seuil, [e for e in etudiants if e]
    )

    sujet = f"<{EDU}{identifiant}>"
    paires: list[tuple[str, str]] = [
        (f"{EDU}nomCertification", _litteral(donnees.nom)),
        (f"{EDU}noteMinimaleCertification", f"{donnees.seuil}"),
    ]
    if donnees.organisme:
        paires.append((f"{EDU}organisme", _litteral(donnees.organisme)))
    if donnees.date_obtention:
        paires.append(
            (f"{EDU}dateObtention", _litteral(donnees.date_obtention))
        )
    if competence:
        paires.append(
            (f"{EDU}certifieCompetence", ecriture.iri(competence))
        )
    if evaluation:
        paires.append(
            (f"{EDU}certifieEvaluation", ecriture.iri(evaluation))
        )
    bloc = _bloc(identifiant, donnees.nom, donnees.type, paires)

    # Liens entrants (formation, étudiants) : on repart de zéro.
    instructions = [
        f"DELETE WHERE {{ ?f <{EDU}meneVers> {sujet} . }}",
        f"DELETE WHERE {{ ?e <{EDU}obtientCertification> {sujet} . }}",
        f"DELETE WHERE {{ {sujet} ?p ?o . }}",
    ]
    liens: list[str] = []
    if formation:
        liens.append(f"<{EDU}{formation}> <{EDU}meneVers> {sujet} .")
    for etudiant in etudiants:
        if etudiant:
            liens.append(
                f"<{EDU}{etudiant}> <{EDU}obtientCertification> {sujet} ."
            )
    insertion = f"INSERT DATA {{\n{bloc}\n"
    if liens:
        insertion += "\n".join(liens) + "\n"
    insertion += "}"
    instructions.append(insertion)
    _executer(" ;\n".join(instructions))


# ------------------------------------------------------- routes CRUD -------
@router.post(
    "/evaluations",
    status_code=status.HTTP_201_CREATED,
    summary="Créer une évaluation (administrateur/formateur)",
)
def creer_evaluation(
    donnees: EvaluationEntree,
    _: Annotated[dict[str, Any], Depends(exiger_edition)],
) -> dict[str, Any]:
    identifiant = ecriture.generer_id(
        donnees.type, ecriture.nom_local(donnees.cours)
    )
    _ecrire_evaluation(identifiant, donnees)
    return _fiche_evaluation(identifiant)


@router.put(
    "/evaluations/{evaluation_id}",
    summary="Modifier une évaluation (administrateur/formateur)",
)
def modifier_evaluation(
    evaluation_id: str,
    donnees: EvaluationEntree,
    _: Annotated[dict[str, Any], Depends(exiger_edition)],
) -> dict[str, Any]:
    identifiant = ecriture.nom_local(evaluation_id)
    if not _existe(identifiant):
        raise HTTPException(status_code=404, detail="Évaluation introuvable")
    _ecrire_evaluation(identifiant, donnees)
    return _fiche_evaluation(identifiant)


@router.delete(
    "/evaluations/{evaluation_id}",
    summary="Supprimer une évaluation (administrateur/formateur)",
)
def supprimer_evaluation(
    evaluation_id: str,
    _: Annotated[dict[str, Any], Depends(exiger_edition)],
) -> dict[str, str]:
    identifiant = ecriture.nom_local(evaluation_id)
    if not _existe(identifiant):
        raise HTTPException(status_code=404, detail="Évaluation introuvable")
    _executer(f"DELETE WHERE {{ <{EDU}{identifiant}> ?p ?o . }}")
    quiz_stockage.supprimer_evaluation(identifiant)
    return {"statut": "supprime"}


@router.post(
    "/certifications",
    status_code=status.HTTP_201_CREATED,
    summary="Créer une certification (administrateur/formateur)",
)
def creer_certification(
    donnees: CertificationEntree,
    _: Annotated[dict[str, Any], Depends(exiger_edition)],
) -> dict[str, Any]:
    identifiant = ecriture.generer_id(donnees.type, donnees.nom)
    _ecrire_certification(identifiant, donnees)
    return _fiche_certification(identifiant)


@router.put(
    "/certifications/{certification_id}",
    summary="Modifier une certification (administrateur/formateur)",
)
def modifier_certification(
    certification_id: str,
    donnees: CertificationEntree,
    _: Annotated[dict[str, Any], Depends(exiger_edition)],
) -> dict[str, Any]:
    identifiant = ecriture.nom_local(certification_id)
    if not _existe(identifiant):
        raise HTTPException(
            status_code=404, detail="Certification introuvable"
        )
    _ecrire_certification(identifiant, donnees)
    return _fiche_certification(identifiant)


@router.delete(
    "/certifications/{certification_id}",
    summary="Supprimer une certification (administrateur/formateur)",
)
def supprimer_certification(
    certification_id: str,
    _: Annotated[dict[str, Any], Depends(exiger_edition)],
) -> dict[str, str]:
    identifiant = ecriture.nom_local(certification_id)
    if not _existe(identifiant):
        raise HTTPException(
            status_code=404, detail="Certification introuvable"
        )
    sujet = f"<{EDU}{identifiant}>"
    _executer(
        f"DELETE WHERE {{ ?f <{EDU}meneVers> {sujet} . }} ;\n"
        f"DELETE WHERE {{ ?e <{EDU}obtientCertification> {sujet} . }} ;\n"
        f"DELETE WHERE {{ {sujet} ?p ?o . }}"
    )
    return {"statut": "supprime"}
