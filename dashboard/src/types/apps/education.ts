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

/** Réponse de GET/POST/PUT /api/courses (module Gestion des cours). */
export type CoursGestion = Cours & {
  niveau: string | null;
  categorie: string | null;
  formateur: string | null;
  formateurIds: string[];
};

/** Corps attendu par POST/PUT /api/courses. */
export type CoursEntree = {
  nom: string;
  duree: string;
  description?: string | null;
  niveau?: string | null;
  categorie?: string | null;
  formateur?: string | null;
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

export type NiveauParcours = 'Debutant' | 'Avance';
export type StatutParcours = 'brouillon' | 'publie';
export type StatutCoursEtudiant = 'non_commence' | 'en_cours' | 'termine';

export type ParcoursPrerequisDetail = {
  id: string;
  description: string;
  niveauRequis: string | null;
  competenceId: string | null;
  competenceNom: string | null;
  competenceNiveau: string | null;
};

export type ParcoursCompetenceDetail = {
  id: string;
  nom: string;
  niveau: string | null;
};

export type ParcoursEtape = {
  position: number;
  id: string;
  nom: string;
  duree: string;
  dureeHeures: number;
  description: string | null;
  type: string;
  prerequis: string[];
  prerequisDetails: ParcoursPrerequisDetail[];
  competences: string[];
  competencesDetails: ParcoursCompetenceDetail[];
  formateurs: string[];
  introuvable?: boolean;
  statutEtudiant?: StatutCoursEtudiant;
  noteObtenue?: number | null;
  noteMax?: number | null;
  evaluationsCount?: number;
};

export type ProchainCoursParcours = {
  id: string;
  nom: string;
  position: number;
  duree: string;
  statutEtudiant: StatutCoursEtudiant;
};

export type ParcoursCertificationLiee = {
  id: string;
  nom: string | null;
  organisme: string | null;
  type: string;
  competence: string | null;
  seuil: number | null;
};

export type ParcoursInscrit = {
  id: number;
  utilisateurId: number;
  nom: string;
  email: string;
  parcoursId: string;
  statut: string;
  creeLe: string;
  majLe: string;
  progression: number;
  coursTermines: number;
  nombreCours: number;
};

export type Parcours = {
  id: string;
  nom: string;
  description: string | null;
  objectif: string | null;
  statut: StatutParcours;
  niveau: NiveauParcours;
  niveauClasse: 'ParcoursDebutant' | 'ParcoursAvance';
  /** Libellé OWL historique conservé pour rétrocompatibilité. */
  type: string | null;
  /** Liste des noms de cours conservée pour rétrocompatibilité. */
  cours: string[];
  coursIds: string[];
  etapes: ParcoursEtape[];
  nombreCours: number;
  dureeHeures: number;
  dureeTotale: string;
  competences: string[];
  competencesDetails: ParcoursCompetenceDetail[];
  prerequis: string[];
  prerequisEntree: string[];
  formateurs: string[];
  nombreInscrits: number;
  estInscrit?: boolean;
  dateInscription?: string | null;
  statutInscription?: string;
  progression?: number | null;
  coursTermines?: number;
  coursEnCours?: number;
  estTermine?: boolean;
  prochainCours?: ProchainCoursParcours | null;
  certificationsLiees?: ParcoursCertificationLiee[];
  inscrits?: ParcoursInscrit[];
};

export type ParcoursAlerte = {
  type: 'parcours_vide' | 'cours_orphelin' | 'ordre_invalide' | 'lacune_competence' | 'coherence_niveau';
  severite: 'erreur' | 'avertissement' | 'info';
  message: string;
  coursId: string | null;
};

export type ParcoursSuggestionCours = {
  coursId: string;
  coursNom: string;
  duree: string;
  raison: string;
};

export type ParcoursPrerequisEntreeAnalyse = {
  id: string;
  description: string;
  competence: string | null;
  pourCours: string;
};

export type ParcoursAnalyse = {
  parcoursId: string;
  nom: string;
  niveau: NiveauParcours;
  valide: boolean;
  scoreCoherence: number;
  ordreActuel: string[];
  ordreActuelNoms?: string[];
  ordreSuggere: string[];
  ordreSuggereNoms: string[];
  ameliorationOrdre: boolean;
  prerequisEntree: ParcoursPrerequisEntreeAnalyse[];
  competencesCouvertes: string[];
  alertes: ParcoursAlerte[];
  suggestionsCours: ParcoursSuggestionCours[];
};

export type ParcoursRecommandation = Parcours & {
  scorePertinence: number;
  raisons: string[];
  competencesNouvelles: string[];
  prerequisCouverts: boolean;
};

export type ParcoursStatistiques = {
  totalParcours: number;
  parNiveau: {
    Debutant: number;
    Avance: number;
  };
  parStatut: {
    publie: number;
    brouillon: number;
  };
  moyenneCoursParParcours: number;
  moyenneHeuresParParcours: number;
  totalInscriptions: number;
  progressionMoyenne: number;
  tauxCompletionGlobal: number;
  topParcours: {
    id: string;
    nom: string;
    niveau: NiveauParcours;
    statut: StatutParcours;
    nombreInscrits: number;
    nombreCours: number;
    dureeHeures: number;
    progressionMoyenne: number;
  }[];
  coursPartages: {
    coursId: string;
    coursNom: string;
    nombreParcours: number;
    parcours: string[];
  }[];
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
