/** Types correspondant aux réponses de l'API sémantique (FastAPI + Fuseki). */

export type Cours = {
  id: string;
  nom: string;
  duree: string;
  description: string | null;
  type: string;
  prerequis: string[];
  competences: string[];
  formateurs: string[];
};

export type Etudiant = {
  id: string;
  prenom: string;
  niveau: string;
  formations: string[];
  cours: string[];
  certifications: string[];
};

export type Formateur = {
  id: string;
  prenom: string;
  domaine: string;
  cours: string[];
};

export type Formation = {
  id: string;
  nom: string;
  duree: string;
  programme: string | null;
  certification: string | null;
  cours: string[];
  etudiants: string[];
};

export type Competence = {
  id: string;
  nom: string;
  niveau: string | null;
  type: string | null;
  coursDeveloppant: string[];
  necessitee: string[];
};

export type Programme = {
  id: string;
  nom: string;
  annee: string | null;
  formations: string[];
};

export type Parcours = {
  id: string;
  type: string | null;
  cours: string[];
};

export type Evaluation = {
  id: string;
  type: string | null;
  cours: string;
  etudiant: string | null;
  competence: string | null;
};

export type CertificationType = {
  id: string;
  nom: string;
  organisme: string | null;
  type: string | null;
  formation: string | null;
  etudiants: string[];
};

export type Statistique = {
  classe: string;
  nom: string;
  nombre: number;
};

export type TypeInferes = {
  classe: string;
  nom: string;
  nombre_rdf_type_direct: number;
  nombre_avec_sous_classes: number;
  raisonneur_actif: boolean;
};

export type RelationCoursCompetence = {
  coursNom: string;
  prerequisNom?: string;
  prerequisCompetence?: string;
  competenceNom?: string;
  competenceNiveau?: string;
  duree?: string;
};
