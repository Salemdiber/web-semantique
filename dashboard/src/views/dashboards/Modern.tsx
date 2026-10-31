import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import CardBox from 'src/components/shared/CardBox';
import educationAPI from 'src/api/education/education-data';
import type { Cours, Statistique } from 'src/types/apps/education';
import { useAuth } from 'src/context/auth-context';
import { LIBELLES_ROLE } from 'src/api/auth/auth-data';

const CARTES = [
  { classe: 'Cours', libelle: 'Cours', icone: 'solar:book-bookmark-linear', couleur: 'bg-lightprimary text-primary' },
  { classe: 'Etudiant', libelle: 'Étudiants', icone: 'solar:users-group-rounded-linear', couleur: 'bg-lightsuccess text-success' },
  { classe: 'Formateur', libelle: 'Formateurs', icone: 'solar:user-id-linear', couleur: 'bg-lightsecondary text-secondary' },
  { classe: 'Certification', libelle: 'Certifications', icone: 'solar:diploma-verified-linear', couleur: 'bg-lightwarning text-warning' },
  { classe: 'Formation', libelle: 'Formations', icone: 'solar:case-round-linear', couleur: 'bg-lightinfo text-info' },
  { classe: 'Competence', libelle: 'Compétences', icone: 'solar:lightbulb-bolt-linear', couleur: 'bg-lighterror text-error' },
];

const Accueil = () => {
  const { utilisateur, estAdmin } = useAuth();
  const [statistiques, setStatistiques] = useState<Statistique[]>([]);
  const [cours, setCours] = useState<Cours[]>([]);
  const [fuseki, setFuseki] = useState<'ok' | 'ko' | 'attente'>('attente');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let actif = true;
    Promise.allSettled([
      educationAPI.statistiques(),
      educationAPI.cours(),
      educationAPI.sante(),
    ]).then(([stats, listeCours, sante]) => {
      if (!actif) return;
      if (stats.status === 'fulfilled') setStatistiques(stats.value);
      if (listeCours.status === 'fulfilled') setCours(listeCours.value);
      setFuseki(sante.status === 'fulfilled' ? 'ok' : 'ko');
      if (stats.status === 'rejected' && listeCours.status === 'rejected') {
        setErreur(
          stats.reason instanceof Error
            ? stats.reason.message
            : 'API sémantique injoignable.',
        );
      }
      setChargement(false);
    });
    return () => {
      actif = false;
    };
  }, []);

  const compteur = (classe: string) =>
    statistiques.find((s) => s.classe === classe)?.nombre ?? 0;

  const date = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      {/* En-tête */}
      <CardBox className="p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1 capitalize">{date}</p>
            <h2 className="text-2xl font-semibold">
              Bonjour, {utilisateur?.nom ?? 'à vous'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tableau de bord de la plateforme Éducation &amp; Formation.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {utilisateur && (
              <span className="rounded-full bg-lightprimary px-3 py-1 text-xs font-medium text-primary">
                {LIBELLES_ROLE[utilisateur.role]}
              </span>
            )}
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                fuseki === 'ok'
                  ? 'bg-lightsuccess text-success'
                  : fuseki === 'ko'
                    ? 'bg-lighterror text-error'
                    : 'bg-lightwarning text-warning'
              }`}
            >
              {fuseki === 'ok'
                ? 'Fuseki connecté'
                : fuseki === 'ko'
                  ? 'Fuseki injoignable'
                  : 'Vérification…'}
            </span>
          </div>
        </div>
      </CardBox>

      {erreur && (
        <p
          role="alert"
          className="mb-6 rounded-md bg-lighterror px-4 py-3 text-sm text-error"
        >
          {erreur}
        </p>
      )}

      {/* Indicateurs */}
      <div className="grid grid-cols-12 gap-6">
        {CARTES.map((carte) => (
          <div className="col-span-12 sm:col-span-6 xl:col-span-4" key={carte.classe}>
            <CardBox className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{carte.libelle}</p>
                  <h3 className="text-2xl font-semibold">
                    {chargement ? '…' : compteur(carte.classe)}
                  </h3>
                </div>
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${carte.couleur}`}
                >
                  <Icon icon={carte.icone} height={22} width={22} />
                </span>
              </div>
            </CardBox>
          </div>
        ))}
      </div>

      {/* Accès rapides */}
      <div className="grid grid-cols-12 gap-6 mt-6">
        <div className="col-span-12 lg:col-span-4">
          <CardBox className="p-6 h-full">
            <h4 className="text-lg font-semibold mb-1">Accès rapides</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Les modules de la plateforme.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                to="/education"
                className="flex items-center gap-3 rounded-md border border-ld px-4 py-3 hover:bg-lightprimary transition-colors"
              >
                <Icon icon="solar:graph-outline" height={20} width={20} className="text-primary" />
                <span className="text-sm font-medium">Ontologie Éducation</span>
              </Link>
              {estAdmin && (
                <Link
                  to="/utilisateurs"
                  className="flex items-center gap-3 rounded-md border border-ld px-4 py-3 hover:bg-lightprimary transition-colors"
                >
                  <Icon icon="solar:users-group-rounded-linear" height={20} width={20} className="text-primary" />
                  <span className="text-sm font-medium">Gérer les utilisateurs</span>
                </Link>
              )}
            </div>
          </CardBox>
        </div>

        {/* Catalogue réel */}
        <div className="col-span-12 lg:col-span-8">
          <CardBox className="p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold mb-1">Catalogue des cours</h4>
                <p className="text-sm text-muted-foreground">
                  Cours chargés depuis l'ontologie OWL.
                </p>
              </div>
              <Link to="/education" className="text-sm font-medium text-primary">
                Voir tout
              </Link>
            </div>

            {chargement ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Chargement…
              </p>
            ) : cours.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucun cours disponible.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ld text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Cours</th>
                      <th className="pb-2 font-medium">Durée</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Compétences</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cours.slice(0, 6).map((c) => (
                      <tr key={c.id} className="border-b border-ld last:border-0">
                        <td className="py-2.5 font-medium">{c.nom}</td>
                        <td className="py-2.5 text-muted-foreground">{c.duree}</td>
                        <td className="py-2.5 text-muted-foreground">{c.type}</td>
                        <td className="py-2.5 text-muted-foreground">
                          {c.competences.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBox>
        </div>
      </div>
    </>
  );
};

export default Accueil;
