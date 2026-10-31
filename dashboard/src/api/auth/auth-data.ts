/**
 * Client du module utilisateur (FastAPI : /api/auth/...).
 * Le jeton Bearer est conservé dans le localStorage.
 *
 * Configurable via env Vite : VITE_API_URL (défaut `/api`, proxifié en dev).
 */

export type Role = 'admin' | 'formateur' | 'etudiant';

export interface Utilisateur {
  id: number;
  nom: string;
  email: string;
  role: Role;
  actif: boolean;
  cree_le: string;
}

interface ReponseAuth {
  access_token: string;
  token_type: string;
  utilisateur: Utilisateur;
}

const API_URL: string = import.meta.env.VITE_API_URL ?? '/api';
const CLE_JETON = 'si-education-jeton';

/**
 * Copie du jeton dans un cookie SameSite=Lax : les cookies ignorent le port,
 * ce qui permet à la landing (localhost:3010) de savoir que l'utilisateur est
 * connecté sur le dashboard (localhost:5173) sans dupliquer la connexion.
 */
const CLE_COOKIE = 'si-education-session';

export const LIBELLES_ROLE: Record<Role, string> = {
  admin: 'Administrateur',
  formateur: 'Formateur',
  etudiant: 'Étudiant',
};

export const jetonStocke = {
  lire: (): string | null => localStorage.getItem(CLE_JETON),
  ecrire: (jeton: string) => {
    localStorage.setItem(CLE_JETON, jeton);
    document.cookie = `${CLE_COOKIE}=${encodeURIComponent(
      jeton,
    )}; path=/; max-age=604800; SameSite=Lax`;
  },
  effacer: () => {
    localStorage.removeItem(CLE_JETON);
    document.cookie = `${CLE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  },
};

export class AuthErreur extends Error {
  statut: number;

  constructor(message: string, statut = 0) {
    super(message);
    this.name = 'AuthErreur';
    this.statut = statut;
  }
}

async function demander<T>(
  chemin: string,
  init: RequestInit = {},
  avecJeton = true,
): Promise<T> {
  const entetes = new Headers(init.headers);
  entetes.set('Content-Type', 'application/json');
  if (avecJeton) {
    const jeton = jetonStocke.lire();
    if (jeton) entetes.set('Authorization', `Bearer ${jeton}`);
  }

  let reponse: Response;
  try {
    reponse = await fetch(`${API_URL}${chemin}`, { ...init, headers: entetes });
  } catch {
    throw new AuthErreur(
      `API injoignable (${API_URL}). Démarrez FastAPI : uvicorn app.main:app --port 8000`,
    );
  }

  if (!reponse.ok) {
    let detail = `Erreur HTTP ${reponse.status}`;
    try {
      const corps = await reponse.json();
      if (typeof corps?.detail === 'string') detail = corps.detail;
      else if (Array.isArray(corps?.detail) && corps.detail[0]?.msg)
        detail = corps.detail[0].msg;
    } catch {
      /* corps non JSON */
    }
    throw new AuthErreur(detail, reponse.status);
  }

  if (reponse.status === 204) return undefined as T;
  return (await reponse.json()) as T;
}

export const authAPI = {
  /** POST /api/auth/inscription — étudiant ou formateur */
  inscription: async (donnees: {
    nom: string;
    email: string;
    mot_de_passe: string;
    role: Exclude<Role, 'admin'>;
  }): Promise<ReponseAuth> =>
    demander('/auth/inscription', {
      method: 'POST',
      body: JSON.stringify(donnees),
    }, false),

  /** POST /api/auth/connexion */
  connexion: async (email: string, motDePasse: string): Promise<ReponseAuth> =>
    demander('/auth/connexion', {
      method: 'POST',
      body: JSON.stringify({ email, mot_de_passe: motDePasse }),
    }, false),

  /** GET /api/auth/moi */
  moi: async (): Promise<Utilisateur> => demander('/auth/moi'),

  /** GET /api/auth/utilisateurs (admin) */
  utilisateurs: async (): Promise<Utilisateur[]> =>
    demander('/auth/utilisateurs'),

  /** PATCH /api/auth/utilisateurs/:id (admin) */
  modifierUtilisateur: async (
    id: number,
    donnees: { role?: Role; actif?: boolean },
  ): Promise<Utilisateur> =>
    demander(`/auth/utilisateurs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(donnees),
    }),

  /** DELETE /api/auth/utilisateurs/:id (admin) */
  supprimerUtilisateur: async (id: number): Promise<void> =>
    demander(`/auth/utilisateurs/${id}`, { method: 'DELETE' }),
};

export default authAPI;
