/**
 * Catalogue des cours issu de l'ontologie Éducation & Formation
 * (OWL Protégé → Apache Jena Fuseki → FastAPI → ce composant React).
 */
import { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8001/api';

type CoursApi = {
  id: string;
  nom: string;
  duree: string;
  description: string | null;
  type: string;
  prerequis: string[];
  competences: string[];
  formateurs: string[];
};

const Chip = ({ texte }: { texte: string }) => (
  <span className="mr-1 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary dark:bg-primary dark:text-white">
    {texte}
  </span>
);

const CoursesOntology = () => {
  const [cours, setCours] = useState<CoursApi[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get<CoursApi[]>(`${API_URL}/education/cours`)
      .then((res) => setCours(res.data))
      .catch(() =>
        setErreur(
          "API sémantique injoignable. Démarrez Fuseki (docker compose up -d) puis le backend FastAPI (uvicorn)."
        )
      );
  }, []);

  if (erreur) {
    return (
      <div
        id="catalogue-ontologie"
        className="py-16"
      >
        <div className="container mx-auto max-w-7xl px-4">
          <p className="text-center text-gray-500 dark:text-gray-400">{erreur}</p>
        </div>
      </div>
    );
  }

  return (
    <div id="catalogue-ontologie" className="section-tb">
      <div className="container mx-auto">
        <div className="mb-10 text-center">
          <span className="mb-2 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
            Ontologie Éducation &amp; Formation
          </span>
          <h2 className="text-3xl font-bold sm:text-4xl">
            Catalogue des cours <br /> issu du graphe de connaissances
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Ces données sont interrogées en SPARQL sur Apache Jena Fuseki.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {cours.map((c) => (
            <article
              key={c.id}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-lg dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xl font-bold text-dark dark:text-white">
                  {c.nom}
                </h3>
                <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-xs text-secondary">
                  {c.type}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                ⏳ {c.duree}
              </p>

              {c.formateurs.length > 0 && (
                <p className="mt-3 text-sm">
                  <strong className="text-dark dark:text-white">
                    Formateur :{' '}
                  </strong>
                  {c.formateurs.join(', ')}
                </p>
              )}

              <div className="mt-3">
                <strong className="text-sm text-dark dark:text-white">
                  Prérequis :
                </strong>
                <div className="mt-1">
                  {c.prerequis.length > 0 ? (
                    c.prerequis.map((p) => (
                      <Chip key={p} texte={p} />
                    ))
                  ) : (
                    <span className="text-sm text-gray-400">aucun</span>
                  )}
                </div>
              </div>

              {c.competences.length > 0 && (
                <div className="mt-3">
                  <strong className="text-sm text-dark dark:text-white">
                    Compétences :
                  </strong>
                  <div className="mt-1">
                    {c.competences.map((k) => (
                      <Chip key={k} texte={k} />
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CoursesOntology;
