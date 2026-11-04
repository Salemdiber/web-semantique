/**
 * Session partagée entre la landing (3001) et le dashboard (5173).
 *
 * Le dashboard copie son jeton dans un cookie SameSite=Lax ; les cookies ne
 * dépendent pas du port, donc la landing peut vérifier la session auprès de
 * l'API et adapter ses boutons (« Se connecter » masqué si déjà connecté).
 */
import { useEffect, useState } from 'react';

const API_URL: string =
    import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

const CLE_COOKIE = 'si-education-session';

export type Role = 'admin' | 'formateur' | 'etudiant';

export interface UtilisateurSession {
    id: number;
    nom: string;
    email: string;
    role: Role;
}

export const lireJetonSession = (): string | null => {
    const brut = document.cookie
        .split('; ')
        .find((entree) => entree.startsWith(`${CLE_COOKIE}=`));
    if (!brut) return null;
    return decodeURIComponent(brut.slice(CLE_COOKIE.length + 1));
};

export const useSession = () => {
    const [utilisateur, setUtilisateur] = useState<UtilisateurSession | null>(
        null
    );
    const [jeton, setJeton] = useState<string | null>(null);
    const [chargement, setChargement] = useState(true);

    useEffect(() => {
        const jetonLu = lireJetonSession();
        if (!jetonLu) {
            setChargement(false);
            return;
        }

        let actif = true;
        fetch(`${API_URL}/auth/moi`, {
            headers: { Authorization: `Bearer ${jetonLu}` },
        })
            .then((reponse) =>
                reponse.ok ? reponse.json() : null
            )
            .then((profil: UtilisateurSession | null) => {
                if (actif) {
                    setUtilisateur(profil);
                    setJeton(profil ? jetonLu : null);
                }
            })
            .catch(() => {
                /* API indisponible : on garde l'état visiteur */
            })
            .finally(() => {
                if (actif) setChargement(false);
            });

        return () => {
            actif = false;
        };
    }, []);

    const prenom = utilisateur?.nom?.trim().split(/\s+/)[0] ?? '';

    return { utilisateur, jeton, chargement, prenom };
};
