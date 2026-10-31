import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';
import { useAuth } from 'src/context/auth-context';
import type { Role } from 'src/api/auth/auth-data';

type RoleInscription = Exclude<Role, 'admin'>;

const CHAMP =
  'h-11 rounded-lg border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-[#611f69] focus-visible:ring-2 focus-visible:ring-[#611f69]/15';

const AuthRegister = () => {
  const { inscription } = useAuth();
  const navigate = useNavigate();

  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [role, setRole] = useState<RoleInscription>('etudiant');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (evenement: FormEvent<HTMLFormElement>) => {
    evenement.preventDefault();
    setErreur('');
    if (motDePasse.length < 8) {
      setErreur('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setEnCours(true);
    try {
      await inscription({ nom, email, mot_de_passe: motDePasse, role });
      navigate('/', { replace: true });
    } catch (e) {
      setErreur(
        e instanceof Error ? e.message : 'Inscription impossible, réessayez.',
      );
    } finally {
      setEnCours(false);
    }
  };

  return (
    <form onSubmit={soumettre}>
      <div className="mb-4">
        <Label htmlFor="nom" className="mb-2 text-slate-700">
          Nom complet
        </Label>
        <Input
          id="nom"
          type="text"
          autoComplete="name"
          placeholder="Votre nom et prénom"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className={CHAMP}
          required
          minLength={2}
        />
      </div>

      <div className="mb-4">
        <Label htmlFor="emadd" className="mb-2 text-slate-700">
          Adresse e-mail
        </Label>
        <Input
          id="emadd"
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.tn"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={CHAMP}
          required
        />
      </div>

      <div className="mb-4">
        <Label htmlFor="userpwd" className="mb-2 text-slate-700">
          Mot de passe
        </Label>
        <Input
          id="userpwd"
          type="password"
          autoComplete="new-password"
          placeholder="8 caractères minimum"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          className={CHAMP}
          required
          minLength={8}
        />
        <p className="mt-1 text-xs text-slate-500">8 caractères minimum.</p>
      </div>

      <div className="mb-5">
        <Label htmlFor="role" className="mb-2 text-slate-700">
          Je m'inscris comme
        </Label>
        <Select
          value={role}
          onValueChange={(valeur) => setRole(valeur as RoleInscription)}
        >
          <SelectTrigger
            id="role"
            className="h-11 w-full rounded-lg border-slate-300 bg-white text-slate-900 focus-visible:border-[#611f69] focus-visible:ring-2 focus-visible:ring-[#611f69]/15"
          >
            <SelectValue placeholder="Choisir un rôle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="etudiant">Étudiant</SelectItem>
            <SelectItem value="formateur">Formateur</SelectItem>
          </SelectContent>
        </Select>
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
        {enCours ? 'Création…' : "S'inscrire"}
      </Button>
    </form>
  );
};

export default AuthRegister;
