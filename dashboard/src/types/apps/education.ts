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
  nom: string;
  type: string | null;
  cours: string;
  coursId: string | null;
  etudiant: string | null;
  etudiantId: string | null;
  competence: string | null;
  competenceId: string | null;
  date: string | null;
  noteMax: number;
  noteMin: number;
  note: number | null;
  reussi: boolean | null;
  /** Nombre de questions du questionnaire (quiz uniquement). */
  quizQuestions?: number;
  /** true si l'étudiant connecté a déjà soumis une tentative. */
  quizPasse?: boolean | null;
};

export type QuizQuestion = {
  id: number;
  evaluationId?: string;
  enonce: string;
  choix: string[];
  points: number;
  ordre?: number;
  /** Présent uniquement dans la vue encadrant. */
  bonneReponse?: number;
};

export type QuizTentative = {
  id: number;
  evaluationId: string;
  utilisateurId: number;
  note: number;
  score: number;
  total: number;
  reponses: Record<string, number>;
  tentatives: number;
  date: string;
  majLe: string;
};

export type QuizDetail = {
  evaluationId: string;
  nom: string;
  cours: string;
  noteMax: number;
  noteMin: number;
  questions: QuizQuestion[];
  tentative: QuizTentative | null;
  dejaReussi: boolean;
};

export type CorrectionQuiz = {
  questionId: number;
  choix: number;
  bonneReponse: number;
  correcte: boolean;
};

export type ResultatQuiz = {
  evaluationId: string;
  note: number;
  noteMax: number;
  noteMin: number;
  score: number;
  total: number;
  reussi: boolean;
  tentatives: number;
  corrections: CorrectionQuiz[];
};

export type QuestionsQuizAdmin = {
  evaluationId: string;
  nom: string;
  questions: QuizQuestion[];
  tentatives: number;
};

export type CertificationType = {
  id: string;
  nom: string;
  organisme: string | null;
  type: string | null;
  formation: string | null;
  formationId: string | null;
  competence: string | null;
  competenceId: string | null;
  evaluationId: string | null;
  evaluationNom: string | null;
  seuil: number | null;
  dateObtention: string | null;
  etudiants: string[];
  etudiantIds: string[];
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
