import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from 'src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'src/components/ui/dialog';
import educationAPI from 'src/api/education/education-data';
import type {
  QuizDetail,
  ResultatQuiz,
} from 'src/types/apps/education';

interface Props {
  /** Identifiant du quiz à passer ; `null` ferme la boîte de dialogue. */
  evaluationId: string | null;
  nom: string;
  onClose: () => void;
  /** Appelé après une soumission pour rafraîchir la liste. */
  onTermine: () => void;
}

const QuizEtudiant = ({ evaluationId, nom, onClose, onTermine }: Props) => {
  const [detail, setDetail] = useState<QuizDetail | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [reponses, setReponses] = useState<Record<number, number>>({});
  const [resultat, setResultat] = useState<ResultatQuiz | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [voirQuestions, setVoirQuestions] = useState(false);

  const charger = useCallback(async () => {
    if (!evaluationId) return;
    setChargement(true);
    setErreur('');
    setResultat(null);
    setReponses({});
    try {
      const donnees = await educationAPI.quizDetail(evaluationId);
      setDetail(donnees);
      setVoirQuestions(!donnees.dejaReussi);
    } catch (e) {
      setErreur(
        e instanceof Error ? e.message : 'Chargement du quiz impossible.',
      );
    } finally {
      setChargement(false);
    }
  }, [evaluationId]);

  useEffect(() => {
    if (evaluationId) charger();
  }, [evaluationId, charger]);

  const nombreRepondues = useMemo(
    () => Object.keys(reponses).length,
    [reponses],
  );
  const pretAEnvoyer =
    !!detail &&
    detail.questions.length > 0 &&
    nombreRepondues === detail.questions.length;

  const soumettre = async () => {
    if (!detail || !pretAEnvoyer) return;
    setEnvoi(true);
    setErreur('');
    try {
      const reponsesApi = detail.questions.map((question) => ({
        question_id: question.id,
        choix: reponses[question.id],
      }));
      const resultatApi = await educationAPI.soumettreQuiz(
        detail.evaluationId,
        reponsesApi,
      );
      setResultat(resultatApi);
      setVoirQuestions(false);
      onTermine();
    } catch (e) {
      setErreur(
        e instanceof Error ? e.message : 'Envoi des réponses impossible.',
      );
    } finally {
      setEnvoi(false);
    }
  };

  const reessayer = () => {
    setResultat(null);
    setReponses({});
    setVoirQuestions(true);
  };

  const noteAffichee = resultat?.note ?? detail?.tentative?.note ?? null;
  const reussi = resultat?.reussi ?? detail?.dejaReussi ?? false;
  const tentatives =
    resultat?.tentatives ?? detail?.tentative?.tentatives ?? 0;
  const afficherBilan =
    !voirQuestions && (resultat !== null || detail?.dejaReussi === true);

  return (
    <Dialog
      open={evaluationId !== null}
      onOpenChange={(ouvert) => {
        if (!ouvert) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Quiz — {nom}</DialogTitle>
          <DialogDescription>
            {afficherBilan
              ? 'Résultat de votre tentative.'
              : 'Répondez à toutes les questions puis validez : la note est calculée automatiquement.'}
          </DialogDescription>
        </DialogHeader>

        {erreur && (
          <p
            role="alert"
            className="rounded-md bg-lighterror px-3 py-2 text-sm text-error"
          >
            {erreur}
          </p>
        )}

        {chargement ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Chargement du questionnaire…
          </p>
        ) : !detail ? null : detail.questions.length === 0 ? (
          <p className="rounded-md bg-lightwarning px-3 py-3 text-sm text-warning">
            Ce quiz n'a pas encore de questions. Contactez votre formateur.
          </p>
        ) : afficherBilan ? (
          <div className="space-y-4">
            <div
              className={`rounded-lg border p-4 text-center ${
                reussi
                  ? 'border-success/40 bg-lightsuccess'
                  : 'border-error/40 bg-lighterror'
              }`}
            >
              <p className="text-3xl font-bold">
                {noteAffichee?.toFixed(2)} / {detail.noteMax}
              </p>
              <p
                className={`mt-1 text-sm font-medium ${
                  reussi ? 'text-success' : 'text-error'
                }`}
              >
                {reussi ? 'Quiz réussi' : 'Quiz échoué'} — seuil{' '}
                {detail.noteMin}/{detail.noteMax}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tentatives} tentative(s)
                {resultat
                  ? ` — ${resultat.score}/${resultat.total} point(s)`
                  : detail.tentative
                    ? ` — ${detail.tentative.score}/${detail.tentative.total} point(s)`
                    : ''}
              </p>
            </div>

            {resultat && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Correction</p>
                {resultat.corrections.map((correction, index) => {
                  const question = detail.questions.find(
                    (item) => item.id === correction.questionId,
                  );
                  if (!question) return null;
                  return (
                    <div
                      key={correction.questionId}
                      className={`rounded-md border p-3 text-sm ${
                        correction.correcte
                          ? 'border-success/30 bg-lightsuccess/40'
                          : 'border-error/30 bg-lighterror/40'
                      }`}
                    >
                      <p className="font-medium">
                        {index + 1}. {question.enonce}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        Votre réponse : {question.choix[correction.choix] ?? '—'}
                      </p>
                      {!correction.correcte && (
                        <p className="text-success">
                          Bonne réponse :{' '}
                          {question.choix[correction.bonneReponse] ?? '—'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <DialogFooter className="gap-2">
              {!reussi && (
                <Button variant="outline" onClick={reessayer}>
                  Réessayer
                </Button>
              )}
              <Button onClick={onClose}>Fermer</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {detail.tentative && !detail.dejaReussi && (
              <p className="rounded-md bg-lightwarning px-3 py-2 text-sm text-warning">
                Tentative précédente : {detail.tentative.note.toFixed(2)}/
                {detail.noteMax}. Il faut au moins {detail.noteMin}/
                {detail.noteMax} pour réussir. Vous pouvez réessayer.
              </p>
            )}

            {detail.questions.map((question, index) => (
              <div
                key={question.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">
                    {index + 1}. {question.enonce}
                  </p>
                  <span className="shrink-0 rounded-full bg-lightsecondary px-2 py-0.5 text-xs text-secondary">
                    {question.points} pt
                  </span>
                </div>
                <div className="space-y-2">
                  {question.choix.map((choix, choixIndex) => {
                    const selectionne = reponses[question.id] === choixIndex;
                    return (
                      <button
                        key={`${question.id}-${choixIndex}`}
                        type="button"
                        onClick={() =>
                          setReponses((actuelles) => ({
                            ...actuelles,
                            [question.id]: choixIndex,
                          }))
                        }
                        className={`flex w-full items-start gap-3 rounded-md border p-3 text-left text-sm transition ${
                          selectionne
                            ? 'border-primary bg-lightprimary text-primary'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            selectionne
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground'
                          }`}
                        >
                          {selectionne && (
                            <span className="h-2 w-2 rounded-full bg-white" />
                          )}
                        </span>
                        <span>{choix}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <DialogFooter className="items-center gap-2 sm:justify-between">
              <span className="text-xs text-muted-foreground">
                {nombreRepondues}/{detail.questions.length} question(s)
                répondue(s)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Annuler
                </Button>
                <Button
                  onClick={soumettre}
                  disabled={!pretAEnvoyer || envoi}
                >
                  {envoi ? 'Correction…' : 'Valider mes réponses'}
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QuizEtudiant;
