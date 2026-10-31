import { Link, Navigate } from 'react-router';
import AuthRegister from '../authforms/AuthRegister';
import AuthShell from './AuthShell';
import { useAuth } from 'src/context/auth-context';

const Register = () => {
  const { utilisateur, chargement } = useAuth();

  if (!chargement && utilisateur) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthShell
      titre="Créer un compte"
      sousTitre="Rejoignez la plateforme comme étudiant ou formateur"
    >
      <AuthRegister />
      <p className="mt-6 text-center text-sm text-slate-600">
        Déjà un compte ?{' '}
        <Link
          to="/auth/auth2/login"
          className="font-semibold text-[#611f69] hover:underline"
        >
          Se connecter
        </Link>
      </p>
    </AuthShell>
  );
};

export default Register;
