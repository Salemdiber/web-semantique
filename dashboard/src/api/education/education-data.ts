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
} from 'src/types/apps/education';

const API_URL: string =
  import.meta.env.VITE_API_URL ?? '/api';

class AccesAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccesAPIError';
  }
}

async function demander<T>(path: string, init?: RequestInit): Promise<T> {
  let reponse: Response;
  try {
    reponse = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      ...init,
    });
  } catch (e) {
    throw new AccesAPIError(
      `API sémantique injoignable (${API_URL}). Démarrer FastAPI : uvicorn app.main:app --reload --port 8001`
    );
  }
  if (!reponse.ok) {
    const detail = await reponse.text().catch(() => '');
    throw new AccesAPIError(`HTTP ${reponse.status} ${path} — ${detail}`);
  }
  return (await reponse.json()) as T;
}

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

  /** GET /api/education/evaluations */
  evaluations: async (): Promise<Evaluation[]> =>
    demander('/education/evaluations'),

  /** GET /api/education/certifications */
  certifications: async (): Promise<CertificationType[]> =>
    demander('/education/certifications'),

  /** GET /api/education/statistiques */
  statistiques: async (): Promise<Statistique[]> =>
    demander('/education/statistiques'),

  /** GET /api/education/types-inferes — vérifie l'inférence OWL de Fuseki */
  typesInferes: async (): Promise<TypeInferes[]> =>
    demander('/education/types-inferes'),

  /** GET /api/ontologie/prerequis-competences — graphe Pré→Cours→Compétences */
  relations: async (): Promise<RelationCoursCompetence[]> =>
    demander('/ontologie/prerequis-competences'),
};

export default educationAPI;
