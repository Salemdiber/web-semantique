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

/** Lecture authentifiée (quiz, résultats personnels). */
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

  /** GET /api/education/parcours */
  parcours: async (): Promise<Parcours[]> => demander('/education/parcours'),

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
