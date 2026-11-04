import { useState } from 'react';
import { Icon } from '@iconify/react';
import educationAPI from 'src/api/education/education-data';
import CardBox from 'src/components/shared/CardBox';
import { Button } from 'src/components/ui/button';
import { Textarea } from 'src/components/ui/textarea';

const exemples = [
  'Quels sont les cours de Python ?',
  'Quelles compétences développe le cours Python ?',
  'Combien de formations existe-t-il ?',
];

type Ligne = Record<string, string>;

type Message = {
  role: 'user' | 'assistant';
  content: string;
  resultats?: Ligne[];
};

/** Met en forme un nom de variable SPARQL pour l'affichage en en-tête de colonne. */
const libelle = (cle: string) =>
  cle.charAt(0).toUpperCase() + cle.slice(1).replace(/_/g, ' ');

const TraducteurNLP = () => {
  const [question, setQuestion] = useState(exemples[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  const traduire = async () => {
    if (!question.trim()) return;
    const questionEnvoyee = question.trim();
    setChargement(true);
    setErreur('');
    try {
      const reponse = await educationAPI.traduireQuestion(questionEnvoyee);
      const resultats = reponse.resultats ?? [];
      setMessages((precedents) => [
        ...precedents,
        { role: 'user', content: questionEnvoyee },
        {
          role: 'assistant',
          content: resultats.length
            ? `J’ai trouvé ${resultats.length} résultat${resultats.length > 1 ? 's' : ''} :`
            : 'Je n’ai trouvé aucun résultat pour cette question.',
          resultats,
        },
      ]);
      setQuestion('');
    } catch (error) {
      setErreur(error instanceof Error ? error.message : 'La traduction a échoué.');
    } finally {
      setChargement(false);
    }
  };

  return (
    <CardBox className="p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-full bg-lightprimary p-3 text-primary">
          <Icon icon="solar:stars-minimalistic-linear" height={24} />
        </div>
        <div>
          <h4 className="text-lg font-semibold text-ld">Assistant IA sémantique</h4>
          <p className="text-sm text-ld">
            Posez votre question naturellement. Je l’analyse avec le vocabulaire de l’ontologie et
            je vous réponds avec les résultats trouvés.
          </p>
        </div>
      </div>

      <div className="mb-4 min-h-32 space-y-3 rounded-lg bg-lightprimary/20 p-4">
        {messages.length === 0 && (
          <div className="flex items-start gap-2 text-sm text-ld">
            <Icon icon="solar:stars-minimalistic-linear" height={20} className="mt-0.5 text-primary" />
            <p>Bonjour ! Je peux rechercher des cours, formations, compétences, étudiants et parcours.</p>
          </div>
        )}
        {messages.map((message, index) => {
          const resultats = message.resultats ?? [];
          const colonnes = resultats.length ? Object.keys(resultats[0]) : [];
          return (
          <div
            key={`${message.role}-${index}`}
            className={`flex items-start gap-2 text-sm ${
              message.role === 'user' ? 'justify-end' : ''
            }`}
          >
            {message.role === 'assistant' && (
              <Icon icon="solar:stars-minimalistic-linear" height={20} className="mt-0.5 shrink-0 text-primary" />
            )}
            <div
              className={`rounded-lg px-3 py-2 ${
                message.role === 'user'
                  ? 'max-w-[85%] bg-primary text-white'
                  : 'max-w-full bg-white text-ld dark:bg-dark dark:text-white'
              }`}
            >
              <p>{message.content}</p>
              {message.role === 'assistant' && colonnes.length > 0 && (
                <div className="mt-3 max-h-80 overflow-auto rounded-md border border-ld">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-ld bg-lightprimary/30">
                        {colonnes.map((cle) => (
                          <th key={cle} className="whitespace-nowrap px-3 py-2 font-semibold text-ld">
                            {libelle(cle)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resultats.map((ligne, ligneIndex) => (
                        <tr key={ligneIndex} className="border-b border-ld last:border-0">
                          {colonnes.map((cle) => (
                            <td key={cle} className="px-3 py-2 align-top text-ld">
                              {ligne[cle] ?? '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {message.role === 'user' && (
              <Icon icon="solar:user-circle-linear" height={20} className="mt-0.5 shrink-0 text-primary" />
            )}
          </div>
          );
        })}
        {chargement && (
          <div className="flex items-center gap-2 text-sm text-ld">
            <Icon icon="solar:stars-minimalistic-linear" height={20} className="text-primary" />
            L’assistant analyse votre question...
          </div>
        )}
      </div>

      <Textarea
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            void traduire();
          }
        }}
        placeholder="Écrivez votre question..."
        aria-label="Message à l’assistant IA"
        rows={2}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={() => void traduire()} disabled={chargement || !question.trim()}>
          <Icon icon="solar:magic-stick-3-linear" height={18} />
          {chargement ? 'Réflexion...' : 'Envoyer'}
        </Button>
        <span className="text-xs text-ld">Ctrl + Entrée pour lancer</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {exemples.map((exemple) => (
          <button
            key={exemple}
            type="button"
            className="rounded-full border border-ld px-3 py-1 text-xs text-ld hover:border-primary hover:text-primary"
            onClick={() => setQuestion(exemple)}
          >
            {exemple}
          </button>
        ))}
      </div>

      {erreur && (
        <div className="mt-4 rounded-md bg-lighterror p-3 text-sm text-error" role="alert">
          {erreur}
        </div>
      )}
    </CardBox>
  );
};

export default TraducteurNLP;
