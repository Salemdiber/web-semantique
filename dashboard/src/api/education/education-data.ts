/**
 * Client d'accès à l'API sémantique (FastAPI <-> Jena Fuseki <-> OWL).
 * Utilise fetch natif : aucune dépendance supplémentaire nécessaire.
 *
 * Configurable via env Vite : VITE_API_URL (défaut http://localhost:8000/api)
 */
import type {
  Etudiant,
  Formation,
  Cours,
  Competence,
  Evaluation,
  Formateur,
  CertificationType,
  Statistique,
  Programme,
  Parcours,
  ParcoursAnalyse,
  ParcoursRecommandation,
  ParcoursStatistiques,
  NiveauParcours,
  StatutParcours,
  RelationCoursCompetence,
  TypeInferes,
  QuizDetail,
  ResultatQuiz,
  QuestionsQuizAdmin,
} from 'src/types/apps/education';
import { jetonStocke } from 'src/api/auth/auth-data';

const API_URL: string =
  import.meta.env.VITE_API_URL ?? '/api';

class AccesAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccesAPIError';
  }
}

async function demander<T>(path: string, init?: RequestInit): Promise<T> {
  const entetes = new Headers({ 'Content-Type': 'application/json' });
  new Headers(init?.headers).forEach((valeur, cle) =>
    entetes.set(cle, valeur),
  );

  let reponse: Response;
  try {
    reponse = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: entetes,
      mode: 'cors',
    });
  } catch (e) {
    throw new AccesAPIError(
      `API sémantique injoignable (${API_URL}). Démarrer FastAPI : uvicorn app.main:app --reload --port 8000`
    );
  }
  if (!reponse.ok) {
    let detail = `HTTP ${reponse.status} ${path}`;
    try {
      const corps = await reponse.json();
      if (typeof corps?.detail === 'string') detail = corps.detail;
      else if (Array.isArray(corps?.detail) && corps.detail[0]?.msg)
        detail = corps.detail[0].msg;
    } catch {
      /* corps non JSON */
    }
    throw new AccesAPIError(detail);
  }
  if (reponse.status === 204) return undefined as T;
  return (await reponse.json()) as T;
}

/** Écriture dans l'ontologie : jeton Bearer obligatoire. */
async function envoyer<T>(
  path: string,
  methode: 'POST' | 'PUT' | 'DELETE',
  corps?: unknown,
): Promise<T> {
  const jeton = jetonStocke.lire();
  if (!jeton) {
    throw new AccesAPIError('Connectez-vous pour modifier l\'ontologie.');
  }
  return demander<T>(path, {
    method: methode,
    headers: { Authorization: `Bearer ${jeton}` },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
}

/** Lecture authentifiée (quiz, résultats personnels, parcours selon rôle). */
async function demanderAvecJeton<T>(path: string): Promise<T> {
  const jeton = jetonStocke.lire();
  return demander<T>(path, {
    headers: jeton ? { Authorization: `Bearer ${jeton}` } : undefined,
  });
}

export type EvaluationEntree = {
  nom: string;
  type: string;
  cours: string;
  etudiant?: string | null;
  competence?: string | null;
  date?: string | null;
  note_max?: number;
  note_min?: number;
  note?: number | null;
};

export type CertificationEntree = {
  nom: string;
  organisme?: string | null;
  type: string;
  formation?: string | null;
  competence?: string | null;
  evaluation?: string | null;
  seuil?: number;
  date_obtention?: string | null;
  etudiants?: string[];
};

export type ParcoursEntree = {
  nom: string;
  description?: string | null;
  objectif?: string | null;
  niveau: NiveauParcours;
  statut: StatutParcours;
  cours_ids?: string[];
};

export type ParcoursFiltres = {
  niveau?: string;
  q?: string;
  competence?: string;
  statut?: string;
  tri?: 'nom' | 'duree' | 'cours' | 'inscrits';
  ordre?: 'asc' | 'desc';
};

export const educationAPI = {
  /** GET /api/education/sante — disponibilité Fuseki */
  sante: async (): Promise<{ statut: string; dataset: number }> =>
    demander('/education/sante'),

  /** GET /api/education/cours */
  cours: async (): Promise<Cours[]> => demander('/education/cours'),

  /** GET /api/education/cours/:nom */
  coursDetail: async (id: string): Promise<Cours> =>
    demander(`/education/cours/${encodeURIComponent(id)}`),

  /** GET /api/education/etudiants */
  etudiants: async (): Promise<Etudiant[]> => demander('/education/etudiants'),

  /** GET /api/education/formateurs */
  formateurs: async (): Promise<Formateur[]> =>
    demander('/education/formateurs'),

  /** GET /api/education/formations */
  formations: async (): Promise<Formation[]> =>
    demander('/education/formations'),

  /** GET /api/education/competences */
  competences: async (): Promise<Competence[]> =>
    demander('/education/competences'),

  /** GET /api/education/programmes */
  programmes: async (): Promise<Programme[]> =>
    demander('/education/programmes'),

  /* ------------------------------------ parcours d'apprentissage --- */

  /** GET /api/education/parcours — liste enrichie avec filtres */
  parcours: async (filtres?: ParcoursFiltres): Promise<Parcours[]> => {
    const params = new URLSearchParams();
    if (filtres?.niveau) params.set('niveau', filtres.niveau);
    if (filtres?.q) params.set('q', filtres.q);
    if (filtres?.competence) params.set('competence', filtres.competence);
    if (filtres?.statut) params.set('statut', filtres.statut);
    if (filtres?.tri) params.set('tri', filtres.tri);
    if (filtres?.ordre) params.set('ordre', filtres.ordre);
    const qs = params.toString();
    return demanderAvecJeton(`/education/parcours${qs ? `?${qs}` : ''}`);
  },

  /** GET /api/education/parcours/:id — détail complet et progression */
  parcoursDetail: async (id: string): Promise<Parcours> =>
    demanderAvecJeton(`/education/parcours/${encodeURIComponent(id)}`),

  /** POST /api/education/parcours — création (admin) */
  creerParcours: async (donnees: ParcoursEntree): Promise<Parcours> =>
    envoyer('/education/parcours', 'POST', donnees),

  /** PUT /api/education/parcours/:id — mise à jour (admin) */
  modifierParcours: async (
    id: string,
    donnees: ParcoursEntree,
  ): Promise<Parcours> =>
    envoyer(`/education/parcours/${encodeURIComponent(id)}`, 'PUT', donnees),

  /** PUT /api/education/parcours/:id/cours — réordonner/remplacer les cours (admin) */
  reordonnerCoursParcours: async (
    id: string,
    coursIds: string[],
  ): Promise<Parcours> =>
    envoyer(`/education/parcours/${encodeURIComponent(id)}/cours`, 'PUT', {
      cours_ids: coursIds,
    }),

  /** POST /api/education/parcours/:id/cours — ajouter un cours (admin) */
  ajouterCoursParcours: async (
    id: string,
    coursId: string,
    position?: number,
  ): Promise<Parcours> =>
    envoyer(`/education/parcours/${encodeURIComponent(id)}/cours`, 'POST', {
      cours_id: coursId,
      position,
    }),

  /** DELETE /api/education/parcours/:id/cours/:coursId — retirer un cours (admin) */
  retirerCoursParcours: async (
    id: string,
    coursId: string,
  ): Promise<Parcours> =>
    envoyer(
      `/education/parcours/${encodeURIComponent(id)}/cours/${encodeURIComponent(coursId)}`,
      'DELETE',
    ),

  /** POST /api/education/parcours/:id/dupliquer — dupliquer en brouillon (admin) */
  dupliquerParcours: async (id: string): Promise<Parcours> =>
    envoyer(
      `/education/parcours/${encodeURIComponent(id)}/dupliquer`,
      'POST',
    ),

  /** DELETE /api/education/parcours/:id — suppression complète (admin) */
  supprimerParcours: async (
    id: string,
  ): Promise<{ statut: string; id: string; inscriptionsSupprimees: number }> =>
    envoyer(`/education/parcours/${encodeURIComponent(id)}`, 'DELETE'),

  /** GET /api/education/parcours/:id/analyse — analyse de cohérence & tri topologique */
  analyserParcours: async (id: string): Promise<ParcoursAnalyse> =>
    demanderAvecJeton(
      `/education/parcours/${encodeURIComponent(id)}/analyse`,
    ),

  /** GET /api/education/parcours/statistiques — indicateurs ApexCharts (admin/formateur) */
  statistiquesParcours: async (): Promise<ParcoursStatistiques> =>
    demanderAvecJeton('/education/parcours/statistiques'),

  /** GET /api/education/parcours/mes-parcours — parcours suivis (étudiant) */
  mesParcours: async (): Promise<Parcours[]> =>
    demanderAvecJeton('/education/parcours/mes-parcours'),

  /** GET /api/education/parcours/recommandations — parcours recommandés (étudiant) */
  recommandationsParcours: async (): Promise<ParcoursRecommandation[]> =>
    demanderAvecJeton('/education/parcours/recommandations'),

  /** POST /api/education/parcours/:id/inscription — s'inscrire (étudiant) */
  inscrireParcours: async (id: string): Promise<Parcours> =>
    envoyer(
      `/education/parcours/${encodeURIComponent(id)}/inscription`,
      'POST',
    ),

  /** DELETE /api/education/parcours/:id/inscription — se désinscrire (étudiant) */
  desinscrireParcours: async (
    id: string,
  ): Promise<{ statut: string; parcoursId: string; coursRetiresSuitCours: string[] }> =>
    envoyer(
      `/education/parcours/${encodeURIComponent(id)}/inscription`,
      'DELETE',
    ),

  /** GET /api/education/evaluations — liste complète (admin/formateur) */
  evaluations: async (): Promise<Evaluation[]> => {
    const jeton = jetonStocke.lire();
    return demander('/education/evaluations', {
      headers: jeton ? { Authorization: `Bearer ${jeton}` } : undefined,
    });
  },

  /** GET /api/education/mes-evaluations — évaluations et quiz de l'étudiant connecté */
  mesEvaluations: async (): Promise<Evaluation[]> => {
    const jeton = jetonStocke.lire();
    return demander('/education/mes-evaluations', {
      headers: jeton ? { Authorization: `Bearer ${jeton}` } : undefined,
    });
  },

  /** GET /api/education/certifications */
  certifications: async (): Promise<CertificationType[]> =>
    demander('/education/certifications'),

  /** GET /api/education/statistiques */
  statistiques: async (): Promise<Statistique[]> =>
    demander('/education/statistiques'),

  /** GET /api/education/types-inferes — vérifie l'inférence OWL de Fuseki */
  typesInferes: async (): Promise<TypeInferes[]> =>
    demander('/education/types-inferes'),

  /* --------------------------------------------------------------- quiz --- */

  /** GET /api/education/quiz/:id — questionnaire de l'étudiant (sans réponses) */
  quizDetail: async (id: string): Promise<QuizDetail> =>
    demanderAvecJeton(`/education/quiz/${encodeURIComponent(id)}`),

  /** POST /api/education/quiz/:id/soumettre — correction automatique */
  soumettreQuiz: async (
    id: string,
    reponses: { question_id: number; choix: number }[],
  ): Promise<ResultatQuiz> =>
    envoyer(`/education/quiz/${encodeURIComponent(id)}/soumettre`, 'POST', {
      reponses,
    }),

  /** GET /api/education/quiz/:id/questions — vue encadrant (avec réponses) */
  questionsQuiz: async (id: string): Promise<QuestionsQuizAdmin> =>
    demanderAvecJeton(
      `/education/quiz/${encodeURIComponent(id)}/questions`,
    ),

  /** PUT /api/education/quiz/:id/questions — remplace le questionnaire */
  enregistrerQuestionsQuiz: async (
    id: string,
    questions: {
      enonce: string;
      choix: string[];
      bonne_reponse: number;
      points: number;
    }[],
  ): Promise<{ evaluationId: string; questions: QuestionsQuizAdmin['questions'] }> =>
    envoyer(`/education/quiz/${encodeURIComponent(id)}/questions`, 'PUT', {
      questions,
    }),

  /** DELETE /api/education/quiz/:id/tentatives — remise à zéro */
  reinitialiserQuiz: async (
    id: string,
  ): Promise<{ statut: string; tentatives_supprimees: number }> =>
    envoyer(
      `/education/quiz/${encodeURIComponent(id)}/tentatives`,
      'DELETE',
    ),

  /** GET /api/ontologie/prerequis-competences — graphe Pré→Cours→Compétences */
  relations: async (): Promise<RelationCoursCompetence[]> =>
    demander('/ontologie/prerequis-competences'),

  /* ------------------------------------ CRUD évaluations & certifications --- */

  /** POST /api/education/evaluations */
  creerEvaluation: async (donnees: EvaluationEntree): Promise<Evaluation> =>
    envoyer('/education/evaluations', 'POST', donnees),

  /** PUT /api/education/evaluations/:id */
  modifierEvaluation: async (
    id: string,
    donnees: EvaluationEntree,
  ): Promise<Evaluation> =>
    envoyer(
      `/education/evaluations/${encodeURIComponent(id)}`,
      'PUT',
      donnees,
    ),

  /** DELETE /api/education/evaluations/:id */
  supprimerEvaluation: async (id: string): Promise<void> => {
    await envoyer(`/education/evaluations/${encodeURIComponent(id)}`, 'DELETE');
  },

  /** POST /api/education/certifications */
  creerCertification: async (
    donnees: CertificationEntree,
  ): Promise<CertificationType> =>
    envoyer('/education/certifications', 'POST', donnees),

  /** PUT /api/education/certifications/:id */
  modifierCertification: async (
    id: string,
    donnees: CertificationEntree,
  ): Promise<CertificationType> =>
    envoyer(
      `/education/certifications/${encodeURIComponent(id)}`,
      'PUT',
      donnees,
    ),

  /** DELETE /api/education/certifications/:id */
  supprimerCertification: async (id: string): Promise<void> => {
    await envoyer(
      `/education/certifications/${encodeURIComponent(id)}`,
      'DELETE',
    );
  },
};

export default educationAPI;
