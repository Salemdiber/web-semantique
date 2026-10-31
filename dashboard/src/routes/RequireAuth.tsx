import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from 'src/context/auth-context';
import type { Role } from 'src/api/auth/auth-data';

interface Props {
  children: ReactNode;
  /** Rôles autorisés ; vide = tout utilisateur connecté. */
  roles?: Role[];
}

/**
 * Protège une route : redirige vers la connexion si la session est absente,
 * ou vers l'accueil si le rôle n'est pas autorisé.
 */
const RequireAuth = ({ children, roles }: Props) => {
  const { utilisateur, chargement } = useAuth();
  const location = useLocation();

  if (chargement) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Chargement de la session…
      </div>
    );
  }

  if (!utilisateur) {
    return (
      <Navigate
        to="/auth/auth2/login"
        replace
        state={{ depuis: location.pathname + location.search }}
      />
    );
  }

  if (roles && roles.length > 0 && !roles.includes(utilisateur.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
