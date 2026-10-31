import { Link, Navigate } from 'react-router';
import AuthLogin from '../authforms/AuthLogin';
import AuthShell from './AuthShell';
import { useAuth } from 'src/context/auth-context';

const Login = () => {
  const { utilisateur, chargement } = useAuth();

  // Déjà connecté : on renvoie vers le tableau de bord.
  if (!chargement && utilisateur) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthShell
      titre="Connexion"
      sousTitre="Accédez à votre espace Éducation & Formation"
    >
      <AuthLogin />
      <p className="mt-6 text-center text-sm text-slate-600">
        Pas encore de compte ?{' '}
        <Link
          to="/auth/auth2/register"
          className="font-semibold text-[#611f69] hover:underline"
        >
          Créer un compte
        </Link>
      </p>
    </AuthShell>
  );
};

export default Login;
