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
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'src/components/ui/table';
import CardBox from 'src/components/shared/CardBox';
import educationAPI from 'src/api/education/education-data';
import QuizEtudiant from 'src/components/evaluations/QuizEtudiant';
import QuestionsQuiz from 'src/components/evaluations/QuestionsQuiz';
import type {
  Competence,
  Cours,
  Etudiant,
  Evaluation,
} from 'src/types/apps/education';
import { useAuth } from 'src/context/auth-context';

const AUCUN = '__aucun__';

const TYPES: { valeur: string; libelle: string }[] = [
  { valeur: 'Examen', libelle: 'Examen' },
  { valeur: 'Quiz', libelle: 'Quiz' },
  { valeur: 'Evaluation', libelle: 'Évaluation' },
];

/** Retire les doublons renvoyés par le graphe (même nom local). */
const uniques = <T extends { id: string }>(liste: T[]): T[] => {
  const vus = new Set<string>();
  return liste.filter((item) => {
    if (!item.id || vus.has(item.id)) return false;
    vus.add(item.id);
    return true;
  });
};

const versValeurType = (type: string | null) =>
  type === 'Évaluation' ? 'Evaluation' : (type ?? 'Examen');

const aujourdhui = () => {
  const date = new Date();
  const jour = String(date.getDate()).padStart(2, '0');
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  return `${jour}/${mois}/${date.getFullYear()}`;
};

const versNombre = (valeur: string): number | null => {
  if (valeur.trim() === '') return null;
  const nombre = Number(valeur.replace(',', '.'));
  return Number.isFinite(nombre) ? nombre : null;
};

const GestionEvaluations = () => {
  const { utilisateur } = useAuth();
  const peutEditer =
    utilisateur?.role === 'admin' || utilisateur?.role === 'formateur';
  const estEtudiant = utilisateur?.role === 'etudiant';

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [cours, setCours] = useState<Cours[]>([]);
  const [etudiants, setEtudiants] = useState<Etudiant[]>([]);
  const [competences, setCompetences] = useState<Competence[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [filtre, setFiltre] = useState<'tous' | 'Quiz' | 'Examen'>('tous');
  const [quizEtudiant, setQuizEtudiant] = useState<{
    id: string;
    nom: string;
  } | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<{
    id: string;
    nom: string;
  } | null>(null);

  const [ouvert, setOuvert] = useState(false);
  const [idEdition, setIdEdition] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [type, setType] = useState('Quiz');
  const [coursChoisi, setCoursChoisi] = useState('');
  const [etudiantChoisi, setEtudiantChoisi] = useState(AUCUN);
  const [competenceChoisie, setCompetenceChoisie] = useState(AUCUN);
  const [date, setDate] = useState(aujourdhui());
  const [noteMax, setNoteMax] = useState('20');
  const [noteMin, setNoteMin] = useState('12');
  const [note, setNote] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur('');
    try {
      // Un étudiant ne charge que ses propres évaluations et quiz.
      if (utilisateur?.role === 'etudiant') {
        setEvaluations(await educationAPI.mesEvaluations());
        return;
      }
      const [liste, listeCours, listeEtudiants, listeCompetences] =
        await Promise.all([
          educationAPI.evaluations(),
          educationAPI.cours(),
          educationAPI.etudiants(),
          educationAPI.competences(),
        ]);
      setEvaluations(liste);
      setCours(uniques(listeCours));
      setEtudiants(uniques(listeEtudiants));
      setCompetences(uniques(listeCompetences));
    } catch (e) {
      setErreur(
        e instanceof Error
          ? e.message
          : 'Chargement des évaluations impossible.',
      );
    } finally {
      setChargement(false);
    }
  }, [utilisateur?.role]);

  useEffect(() => {
    charger();
  }, [charger]);

  const ouvrirCreation = () => {
    setIdEdition(null);
    setNom('');
    setType('Quiz');
    setCoursChoisi('');
    setEtudiantChoisi(AUCUN);
    setCompetenceChoisie(AUCUN);
    setDate(aujourdhui());
    setNoteMax('20');
    setNoteMin('12');
    setNote('');
    setErreur('');
    setOuvert(true);
  };

  const ouvrirEdition = (evaluation: Evaluation) => {
    setIdEdition(evaluation.id);
    setNom(evaluation.nom);
    setType(versValeurType(evaluation.type));
    setCoursChoisi(evaluation.coursId ?? '');
    setEtudiantChoisi(evaluation.etudiantId ?? AUCUN);
    setCompetenceChoisie(evaluation.competenceId ?? AUCUN);
    setDate(evaluation.date ?? '');
    setNoteMax(String(evaluation.noteMax ?? 20));
    setNoteMin(String(evaluation.noteMin ?? 12));
    setNote(evaluation.note === null ? '' : String(evaluation.note));
    setErreur('');
    setOuvert(true);
  };

  const enregistrer = async () => {
    if (nom.trim().length < 2) {
      setErreur('Le nom de l’évaluation est trop court.');
      return;
    }
    if (!coursChoisi) {
      setErreur('Choisissez le cours évalué.');
      return;
    }
    const max = versNombre(noteMax);
    const min = versNombre(noteMin);
    // Pour un quiz, la note provient uniquement de la tentative de l'étudiant.
    const resultat = type === 'Quiz' ? null : versNombre(note);
    if (max === null || max <= 0) {
      setErreur('La note maximale doit être un nombre positif.');
      return;
    }
    if (min === null || min < 0 || min > max) {
      setErreur('La note minimale de réussite doit être comprise entre 0 et la note maximale.');
      return;
    }
    if (resultat !== null && (resultat < 0 || resultat > max)) {
      setErreur('La note obtenue doit être comprise entre 0 et la note maximale.');
      return;
    }

    setEnCours(true);
    setErreur('');
    try {
      const donnees = {
        nom: nom.trim(),
        type,
        cours: coursChoisi,
        etudiant: etudiantChoisi === AUCUN ? null : etudiantChoisi,
        competence: competenceChoisie === AUCUN ? null : competenceChoisie,
        date: date.trim() || null,
        note_max: max,
        note_min: min,
        note: resultat,
      };
      let creee: Evaluation | null = null;
      if (idEdition) {
        await educationAPI.modifierEvaluation(idEdition, donnees);
      } else {
        creee = await educationAPI.creerEvaluation(donnees);
      }
      setOuvert(false);
      await charger();
      // Un quiz fraîchement créé invite à saisir ses questions.
      if (creee && donnees.type === 'Quiz') {
        setQuizQuestions({ id: creee.id, nom: creee.nom });
      }
    } catch (e) {
      setErreur(
        e instanceof Error ? e.message : 'Enregistrement impossible.',
      );
    } finally {
      setEnCours(false);
    }
  };

  const supprimer = async (evaluation: Evaluation) => {
    if (!window.confirm(`Supprimer l'évaluation « ${evaluation.nom} » ?`)) {
      return;
    }
    setErreur('');
    try {
      await educationAPI.supprimerEvaluation(evaluation.id);
      setEvaluations((liste) =>
        liste.filter((item) => item.id !== evaluation.id),
      );
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Suppression impossible.');
    }
  };

  const compteurParType = useMemo(() => {
    const compteur: Record<string, number> = {};
    evaluations.forEach((evaluation) => {
      const cle = evaluation.type ?? 'Évaluation';
      compteur[cle] = (compteur[cle] ?? 0) + 1;
    });
    return compteur;
  }, [evaluations]);

  /** Bilan personnel affiché à l'étudiant (moyenne ramenée sur 20). */
  const bilan = useMemo(() => {
    const notees = evaluations.filter((evaluation) => evaluation.note !== null);
    return {
      total: evaluations.length,
      quiz: evaluations.filter((evaluation) => evaluation.type === 'Quiz')
        .length,
      reussis: evaluations.filter((evaluation) => evaluation.reussi === true)
        .length,
      moyenne:
        notees.length > 0
          ? notees.reduce(
              (total, evaluation) =>
                total +
                ((evaluation.note ?? 0) / (evaluation.noteMax || 20)) * 20,
              0,
            ) / notees.length
          : null,
    };
  }, [evaluations]);

  /** Filtre « Tout / Quiz / Examens » appliqué à la liste affichée. */
  const evaluationsAffichees = useMemo(() => {
    if (!estEtudiant || filtre === 'tous') return evaluations;
    return evaluations.filter((evaluation) => evaluation.type === filtre);
  }, [evaluations, estEtudiant, filtre]);

  return (
    <CardBox className="p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold">
            {estEtudiant ? 'Mes évaluations & quiz' : 'Évaluations'}
          </h4>
          <p className="text-sm text-muted-foreground">
            {estEtudiant
              ? 'Seules les évaluations et les quiz qui vous sont attribués apparaissent ici.'
              : 'Notes et résultats : la réussite dépend de la note minimale.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{evaluations.length} évaluation(s)</span>
            {estEtudiant ? (
              <>
                <span className="rounded-full bg-lightprimary px-2 py-0.5 text-primary">
                  Quiz : {bilan.quiz}
                </span>
                <span className="rounded-full bg-lightsuccess px-2 py-0.5 text-success">
                  Réussi(s) : {bilan.reussis}
                </span>
                {bilan.moyenne !== null && (
                  <span className="rounded-full bg-lightsecondary px-2 py-0.5 text-secondary">
                    Moyenne : {bilan.moyenne.toFixed(2)}/20
                  </span>
                )}
              </>
            ) : (
              Object.entries(compteurParType).map(([libelle, nombre]) => (
                <span
                  key={libelle}
                  className="rounded-full bg-lightprimary px-2 py-0.5 text-primary"
                >
                  {libelle} : {nombre}
                </span>
              ))
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={charger} disabled={chargement}>
            Recharger
          </Button>
          {peutEditer && (
            <Button size="sm" onClick={ouvrirCreation}>
              Ajouter une évaluation
            </Button>
          )}
        </div>
      </div>

      {estEtudiant && (
        <div className="mb-4 flex flex-wrap gap-2">
          {(['tous', 'Quiz', 'Examen'] as const).map((valeur) => (
            <Button
              key={valeur}
              size="sm"
              variant={filtre === valeur ? 'default' : 'outline'}
              onClick={() => setFiltre(valeur)}
            >
              {valeur === 'tous'
                ? `Tout (${bilan.total})`
                : valeur === 'Quiz'
                  ? `Quiz (${bilan.quiz})`
                  : `Examens (${compteurParType.Examen ?? 0})`}
            </Button>
          ))}
        </div>
      )}

      {erreur && !ouvert && (
        <p
          role="alert"
          className="mb-4 rounded-md bg-lighterror px-3 py-2 text-sm text-error"
        >
          {erreur}
        </p>
      )}

      {chargement ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Chargement des évaluations…
        </p>
      ) : evaluationsAffichees.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {estEtudiant
            ? 'Aucune évaluation ni quiz ne vous est attribué pour le moment.'
            : 'Aucune évaluation enregistrée dans l\'ontologie.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Cours</TableHead>
                {!estEtudiant && <TableHead>Étudiant</TableHead>}
                <TableHead>Date</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Résultat</TableHead>
                {(peutEditer || estEtudiant) && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluationsAffichees.map((evaluation) => (
                <TableRow key={evaluation.id}>
                  <TableCell className="font-medium">{evaluation.nom}</TableCell>
                  <TableCell>
                    <span className="rounded-full bg-lightsecondary px-2 py-0.5 text-xs font-medium text-secondary">
                      {evaluation.type ?? 'Évaluation'}
                    </span>
                  </TableCell>
                  <TableCell>{evaluation.cours}</TableCell>
                  {!estEtudiant && (
                    <TableCell className="text-muted-foreground">
                      {evaluation.etudiant ?? '—'}
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground">
                    {evaluation.date ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {evaluation.note === null
                      ? `— / ${evaluation.noteMax}`
                      : `${evaluation.note} / ${evaluation.noteMax}`}
                    <span className="ml-1 text-xs">
                      (min. {evaluation.noteMin})
                    </span>
                  </TableCell>
                  <TableCell>
                    {evaluation.reussi === null ? (
                      <span className="text-xs text-muted-foreground">
                        {estEtudiant ? 'À faire' : 'En attente'}
                      </span>
                    ) : evaluation.reussi ? (
                      <span className="rounded-full bg-lightsuccess px-2 py-0.5 text-xs font-medium text-success">
                        Réussi
                      </span>
                    ) : (
                      <span className="rounded-full bg-lighterror px-2 py-0.5 text-xs font-medium text-error">
                        Échec
                      </span>
                    )}
                  </TableCell>
                  {peutEditer && (
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {evaluation.type === 'Quiz' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setQuizQuestions({
                                id: evaluation.id,
                                nom: evaluation.nom,
                              })
                            }
                          >
                            Questions ({evaluation.quizQuestions ?? 0})
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => ouvrirEdition(evaluation)}
                        >
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant="lighterror"
                          onClick={() => supprimer(evaluation)}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </TableCell>
                  )}
                  {estEtudiant && (
                    <TableCell className="text-right">
                      {evaluation.type !== 'Quiz' ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (evaluation.quizQuestions ?? 0) === 0 ? (
                        <span className="text-xs text-warning">
                          Quiz sans questions
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant={evaluation.quizPasse ? 'outline' : 'default'}
                          onClick={() =>
                            setQuizEtudiant({
                              id: evaluation.id,
                              nom: evaluation.nom,
                            })
                          }
                        >
                          {!evaluation.quizPasse
                            ? 'Passer le quiz'
                            : evaluation.reussi
                              ? 'Voir le résultat'
                              : 'Réessayer'}
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {idEdition ? "Modifier l'évaluation" : 'Nouvelle évaluation'}
            </DialogTitle>
            <DialogDescription>
              Une évaluation porte un nom, une date et des notes ; sa réussite
              est comparée à la note minimale.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="nom-evaluation" className="mb-2 block">
                Nom
              </Label>
              <Input
                id="nom-evaluation"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Quiz Angular"
              />
            </div>

            <div>
              <Label className="mb-2 block">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((option) => (
                    <SelectItem key={option.valeur} value={option.valeur}>
                      {option.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block">Cours associé</Label>
              <Select value={coursChoisi} onValueChange={setCoursChoisi}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir un cours" />
                </SelectTrigger>
                <SelectContent>
                  {cours.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block">Étudiant (facultatif)</Label>
              <Select value={etudiantChoisi} onValueChange={setEtudiantChoisi}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUCUN}>— Aucun —</SelectItem>
                  {etudiants.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.prenom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block">Compétence (facultatif)</Label>
              <Select
                value={competenceChoisie}
                onValueChange={setCompetenceChoisie}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUCUN}>— Aucune —</SelectItem>
                  {competences.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date-evaluation" className="mb-2 block">
                Date
              </Label>
              <Input
                id="date-evaluation"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="JJ/MM/AAAA"
              />
            </div>

            <div>
              <Label htmlFor="note-max" className="mb-2 block">
                Note maximale
              </Label>
              <Input
                id="note-max"
                type="number"
                min={1}
                step="0.5"
                value={noteMax}
                onChange={(e) => setNoteMax(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="note-min" className="mb-2 block">
                Note minimale de réussite
              </Label>
              <Input
                id="note-min"
                type="number"
                min={0}
                step="0.5"
                value={noteMin}
                onChange={(e) => setNoteMin(e.target.value)}
              />
            </div>

            {type === 'Quiz' ? (
              <div className="rounded-md bg-lightprimary px-3 py-2 text-xs text-primary sm:col-span-2">
                La note de ce quiz sera calculée automatiquement après la
                tentative de l'étudiant. Enregistrez le quiz puis ajoutez ses
                questions avec le bouton « Questions ».
              </div>
            ) : (
              <div>
                <Label htmlFor="note-obtenue" className="mb-2 block">
                  Note obtenue
                </Label>
                <Input
                  id="note-obtenue"
                  type="number"
                  min={0}
                  step="0.5"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="—"
                />
              </div>
            )}
          </div>

          {erreur && (
            <p
              role="alert"
              className="rounded-md bg-lighterror px-3 py-2 text-sm text-error"
            >
              {erreur}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            <Button onClick={enregistrer} disabled={enCours}>
              {enCours ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuizEtudiant
        evaluationId={quizEtudiant?.id ?? null}
        nom={quizEtudiant?.nom ?? ''}
        onClose={() => setQuizEtudiant(null)}
        onTermine={charger}
      />

      <QuestionsQuiz
        evaluationId={quizQuestions?.id ?? null}
        nom={quizQuestions?.nom ?? ''}
        onClose={() => setQuizQuestions(null)}
        onModifie={charger}
      />
    </CardBox>
  );
};

export default GestionEvaluations;
