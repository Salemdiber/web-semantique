import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import authAPI, {
  jetonStocke,
  type Role,
  type Utilisateur,
} from 'src/api/auth/auth-data';

interface AuthContexteType {
  utilisateur: Utilisateur | null;
  chargement: boolean;
  connexion: (email: string, motDePasse: string) => Promise<Utilisateur>;
  inscription: (donnees: {
    nom: string;
    email: string;
    mot_de_passe: string;
    role: Exclude<Role, 'admin'>;
  }) => Promise<Utilisateur>;
  deconnexion: () => void;
  estAdmin: boolean;
}

const AuthContexte = createContext<AuthContexteType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);

  // Restaure la session à partir du jeton conservé dans le navigateur.
  useEffect(() => {
    let actif = true;
    const jeton = jetonStocke.lire();
    if (!jeton) {
      setChargement(false);
      return;
    }
    authAPI
      .moi()
      .then((profil) => {
        if (actif) {
          setUtilisateur(profil);
          // Réécrit le cookie de session (sessions ouvertes avant cette
          // fonctionnalité) pour que la landing voie l'utilisateur connecté.
          jetonStocke.ecrire(jeton);
        }
      })
      .catch(() => {
        jetonStocke.effacer();
      })
      .finally(() => {
        if (actif) setChargement(false);
      });
    return () => {
      actif = false;
    };
  }, []);

  const connexion = useCallback(async (email: string, motDePasse: string) => {
    const reponse = await authAPI.connexion(email, motDePasse);
    jetonStocke.ecrire(reponse.access_token);
    setUtilisateur(reponse.utilisateur);
    return reponse.utilisateur;
  }, []);

  const inscription = useCallback<AuthContexteType['inscription']>(
    async (donnees) => {
      const reponse = await authAPI.inscription(donnees);
      jetonStocke.ecrire(reponse.access_token);
      setUtilisateur(reponse.utilisateur);
      return reponse.utilisateur;
    },
    [],
  );

  const deconnexion = useCallback(() => {
    jetonStocke.effacer();
    setUtilisateur(null);
  }, []);

  const valeur = useMemo<AuthContexteType>(
    () => ({
      utilisateur,
      chargement,
      connexion,
      inscription,
      deconnexion,
      estAdmin: utilisateur?.role === 'admin',
    }),
    [utilisateur, chargement, connexion, inscription, deconnexion],
  );

  return <AuthContexte.Provider value={valeur}>{children}</AuthContexte.Provider>;
};

export const useAuth = (): AuthContexteType => {
  const contexte = useContext(AuthContexte);
  if (!contexte) {
    throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  }
  return contexte;
};

export default AuthProvider;
