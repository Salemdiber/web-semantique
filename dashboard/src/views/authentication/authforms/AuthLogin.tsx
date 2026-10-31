import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';
import { useAuth } from 'src/context/auth-context';

const CHAMP =
  'h-11 rounded-lg border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-[#611f69] focus-visible:ring-2 focus-visible:ring-[#611f69]/15';

const AuthLogin = () => {
  const { connexion } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const depuis =
    (location.state as { depuis?: string } | null)?.depuis ?? '/';

  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (evenement: FormEvent<HTMLFormElement>) => {
    evenement.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      await connexion(email, motDePasse);
      navigate(depuis, { replace: true });
    } catch (e) {
      setErreur(
        e instanceof Error ? e.message : 'Connexion impossible, réessayez.',
      );
    } finally {
      setEnCours(false);
    }
  };

  return (
    <form onSubmit={soumettre}>
      <div className="mb-4">
        <Label htmlFor="email" className="mb-2 block text-slate-700">
          Adresse e-mail
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.tn"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={CHAMP}
          required
        />
      </div>

      <div className="mb-5">
        <Label htmlFor="motdepasse" className="mb-2 block text-slate-700">
          Mot de passe
        </Label>
        <Input
          id="motdepasse"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          className={CHAMP}
          required
        />
      </div>

      {erreur && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          {erreur}
        </p>
      )}

      <Button
        type="submit"
        disabled={enCours}
        className="h-11 w-full rounded-lg bg-[#611f69] text-white hover:bg-[#4b1753]"
      >
        {enCours ? 'Connexion…' : 'Se connecter'}
      </Button>
    </form>
  );
};

export default AuthLogin;
