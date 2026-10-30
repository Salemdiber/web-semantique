/** Carte de statistiques alimentée par la requête SPARQL statistiques. */
import { useEffect, useState } from 'react';
import CardBox from 'src/components/shared/CardBox';
import educationAPI from 'src/api/education/education-data';
import type { Statistique } from 'src/types/apps/education';

const CLASSES_CYCLES = [
  'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
  'bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]',
  'bg-[var(--color-info)]/10 text-[var(--color-info)]',
  'bg-[var(--color-success)]/10 text-[var(--color-success)]',
  'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
  'bg-[var(--color-error)]/10 text-[var(--color-error)]',
];

const OntologieStatistiques = () => {
  const [stats, setStats] = useState<Statistique[]>([]);

  useEffect(() => {
    educationAPI
      .statistiques()
      .then(setStats)
      .catch(() => setStats([]));
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
      {stats.map((stat, i) => (
        <CardBox key={stat.classe} className="p-5">
          <span
            className={`${CLASSES_CYCLES[i % CLASSES_CYCLES.length]} block py-2 rounded-lg text-sm text-center w-full`}
          >
            {stat.nom}
          </span>
          <div className="mt-4">
            <h3 className="text-4xl font-bold">{stat.nombre}</h3>
            <p className="text-sm text-ld dark:text-ld">
              Individus de la classe {stat.classe}
            </p>
          </div>
        </CardBox>
      ))}
      {stats.length === 0 && (
        <CardBox className="p-6 col-span-full">
          <p className="text-sm">
            Aucune statistique — vérifier que Fuseki et FastAPI sont démarrés et
            que le fichier OWL a été chargé (endpoint /api/ontologie/charger).
          </p>
        </CardBox>
      )}
    </div>
  );
};

export default OntologieStatistiques;
