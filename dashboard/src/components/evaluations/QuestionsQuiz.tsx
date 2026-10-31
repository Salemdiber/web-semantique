import { useCallback, useEffect, useState } from 'react';
import { Button } from 'src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'src/components/ui/dialog';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';
import educationAPI from 'src/api/education/education-data';

interface Props {
  evaluationId: string | null;
  nom: string;
  onClose: () => void;
  /** Appelé après un enregistrement ou une réinitialisation. */
  onModifie?: () => void;
}

type QuestionEdition = {
  enonce: string;
  choix: string[];
  bonneReponse: number;
  points: number;
};

const questionVide = (): QuestionEdition => ({
  enonce: '',
  choix: ['', '', ''],
  bonneReponse: 0,
  points: 1,
});

const QuestionsQuiz = ({
  evaluationId,
  nom,
  onClose,
  onModifie,
}: Props) => {
  const [questions, setQuestions] = useState<QuestionEdition[]>([
    questionVide(),
  ]);
  const [tentatives, setTentatives] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');

  const charger = useCallback(async () => {
    if (!evaluationId) return;
    setChargement(true);
    setErreur('');
    setSucces('');
    try {
      const donnees = await educationAPI.questionsQuiz(evaluationId);
      setQuestions(
        donnees.questions.length > 0
          ? donnees.questions.map((question) => ({
              enonce: question.enonce,
              choix: question.choix,
              bonneReponse: question.bonneReponse ?? 0,
              points: question.points,
            }))
          : [questionVide()],
      );
      setTentatives(donnees.tentatives);
    } catch (e) {
      setErreur(
        e instanceof Error
          ? e.message
          : 'Chargement des questions impossible.',
      );
    } finally {
      setChargement(false);
    }
  }, [evaluationId]);

  useEffect(() => {
    if (evaluationId) charger();
  }, [evaluationId, charger]);

  const modifierQuestion = (
    index: number,
    modification: Partial<QuestionEdition>,
  ) => {
    setQuestions((liste) =>
      liste.map((question, position) =>
        position === index ? { ...question, ...modification } : question,
      ),
    );
  };

  const modifierChoix = (
    questionIndex: number,
    choixIndex: number,
    valeur: string,
  ) => {
    setQuestions((liste) =>
      liste.map((question, position) => {
        if (position !== questionIndex) return question;
        const choix = question.choix.map((item, index) =>
          index === choixIndex ? valeur : item,
        );
        return { ...question, choix };
      }),
    );
  };

  const ajouterChoix = (questionIndex: number) => {
    setQuestions((liste) =>
      liste.map((question, position) =>
        position === questionIndex && question.choix.length < 6
          ? { ...question, choix: [...question.choix, ''] }
          : question,
      ),
    );
  };

  const supprimerChoix = (questionIndex: number, choixIndex: number) => {
    setQuestions((liste) =>
      liste.map((question, position) => {
        if (position !== questionIndex || question.choix.length <= 2) {
          return question;
        }
        const choix = question.choix.filter(
          (_, index) => index !== choixIndex,
        );
        let bonneReponse = question.bonneReponse;
        if (bonneReponse === choixIndex) {
          bonneReponse = 0;
        } else if (bonneReponse > choixIndex) {
          bonneReponse -= 1;
        }
        return { ...question, choix, bonneReponse };
      }),
    );
  };

  const ajouterQuestion = () => {
    setQuestions((liste) => [...liste, questionVide()]);
  };

  const supprimerQuestion = (index: number) => {
    setQuestions((liste) =>
      liste.length <= 1
        ? liste
        : liste.filter((_, position) => position !== index),
    );
  };

  const enregistrer = async () => {
    if (!evaluationId) return;
    const propres = questions.map((question) => ({
      ...question,
      enonce: question.enonce.trim(),
      choix: question.choix.map((choix) => choix.trim()),
    }));
    if (propres.some((question) => question.enonce.length < 3)) {
      setErreur('Chaque question doit contenir un énoncé d’au moins 3 caractères.');
      return;
    }
    if (propres.some((question) => question.choix.some((choix) => !choix))) {
      setErreur('Tous les choix de réponse doivent être remplis.');
      return;
    }
    if (
      propres.some(
        (question) =>
          question.bonneReponse < 0 ||
          question.bonneReponse >= question.choix.length,
      )
    ) {
      setErreur('Indiquez la bonne réponse pour chaque question.');
      return;
    }
    if (propres.some((question) => !(question.points > 0))) {
      setErreur('Les points doivent être strictement positifs.');
      return;
    }

    setEnregistrement(true);
    setErreur('');
    setSucces('');
    try {
      await educationAPI.enregistrerQuestionsQuiz(
        evaluationId,
        propres.map((question) => ({
          enonce: question.enonce,
          choix: question.choix,
          bonne_reponse: question.bonneReponse,
          points: question.points,
        })),
      );
      setSucces('Questionnaire enregistré. Les étudiants peuvent passer le quiz.');
      onModifie?.();
    } catch (e) {
      setErreur(
        e instanceof Error
          ? e.message
          : 'Enregistrement des questions impossible.',
      );
    } finally {
      setEnregistrement(false);
    }
  };

  const reinitialiser = async () => {
    if (!evaluationId) return;
    if (
      !window.confirm(
        'Supprimer toutes les tentatives de ce quiz ? Les notes seront effacées.',
      )
    ) {
      return;
    }
    setEnregistrement(true);
    setErreur('');
    setSucces('');
    try {
      await educationAPI.reinitialiserQuiz(evaluationId);
      setTentatives(0);
      setSucces('Tentatives réinitialisées : le quiz est de nouveau « à faire ».');
      onModifie?.();
    } catch (e) {
      setErreur(
        e instanceof Error
          ? e.message
          : 'Réinitialisation des tentatives impossible.',
      );
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <Dialog
      open={evaluationId !== null}
      onOpenChange={(ouvert) => {
        if (!ouvert) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Questions — {nom}</DialogTitle>
          <DialogDescription>
            La note du quiz est calculée à partir de ces questions. Une seule
            bonne réponse par question.
          </DialogDescription>
        </DialogHeader>

        {chargement ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Chargement du questionnaire…
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {questions.length} question(s) — {tentatives} tentative(s)
              enregistrée(s)
            </p>

            {questions.map((question, questionIndex) => (
              <div
                key={questionIndex}
                className="space-y-3 rounded-lg border border-border p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Question {questionIndex + 1}
                  </p>
                  <Button
                    size="sm"
                    variant="ghosterror"
                    onClick={() => supprimerQuestion(questionIndex)}
                    disabled={questions.length <= 1}
                  >
                    Supprimer
                  </Button>
                </div>

                <div>
                  <Label className="mb-2 block">Énoncé</Label>
                  <textarea
                    className="min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={question.enonce}
                    onChange={(e) =>
                      modifierQuestion(questionIndex, {
                        enonce: e.target.value,
                      })
                    }
                    placeholder="Quelle est la bonne réponse ?"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="block">
                    Choix (cochez la bonne réponse)
                  </Label>
                  {question.choix.map((choix, choixIndex) => (
                    <div
                      key={`${questionIndex}-${choixIndex}`}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="radio"
                        name={`bonne-reponse-${questionIndex}`}
                        checked={question.bonneReponse === choixIndex}
                        onChange={() =>
                          modifierQuestion(questionIndex, {
                            bonneReponse: choixIndex,
                          })
                        }
                        className="h-4 w-4 accent-primary"
                        aria-label={`Bonne réponse ${choixIndex + 1}`}
                      />
                      <Input
                        value={choix}
                        onChange={(e) =>
                          modifierChoix(
                            questionIndex,
                            choixIndex,
                            e.target.value,
                          )
                        }
                        placeholder={`Choix ${choixIndex + 1}`}
                      />
                      <Button
                        size="sm"
                        variant="ghosterror"
                        onClick={() =>
                          supprimerChoix(questionIndex, choixIndex)
                        }
                        disabled={question.choix.length <= 2}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => ajouterChoix(questionIndex)}
                    disabled={question.choix.length >= 6}
                  >
                    Ajouter un choix
                  </Button>
                </div>

                <div className="w-32">
                  <Label className="mb-2 block">Points</Label>
                  <Input
                    type="number"
                    min={0.5}
                    step="0.5"
                    value={question.points}
                    onChange={(e) =>
                      modifierQuestion(questionIndex, {
                        points: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={ajouterQuestion}>
              Ajouter une question
            </Button>

            {erreur && (
              <p
                role="alert"
                className="rounded-md bg-lighterror px-3 py-2 text-sm text-error"
              >
                {erreur}
              </p>
            )}
            {succes && (
              <p className="rounded-md bg-lightsuccess px-3 py-2 text-sm text-success">
                {succes}
              </p>
            )}

            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
              <Button
                variant="outline"
                onClick={reinitialiser}
                disabled={enregistrement || tentatives === 0}
              >
                Réinitialiser les tentatives
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Fermer
                </Button>
                <Button onClick={enregistrer} disabled={enregistrement}>
                  {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QuestionsQuiz;
