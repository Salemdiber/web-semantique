import { useEffect, type ReactNode } from 'react';

const SITE_URL: string =
  import.meta.env.VITE_FRONT_URL ?? 'http://localhost:3010';

interface Props {
  titre: string;
  sousTitre: string;
  children: ReactNode;
}

/**
 * Enveloppe commune aux écrans de connexion et d'inscription.
 * Reprend l'identité de la landing (fond crème, violet #611f69, font Inter)
 * et force le thème clair le temps de l'écran, quel que soit le thème du
 * dashboard.
 */
const AuthShell = ({ titre, sousTitre, children }: Props) => {
  useEffect(() => {
    const racine = document.documentElement;
    const etaitSombre = racine.classList.contains('dark');
    racine.classList.remove('dark');
    return () => {
      if (etaitSombre) racine.classList.add('dark');
    };
  }, []);

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#fcf5ef] px-4 py-12"
      style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
    >
      {/* Décor discret, rappel des formes du front */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#611f69]/5" />
        <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-[#611f69]/5" />
      </div>

      <div className="relative w-full max-w-[440px]">
        <a
          href={SITE_URL}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#611f69] hover:underline"
        >
          <span aria-hidden="true">←</span> Retour au site
        </a>

        <div className="rounded-2xl border border-[#611f69]/10 bg-white p-8 shadow-[0_24px_60px_-30px_rgba(97,31,105,0.35)]">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#611f69] text-xl font-bold text-white">
              SI
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{titre}</h1>
            <p className="mt-1 text-sm text-slate-500">{sousTitre}</p>
          </div>

          {children}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          SI Éducation — ontologie OWL, FastAPI, Apache Jena Fuseki
        </p>
      </div>
    </div>
  );
};

export default AuthShell;
