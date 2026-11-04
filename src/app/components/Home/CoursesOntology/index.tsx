/**
 * Catalogue des cours issu de l'ontologie Éducation & Formation
 * (OWL Protégé → Apache Jena Fuseki → FastAPI → ce composant React).
 */
import { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

type CoursApi = {
  id: string;
  nom: string;
  duree: string;
  description: string | null;
  type: string;
  niveau: string | null;
  categorie: string | null;
  prerequis: string[];
  competences: string[];
  formateurs: string[];
};

const Chip = ({ texte }: { texte: string }) => (
  <span className="mr-1 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
    {texte}
  </span>
);

const messageErreurApi = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const statut = error.response?.status;
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return statut ? `Erreur ${statut} : ${detail}` : detail;
    }
    if (statut) {
      return `Erreur HTTP ${statut} : catalogue indisponible. Vérifiez Fuseki (:3030) et FastAPI (:8000).`;
    }
    return `API sémantique injoignable (${API_URL}). Vérifiez FastAPI (:8000) et Fuseki (:3030).`;
  }
  return error instanceof Error
    ? error.message
    : 'Impossible de charger le catalogue des cours.';
};

const CoursesOntology = () => {
  const [cours, setCours] = useState<CoursApi[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [detail, setDetail] = useState<CoursApi | null>(null);

  useEffect(() => {
    axios
      .get<CoursApi[]>(`${API_URL}/courses`)
      .then((res) => setCours(res.data))
      .catch((error) => setErreur(messageErreurApi(error)))
      .finally(() => setChargement(false));
  }, []);

  const ouvrirDetail = async (identifiant: string) => {
    try {
      const res = await axios.get<CoursApi>(
        `${API_URL}/courses/${encodeURIComponent(identifiant)}`
      );
      setDetail(res.data);
    } catch {
      const local = cours.find((c) => c.id === identifiant) ?? null;
      setDetail(local);
    }
  };

  if (erreur) {
    return (
      <div
        id="catalogue-ontologie"
        className="py-16 bg-cream"
      >
        <div className="container mx-auto max-w-7xl px-4">
          <p className="text-center text-gray-600">{erreur}</p>
        </div>
      </div>
    );
  }

  return (
    <div id="catalogue-ontologie" className="section-tb bg-cream">
      <div className="container mx-auto">
        <div className="mb-10 text-center">
          <span className="mb-2 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
            Ontologie Éducation &amp; Formation
          </span>
          <h2 className="text-3xl font-bold sm:text-4xl">
            Catalogue des cours <br /> issu du graphe de connaissances
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Ces données sont interrogées en SPARQL sur Apache Jena Fuseki.
          </p>
        </div>

        {chargement ? (
          <p className="text-center text-gray-500">
            Chargement du catalogue…
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {cours.map((c) => (
              <article
                key={c.id}
                className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-lg"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-xl font-bold text-dark">
                    {c.nom}
                  </h3>
                  <span className="shrink-0 rounded-full bg-secondary/10 px-2 py-0.5 text-xs text-secondary">
                    {c.type}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  ⏳ {c.duree}
                </p>

                <div className="mt-2 flex flex-wrap gap-1">
                  {c.categorie && <Chip texte={c.categorie} />}
                  {c.niveau && <Chip texte={c.niveau} />}
                </div>

                {c.formateurs.length > 0 && (
                  <p className="mt-3 text-sm">
                    <strong className="text-dark">
                      Formateur :{' '}
                    </strong>
                    {c.formateurs.join(', ')}
                  </p>
                )}

                <div className="mt-3">
                  <strong className="text-sm text-dark">
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
                    <strong className="text-sm text-dark">
                      Compétences :
                    </strong>
                    <div className="mt-1">
                      {c.competences.map((k) => (
                        <Chip key={k} texte={k} />
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => void ouvrirDetail(c.id)}
                  className="mt-4 inline-flex w-fit items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90"
                >
                  Voir le détail
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-bold text-dark">
                  {detail.nom}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  ⏳ {detail.duree}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-full px-2 text-2xl leading-none text-gray-400 hover:text-gray-700"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-1">
              {detail.categorie && <Chip texte={detail.categorie} />}
              {detail.niveau && <Chip texte={detail.niveau} />}
            </div>

            <p className="mt-4 text-sm text-gray-600">
              {detail.description ?? 'Aucune description disponible.'}
            </p>

            {detail.formateurs.length > 0 && (
              <p className="mt-4 text-sm">
                <strong className="text-dark">Formateur : </strong>
                {detail.formateurs.join(', ')}
              </p>
            )}

            <div className="mt-4">
              <strong className="text-sm text-dark">Prérequis :</strong>
              <div className="mt-1">
                {detail.prerequis.length > 0 ? (
                  detail.prerequis.map((p) => <Chip key={p} texte={p} />)
                ) : (
                  <span className="text-sm text-gray-400">aucun</span>
                )}
              </div>
            </div>

            {detail.competences.length > 0 && (
              <div className="mt-4">
                <strong className="text-sm text-dark">Compétences :</strong>
                <div className="mt-1">
                  {detail.competences.map((k) => (
                    <Chip key={k} texte={k} />
                  ))}
                </div>
              </div>
            )}

            <p className="mt-5 text-xs text-gray-400">
              URI OWL : edu:{detail.id}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursesOntology;
