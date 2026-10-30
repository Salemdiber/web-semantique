/** Catalogue des cours issu de l'ontologie (SPARQL via FastAPI). */
import { useEffect, useState } from 'react';
import CardBox from 'src/components/shared/CardBox';
import educationAPI from 'src/api/education/education-data';
import type { Cours, Etudiant, Formateur } from 'src/types/apps/education';

const onglets = ['Cours', 'Étudiants', 'Formateurs'] as const;
type Onglet = (typeof onglets)[number];

const Chip = ({ enfants }: { enfants: string }) => (
  <span className="m-0.5 inline-block rounded-md bg-lightprimary dark:bg-lightprimary px-2 py-0.5 text-xs text-primary">
    {enfants}
  </span>
);

const hashtag = (label: string | null) =>
  label && label.trim() ? label : 'Non renseigné';

const CatalogueOntologie = () => {
  const [onglet, setOnglet] = useState<Onglet>('Cours');
  const [cours, setCours] = useState<Cours[]>([]);
  const [etudiants, setEtudiants] = useState<Etudiant[]>([]);
  const [formateurs, setFormateurs] = useState<Formateur[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    Promise.all([
      educationAPI.cours(),
      educationAPI.etudiants(),
      educationAPI.formateurs(),
    ])
      .then(([c, e, f]) => {
        setCours(c);
        setEtudiants(e);
        setFormateurs(f);
      })
      .catch((err: Error) => setErreur(err.message))
      .finally(() => setChargement(false));
  }, []);

  const lignes = chargement ? (
    <tr>
      <td colSpan={6} className="px-4 py-6 text-center text-sm">
        Chargement des données de l'ontologie…
      </td>
    </tr>
  ) : onglet === 'Cours' ? (
    cours.map((c) => (
      <tr
        key={c.id}
        className="border-t border-ld dark:border-ld hover:bg-lightprimary dark:hover:bg-lightprimary"
      >
        <td className="px-4 py-3 font-medium">{c.nom}</td>
        <td className="px-4 py-3 text-sm">{c.type}</td>
        <td className="px-4 py-3 text-sm">{hashtag(c.duree)}</td>
        <td className="px-4 py-3">
          {c.prerequis.map((p) => (
            <Chip key={p} enfants={p} />
          ))}
        </td>
        <td className="px-4 py-3">
          {c.competences.map((k) => (
            <Chip key={k} enfants={k} />
          ))}
        </td>
        <td className="px-4 py-3">
          {c.formateurs.map((f) => (
            <Chip key={f} enfants={f} />
          ))}
        </td>
      </tr>
    ))
  ) : onglet === 'Étudiants' ? (
    etudiants.map((e) => (
      <tr
        key={e.id}
        className="border-t border-ld dark:border-ld hover:bg-lightprimary dark:hover:bg-lightprimary"
      >
        <td className="px-4 py-3 font-medium">{e.prenom}</td>
        <td className="px-4 py-3 text-sm">{e.niveau}</td>
        <td className="px-4 py-3" colSpan={4}>
          {e.formations.map((f) => (
            <Chip key={f} enfants={f} />
          ))}
          {e.cours.map((c) => (
            <Chip key={c} enfants={`Cours : ${c}`} />
          ))}
          {e.certifications.map((c) => (
            <Chip key={c} enfants={`🎓 ${c}`} />
          ))}
        </td>
      </tr>
    ))
  ) : (
    formateurs.map((f) => (
      <tr
        key={f.id}
        className="border-t border-ld dark:border-ld hover:bg-lightprimary dark:hover:bg-lightprimary"
      >
        <td className="px-4 py-3 font-medium">{f.prenom}</td>
        <td className="px-4 py-3 text-sm">{hashtag(f.domaine)}</td>
        <td className="px-4 py-3" colSpan={4}>
          {f.cours.map((c) => (
            <Chip key={c} enfants={c} />
          ))}
        </td>
      </tr>
    ))
  );

  const colonnes: Record<Onglet, string[]> = {
    Cours: ['Nom', 'Type', 'Durée', 'Prérequis', 'Compétences', 'Formateur'],
    Étudiants: ['Prénom', 'Niveau', 'Formation / Cours / Certifications'],
    Formateurs: ['Prénom', 'Domaine', 'Cours enseignés'],
  };

  return (
    <CardBox className="p-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-ld dark:border-ld px-4 py-3">
        <div className="flex gap-2">
          {onglets.map((o) => (
            <button
              key={o}
              onClick={() => setOnglet(o)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                onglet === o
                  ? 'bg-primary text-white'
                  : 'text-ld hover:bg-lightprimary'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
        <span className="text-xs text-ld">
          Source : SPARQL → Jena Fuseki → OWL Protégé
        </span>
      </div>

      {erreur && (
        <div className="m-4 rounded-md bg-[var(--color-error,#ef4444)]/10 px-4 py-3 text-sm text-error">
          {erreur}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs uppercase text-ld dark:text-ld">
              {colonnes[onglet].map((col, i) => (
                <th
                  key={col}
                  className={`px-4 py-3 ${i > 0 && onglet === 'Cours' ? 'text-left' : ''}`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{lignes}</tbody>
        </table>
      </div>
    </CardBox>
  );
};

export default CatalogueOntologie;
