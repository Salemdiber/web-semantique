import { useCallback, useEffect, useState, type FormEvent } from 'react';
import CardBox from 'src/components/shared/CardBox';
import educationAPI from 'src/api/education/education-data';
import type { Competence, CoursGestion, Prerequis } from 'src/types/apps/education';
import { useAuth } from 'src/context/auth-context';

const localId = (id: string) => id.split('#').pop()?.split('/').pop() ?? id;
const niveauAffiche = (niveau: string | null | undefined) => niveau === 'Avancé' ? 'Difficile' : niveau ?? '';
const inputClass = 'w-full rounded-md border border-ld bg-transparent px-3 py-2 text-sm text-ld';
const labelClass = 'mb-1 block text-sm font-medium text-ld';
const optionClass = 'bg-white text-gray-900';

const GestionCompetences = () => {
  const { utilisateur } = useAuth();
  const peutModifier = utilisateur?.role === 'admin' || utilisateur?.role === 'formateur';
  const [competences, setCompetences] = useState<Competence[]>([]);
  const [prerequis, setPrerequis] = useState<Prerequis[]>([]);
  const [cours, setCours] = useState<CoursGestion[]>([]);
  const [coursCompetence, setCoursCompetence] = useState<string[]>([]);
  const [typeActif, setTypeActif] = useState<'competence' | 'prerequis'>('competence');
  const [competenceSelectionnee, setCompetenceSelectionnee] = useState<string | null>(null);
  const [prerequisSelectionne, setPrerequisSelectionne] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [niveau, setNiveau] = useState('');
  const [classeCompetence, setClasseCompetence] = useState('CompetenceTechnique');
  const [description, setDescription] = useState('');
  const [competenceLiee, setCompetenceLiee] = useState('');
  const [coursLies, setCoursLies] = useState<string[]>([]);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);

  const actualiser = useCallback(async () => {
    setChargement(true);
    try {
      const [k, p, c] = await Promise.all([educationAPI.competences(), educationAPI.prerequis(), educationAPI.coursGestion()]);
      setCompetences(k); setPrerequis(p); setCours(c); setErreur('');
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Chargement impossible'); }
    finally { setChargement(false); }
  }, []);

  useEffect(() => { void actualiser(); }, [actualiser]);

  const nouveau = () => {
    setCompetenceSelectionnee(null); setPrerequisSelectionne(null); setNom(''); setNiveau(''); setCoursCompetence([]);
    setClasseCompetence('CompetenceTechnique'); setDescription('');
    setCompetenceLiee(''); setCoursLies([]); setErreur(''); setMessage('');
  };

  const editerCompetence = (item: Competence) => {
    setTypeActif('competence'); setCompetenceSelectionnee(localId(item.id)); setPrerequisSelectionne(null);
    setNom(item.nom); setNiveau(niveauAffiche(item.niveau)); setClasseCompetence(!item.type ? 'Competence' : item.type.toLowerCase().includes('linguistique') ? 'CompetenceLinguistique' : 'CompetenceTechnique');
    setCoursCompetence(item.coursIds?.length ? item.coursIds.map(localId) : cours.filter(c => item.coursDeveloppant.includes(c.nom)).map(c => localId(c.id)));
    setErreur(''); setMessage('');
  };

  const editerPrerequis = (item: Prerequis) => {
    setTypeActif('prerequis'); setPrerequisSelectionne(localId(item.id)); setCompetenceSelectionnee(null);
    setDescription(item.description); setNiveau(niveauAffiche(item.niveau));
    setCompetenceLiee(item.competenceId ? localId(item.competenceId) : '');
    setCoursLies(item.coursIds.map(localId)); setErreur(''); setMessage('');
  };

  const soumettreCompetence = async (event: FormEvent) => {
    event.preventDefault(); setEnvoi(true); setErreur(''); setMessage('');
    try {
      const body = { nom, niveau: niveau || null, type: classeCompetence, cours_ids: coursCompetence };
      if (competenceSelectionnee) await educationAPI.modifierCompetence(competenceSelectionnee, body);
      else await educationAPI.creerCompetence(body);
      setMessage(competenceSelectionnee ? 'Compétence modifiée.' : 'Compétence créée.'); nouveau(); await actualiser();
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Enregistrement impossible'); }
    finally { setEnvoi(false); }
  };

  const soumettrePrerequis = async (event: FormEvent) => {
    event.preventDefault(); setEnvoi(true); setErreur(''); setMessage('');
    try {
      const body = { description, niveau, competence_id: competenceLiee, cours_ids: coursLies };
      if (prerequisSelectionne) await educationAPI.modifierPrerequis(prerequisSelectionne, body);
      else await educationAPI.creerPrerequis(body);
      setMessage(prerequisSelectionne ? 'Prérequis modifié.' : 'Prérequis créé.'); nouveau(); await actualiser();
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Enregistrement impossible'); }
    finally { setEnvoi(false); }
  };

  const supprimerCompetence = async (item: Competence) => {
    if (!window.confirm(`Supprimer la compétence « ${item.nom} » et ses liens ?`)) return;
    try { await educationAPI.supprimerCompetence(localId(item.id)); setMessage('Compétence supprimée.'); await actualiser(); }
    catch (e) { setErreur(e instanceof Error ? e.message : 'Suppression impossible'); }
  };

  const supprimerPrerequis = async (item: Prerequis) => {
    if (!window.confirm(`Supprimer le prérequis « ${item.description} » et ses liens aux cours ?`)) return;
    try { await educationAPI.supprimerPrerequis(localId(item.id)); setMessage('Prérequis supprimé.'); await actualiser(); }
    catch (e) { setErreur(e instanceof Error ? e.message : 'Suppression impossible'); }
  };

  const onglet = (type: 'competence' | 'prerequis', titre: string) => (
    <button type="button" onClick={() => { nouveau(); setTypeActif(type); }} className={`rounded-md px-4 py-2 text-sm font-medium ${typeActif === type ? 'bg-primary text-white' : 'text-ld hover:bg-lightprimary'}`}>{titre}</button>
  );

  return <div className="space-y-6">
    <CardBox className="p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-xl font-semibold text-ld">Gestion des compétences et prérequis</h3><p className="mt-1 text-sm text-ld">Les données et relations sont enregistrées dans l’ontologie OWL via Fuseki.</p></div>
        <div className="flex gap-2">{onglet('competence', 'Compétences')}{onglet('prerequis', 'Prérequis')}</div>
      </div>
      {!peutModifier && <p className="mb-4 rounded-md bg-lightprimary p-3 text-sm">Votre rôle permet la consultation. La modification est réservée aux formateurs et administrateurs.</p>}
      {erreur && <p role="alert" className="mb-4 rounded-md bg-error/10 p-3 text-sm text-error">{erreur}</p>}
      {message && <p role="status" className="mb-4 rounded-md bg-success/10 p-3 text-sm text-success">{message}</p>}
      {typeActif === 'competence' ? <form onSubmit={soumettreCompetence} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <label><span className={labelClass}>Nom</span><input className={inputClass} required minLength={2} maxLength={120} value={nom} onChange={e => setNom(e.target.value)} placeholder="Angular" disabled={!peutModifier} /></label>
          <label><span className={labelClass}>Niveau</span><select className={inputClass} value={niveau} onChange={e => setNiveau(e.target.value)} disabled={!peutModifier}><option className={optionClass} value="">Non précisé</option><option className={optionClass}>Débutant</option><option className={optionClass}>Intermédiaire</option><option className={optionClass}>Difficile</option></select></label>
          <label><span className={labelClass}>Catégorie OWL</span><select className={inputClass} value={classeCompetence} onChange={e => setClasseCompetence(e.target.value)} disabled={!peutModifier}><option className={optionClass} value="Competence">Générale</option><option className={optionClass} value="CompetenceTechnique">Technique</option><option className={optionClass} value="CompetenceLinguistique">Linguistique</option></select></label>
          {peutModifier && <div className="flex items-end gap-2"><button disabled={envoi} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{envoi ? 'Enregistrement…' : competenceSelectionnee ? 'Enregistrer' : 'Ajouter'}</button>{competenceSelectionnee && <button type="button" onClick={nouveau} className="rounded-md border border-ld px-4 py-2 text-sm">Annuler</button>}</div>}
        </div>
        <fieldset><legend className={labelClass}>Cours qui développent cette compétence</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{cours.map(c => { const id = localId(c.id); return <label key={c.id} className="flex items-center gap-2 text-sm text-ld"><input type="checkbox" checked={coursCompetence.includes(id)} disabled={!peutModifier} onChange={e => setCoursCompetence(current => e.target.checked ? [...current, id] : current.filter(x => x !== id))} />{c.nom}</label>; })}</div><p className="mt-2 text-xs text-ld">Exemple : associez la compétence Angular au cours Développement Web.</p></fieldset>
      </form> : <form onSubmit={soumettrePrerequis} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label><span className={labelClass}>Prérequis</span><input className={inputClass} required minLength={2} maxLength={240} value={description} onChange={e => setDescription(e.target.value)} placeholder="Bases JavaScript" disabled={!peutModifier} /></label>
          <label><span className={labelClass}>Niveau requis</span><select className={inputClass} required value={niveau} onChange={e => setNiveau(e.target.value)} disabled={!peutModifier}><option className={optionClass} value="">Choisir un niveau</option><option className={optionClass}>Débutant</option><option className={optionClass}>Intermédiaire</option><option className={optionClass}>Difficile</option></select></label>
          <label><span className={labelClass}>Compétence liée</span><select className={inputClass} required value={competenceLiee} onChange={e => setCompetenceLiee(e.target.value)} disabled={!peutModifier || competences.length === 0}><option className={optionClass} value="">{competences.length ? 'Choisir une compétence existante' : 'Aucune compétence existante'}</option>{competences.map(k => <option className={optionClass} key={k.id} value={localId(k.id)}>{k.nom}</option>)}</select></label>
        </div>
        <fieldset><legend className={labelClass}>Cours qui demandent ce prérequis</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{cours.map(c => { const id = localId(c.id); return <label key={c.id} className="flex items-center gap-2 text-sm text-ld"><input type="checkbox" checked={coursLies.includes(id)} disabled={!peutModifier} onChange={e => setCoursLies(current => e.target.checked ? [...current, id] : current.filter(x => x !== id))} />{c.nom}</label>; })}</div></fieldset>
        {peutModifier && <div className="flex gap-2"><button disabled={envoi} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{envoi ? 'Enregistrement…' : prerequisSelectionne ? 'Enregistrer' : 'Ajouter le prérequis'}</button>{prerequisSelectionne && <button type="button" onClick={nouveau} className="rounded-md border border-ld px-4 py-2 text-sm">Annuler</button>}</div>}
      </form>}
    </CardBox>

    <CardBox className="overflow-x-auto p-0">
      <table className="w-full text-left"><thead><tr className="border-b border-ld text-xs uppercase text-ld">{(typeActif === 'competence' ? ['Compétence', 'Niveau', 'Cours associés', 'Prérequis associés'] : ['Prérequis', 'Niveau requis', 'Compétence requise', 'Cours concernés']).map(t => <th key={t} className="px-4 py-3">{t}</th>)}{peutModifier && <th className="px-4 py-3">Actions</th>}</tr></thead>
        <tbody>{chargement ? <tr><td colSpan={5} className="px-4 py-6 text-center">Chargement…</td></tr> : typeActif === 'competence' ? competences.map(k => <tr key={k.id} className="border-b border-ld text-sm"><td className="px-4 py-3 font-medium">{k.nom}</td><td className="px-4 py-3">{k.niveau || '—'}</td><td className="px-4 py-3">{k.coursDeveloppant.join(', ') || '—'}</td><td className="px-4 py-3">{k.necessitee.join(', ') || '—'}</td>{peutModifier && <td className="whitespace-nowrap px-4 py-3"><button onClick={() => editerCompetence(k)} className="mr-3 text-primary">Modifier</button><button onClick={() => void supprimerCompetence(k)} className="text-error">Supprimer</button></td>}</tr>) : prerequis.map(p => <tr key={p.id} className="border-b border-ld text-sm"><td className="px-4 py-3 font-medium">{p.description}</td><td className="px-4 py-3">{p.niveau || '—'}</td><td className="px-4 py-3">{p.competenceNom || '—'}</td><td className="px-4 py-3">{p.coursIds.map(id => cours.find(c => localId(c.id) === localId(id))?.nom || localId(id)).join(', ') || '—'}</td>{peutModifier && <td className="whitespace-nowrap px-4 py-3"><button onClick={() => editerPrerequis(p)} className="mr-3 text-primary">Modifier</button><button onClick={() => void supprimerPrerequis(p)} className="text-error">Supprimer</button></td>}</tr>)}
        {!chargement && typeActif === 'competence' && competences.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center">Aucune compétence trouvée.</td></tr>}
        {!chargement && typeActif === 'prerequis' && prerequis.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center">Aucun prérequis trouvé.</td></tr>}</tbody></table>
    </CardBox>
  </div>;
};

export default GestionCompetences;
