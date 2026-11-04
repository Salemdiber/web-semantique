import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@iconify/react';
import CardBox from 'src/components/shared/CardBox';
import educationAPI, {
  type FormateurEntree,
} from 'src/api/education/education-data';
import type { Cours, Formateur } from 'src/types/apps/education';
import { useAuth } from 'src/context/auth-context';

const GestionFormateurs = () => {
  const { utilisateur } = useAuth();
  const peutEditer = utilisateur?.role === 'admin';
  const [formateurs, setFormateurs] = useState<Formateur[]>([]);
  const [cours, setCours] = useState<Cours[]>([]);
  const [selection, setSelection] = useState<Formateur | null>(null);
  const [edition, setEdition] = useState<Formateur | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [formulaire, setFormulaire] = useState<FormateurEntree>({
    prenom: '',
    domaine: '',
    cours: [],
  });
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [recherche, setRecherche] = useState('');
  const [filtreDomaine, setFiltreDomaine] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const [liste, listeCours] = await Promise.all([
        educationAPI.formateurs(),
        educationAPI.cours(),
      ]);
      setFormateurs(liste);
      setCours(listeCours);
      setErreur('');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const ouvrirCreation = () => {
    setSelection(null);
    setEdition(null);
    setFormulaire({ prenom: '', domaine: '', cours: [] });
    setMessage('');
    setOuvert(true);
  };

  const ouvrirEdition = (formateur: Formateur) => {
    setSelection(formateur);
    setEdition(formateur);
    setFormulaire({
      prenom: formateur.prenom,
      domaine: formateur.domaine === 'Domaine non précisé' ? '' : formateur.domaine,
      cours: formateur.cours
        .map((nom) => cours.find((item) => item.nom === nom)?.id)
        .filter((id): id is string => Boolean(id)),
    });
    setMessage('');
    setOuvert(true);
  };

  const basculerCours = (id: string) => {
    setFormulaire((precedent) => ({
      ...precedent,
      cours: precedent.cours?.includes(id)
        ? precedent.cours.filter((coursId) => coursId !== id)
        : [...(precedent.cours ?? []), id],
    }));
  };

  const soumettre = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const donnees = {
        ...formulaire,
        domaine: formulaire.domaine?.trim() || null,
      };
      const resultat = edition
        ? await educationAPI.modifierFormateur(edition.id, donnees)
        : await educationAPI.creerFormateur(donnees);
      setFormateurs((precedents) =>
        edition
          ? precedents.map((item) => (item.id === resultat.id ? resultat : item))
          : [...precedents, resultat],
      );
      setSelection(resultat);
      setEdition(null);
      setOuvert(false);
      setMessage(edition ? 'Formateur modifié.' : 'Formateur créé.');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setEnCours(false);
    }
  };

  const supprimer = async (formateur: Formateur) => {
    if (!window.confirm(`Supprimer « ${formateur.prenom} » ?`)) return;
    setEnCours(true);
    try {
      await educationAPI.supprimerFormateur(formateur.id);
      setFormateurs((precedents) =>
        precedents.filter((item) => item.id !== formateur.id),
      );
      if (selection?.id === formateur.id) setSelection(null);
      setMessage('Formateur supprimé.');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Suppression impossible.');
    } finally {
      setEnCours(false);
    }
  };

  const domaines = Array.from(
    new Set(
      formateurs
        .map((formateur) => formateur.domaine)
        .filter((domaine) => domaine !== 'Domaine non précisé'),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const terme = recherche.trim().toLocaleLowerCase();
  const formateursFiltres = formateurs
    .filter((formateur) => {
      const correspondRecherche =
        !terme ||
        [formateur.prenom, formateur.domaine, ...formateur.cours].some((valeur) =>
          valeur.toLocaleLowerCase().includes(terme),
        );
      return (
        correspondRecherche &&
        (!filtreDomaine || formateur.domaine === filtreDomaine)
      );
    })
    .sort((a, b) => a.prenom.localeCompare(b.prenom));

  return (
    <div className="grid grid-cols-12 gap-6">
      <CardBox className="col-span-12 p-0 overflow-hidden xl:col-span-7">
        <div className="flex items-center justify-between border-b border-ld px-4 py-4">
          <div>
            <h4 className="text-xl font-semibold">Formateurs</h4>
            <p className="text-sm text-ld">{formateurs.length} formateur(s)</p>
          </div>
          {peutEditer && (
            <button type="button" onClick={ouvrirCreation} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">
              Ajouter
            </button>
          )}
        </div>
        {(erreur || message) && (
          <div className={`m-4 rounded-md px-4 py-3 text-sm ${erreur ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
            {erreur || message}
          </div>
        )}
        <div className="grid gap-3 border-b border-ld p-4 md:grid-cols-2">
          <input
            type="search"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            placeholder="Rechercher un formateur..."
            aria-label="Rechercher un formateur"
            className="w-full rounded-md border border-ld px-3 py-2 text-sm"
          />
          <select
            value={filtreDomaine}
            onChange={(event) => setFiltreDomaine(event.target.value)}
            aria-label="Filtrer par domaine"
            className="w-full rounded-md border border-ld px-3 py-2 text-sm"
          >
            <option value="">Tous les domaines</option>
            {domaines.map((domaine) => (
              <option key={domaine} value={domaine}>
                {domaine}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-left">
            <thead className="bg-lightprimary"><tr className="text-xs uppercase tracking-wide text-primary"><th className="px-4 py-3">Formateur</th><th className="px-4 py-3">Domaine</th><th className="px-4 py-3">Cours</th>{peutEditer && <th className="px-4 py-3">Actions</th>}</tr></thead>
            <tbody>
              {chargement ? <tr><td colSpan={peutEditer ? 4 : 3} className="px-4 py-8 text-center">Chargement…</td></tr> :
                formateursFiltres.length === 0 ? <tr><td colSpan={peutEditer ? 4 : 3} className="px-4 py-8 text-center">Aucun formateur ne correspond aux critères.</td></tr> :
                formateursFiltres.map((formateur) => <tr key={formateur.id} onClick={() => setSelection(formateur)} className={`cursor-pointer border-b border-ld last:border-0 hover:bg-lightprimary ${selection?.id === formateur.id ? 'bg-lightprimary' : ''}`}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-lightprimary text-primary"><Icon icon="solar:user-id-linear" height={18} width={18} /></span><span className="font-semibold">{formateur.prenom}</span></div></td>
                  <td className="px-4 py-3 text-sm"><span className="rounded-full bg-lightsecondary px-2.5 py-1 text-xs font-medium text-secondary">{formateur.domaine}</span></td>
                  <td className="px-4 py-3"><span className="rounded-full bg-lightsuccess px-2.5 py-1 text-xs font-semibold text-success">{formateur.cours.length} cours</span></td>
                  {peutEditer && <td className="px-4 py-3"><button type="button" className="mr-3 text-primary" onClick={(event) => { event.stopPropagation(); ouvrirEdition(formateur); }}>Modifier</button><button type="button" className="text-error" disabled={enCours} onClick={(event) => { event.stopPropagation(); supprimer(formateur); }}>Supprimer</button></td>}
                </tr>)}
            </tbody>
          </table>
        </div>
      </CardBox>
      {(ouvert || selection || !peutEditer) && <CardBox className="col-span-12 p-6 xl:col-span-5">
        {ouvert && peutEditer ? <form onSubmit={soumettre} className="space-y-5">
          <div className="rounded-xl bg-gradient-to-r from-primary to-secondary p-5 text-white">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/75">Gestion des formateurs</p>
            <h4 className="text-2xl font-semibold">{edition ? 'Modifier le formateur' : 'Ajouter un formateur'}</h4>
            <p className="mt-1 text-sm text-white/80">Présentez le profil et les cours pris en charge.</p>
          </div>
          <div className="rounded-lg border border-ld p-4">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informations du profil</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium">Nom du formateur <span className="text-error">*</span></span><input required minLength={2} value={formulaire.prenom} onChange={(e) => setFormulaire({ ...formulaire, prenom: e.target.value })} placeholder="Ex. Amel Ben Ali" className="w-full rounded-md border border-ld bg-transparent px-3 py-2.5 text-sm outline-none focus:border-primary" /></label>
              <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium">Domaine d'expertise</span><input value={formulaire.domaine ?? ''} onChange={(e) => setFormulaire({ ...formulaire, domaine: e.target.value })} placeholder="Ex. Intelligence artificielle" className="w-full rounded-md border border-ld bg-transparent px-3 py-2.5 text-sm outline-none focus:border-primary" /></label>
            </div>
          </div>
          <div className="rounded-lg border border-ld p-4">
            <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cours enseignés</p><p className="mt-1 text-sm text-muted-foreground">Associez les cours suivis par ce formateur.</p></div><span className="rounded-full bg-lightprimary px-3 py-1 text-xs font-semibold text-primary">{formulaire.cours?.length ?? 0} sélectionné(s)</span></div>
            <div className="grid gap-2 sm:grid-cols-2">{cours.map((item) => { const selectionne = formulaire.cours?.includes(item.id) ?? false; return <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${selectionne ? 'border-primary bg-lightprimary text-primary' : 'border-ld hover:border-primary/50'}`}><input type="checkbox" checked={selectionne} onChange={() => basculerCours(item.id)} className="h-4 w-4 accent-primary" /><span className="font-medium">{item.nom}</span></label>; })}</div>
            {cours.length === 0 && <p className="text-sm text-muted-foreground">Aucun cours disponible.</p>}
          </div>
          <div className="flex flex-wrap gap-3 border-t border-ld pt-4"><button type="submit" disabled={enCours} className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{enCours ? 'Enregistrement…' : edition ? 'Enregistrer les modifications' : 'Créer le formateur'}</button><button type="button" onClick={() => { setOuvert(false); setEdition(null); }} className="rounded-md border border-ld px-5 py-2.5 text-sm font-medium transition hover:bg-lightprimary">Annuler</button></div>
        </form> : selection ? <div className="space-y-5">
          <div className="rounded-xl bg-gradient-to-r from-primary to-secondary p-5 text-white"><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/75">Profil du formateur</p><div className="flex items-center justify-between gap-3"><h4 className="text-2xl font-semibold">{selection.prenom}</h4><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">{selection.cours.length} cours</span></div></div>
          <div className="rounded-lg border border-ld p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Domaine d'expertise</p><p className="text-base font-semibold">{selection.domaine}</p></div>
          <div className="rounded-lg border border-ld p-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cours enseignés</p>{selection.cours.length > 0 ? <div className="flex flex-wrap gap-2">{selection.cours.map((nom) => <span key={nom} className="rounded-full bg-lightprimary px-3 py-1.5 text-xs font-medium text-primary">{nom}</span>)}</div> : <p className="text-sm text-muted-foreground">Aucun cours enseigné.</p>}</div>
        </div> : <div className="rounded-lg border border-dashed border-ld p-8 text-center"><Icon icon="solar:user-id-linear" height={32} width={32} className="mx-auto mb-3 text-muted-foreground" /><p className="text-sm text-muted-foreground">Sélectionnez un formateur pour voir ses détails.</p></div>}
      </CardBox>}
    </div>
  );
};

export default GestionFormateurs;
