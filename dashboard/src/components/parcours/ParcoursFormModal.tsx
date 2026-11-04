import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'src/components/ui/dialog';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Textarea } from 'src/components/ui/textarea';
import { Label } from 'src/components/ui/label';
import { Badge } from 'src/components/ui/badge';
import type {
  Cours,
  NiveauParcours,
  Parcours,
  StatutParcours,
} from 'src/types/apps/education';
import type { ParcoursEntree } from 'src/api/education/education-data';

type Props = {
  ouvert: boolean;
  onFermer: () => void;
  parcoursInitial: Parcours | null;
  catalogueCours: Cours[];
  onEnregistrer: (donnees: ParcoursEntree, id?: string) => Promise<void>;
};

function extraireHeures(duree: string): number {
  const m = /(\d+(?:[.,]\d+)?)/.exec(duree || '');
  if (!m) return 0;
  const v = parseFloat(m[1].replace(',', '.'));
  if (Number.isNaN(v)) return 0;
  const lower = duree.toLowerCase();
  if (lower.includes('semaine')) return v * 10;
  if (lower.includes('mois')) return v * 40;
  if (lower.includes('an')) return v * 300;
  return v;
}

const ParcoursFormModal = ({
  ouvert,
  onFermer,
  parcoursInitial,
  catalogueCours,
  onEnregistrer,
}: Props) => {
  const estEdition = Boolean(parcoursInitial);

  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [objectif, setObjectif] = useState('');
  const [niveau, setNiveau] = useState<NiveauParcours>('Debutant');
  const [statut, setStatut] = useState<StatutParcours>('publie');
  const [coursSelectionnesIds, setCoursSelectionnesIds] = useState<string[]>([]);
  const [rechercheCours, setRechercheCours] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [erreur, setErreur] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    if (!ouvert) return;
    setErreur('');
    setRechercheCours('');
    if (parcoursInitial) {
      setNom(parcoursInitial.nom);
      setDescription(parcoursInitial.description ?? '');
      setObjectif(parcoursInitial.objectif ?? '');
      setNiveau(parcoursInitial.niveau);
      setStatut(parcoursInitial.statut);
      setCoursSelectionnesIds([...parcoursInitial.coursIds]);
    } else {
      setNom('');
      setDescription('');
      setObjectif('');
      setNiveau('Debutant');
      setStatut('brouillon');
      setCoursSelectionnesIds([]);
    }
  }, [ouvert, parcoursInitial]);

  const coursParId = useMemo(() => {
    const map = new Map<string, Cours>();
    catalogueCours.forEach((c) => map.set(c.id, c));
    return map;
  }, [catalogueCours]);

  const coursDisponibles = useMemo(() => {
    const q = rechercheCours.trim().toLowerCase();
    return catalogueCours.filter((c) => {
      if (coursSelectionnesIds.includes(c.id)) return false;
      if (!q) return true;
      return (
        c.nom.toLowerCase().includes(q) ||
        c.competences.some((k) => k.toLowerCase().includes(q)) ||
        (c.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [catalogueCours, coursSelectionnesIds, rechercheCours]);

  const coursOrdonnes = useMemo(
    () =>
      coursSelectionnesIds.map(
        (cid) =>
          coursParId.get(cid) ?? {
            id: cid,
            nom: cid,
            duree: 'Durée non précisée',
            description: null,
            type: 'Cours',
            prerequis: [],
            competences: [],
            formateurs: [],
          },
      ),
    [coursSelectionnesIds, coursParId],
  );

  const resume = useMemo(() => {
    let heures = 0;
    const competences = new Set<string>();
    const prerequis = new Set<string>();
    coursOrdonnes.forEach((c) => {
      heures += extraireHeures(c.duree);
      c.competences.forEach((k) => competences.add(k));
      c.prerequis.forEach((p) => prerequis.add(p));
    });
    return {
      heures,
      competences: Array.from(competences),
      prerequis: Array.from(prerequis),
    };
  }, [coursOrdonnes]);

  const ajouterCours = (coursId: string) => {
    if (!coursSelectionnesIds.includes(coursId)) {
      setCoursSelectionnesIds((prev) => [...prev, coursId]);
    }
  };

  const retirerCours = (coursId: string) => {
    setCoursSelectionnesIds((prev) => prev.filter((id) => id !== coursId));
  };

  const deplacerCours = (de: number, vers: number) => {
    if (vers < 0 || vers >= coursSelectionnesIds.length || de === vers) return;
    setCoursSelectionnesIds((prev) => {
      const copie = [...prev];
      const [element] = copie.splice(de, 1);
      copie.splice(vers, 0, element);
      return copie;
    });
  };

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');

    if (nom.trim().length < 2) {
      setErreur('Le nom du parcours doit comporter au moins 2 caractères.');
      return;
    }
    if (statut === 'publie' && coursSelectionnesIds.length === 0) {
      setErreur(
        'Un parcours publié doit contenir au moins un cours (ou enregistrez-le en brouillon).',
      );
      return;
    }

    setEnregistrement(true);
    try {
      await onEnregistrer(
        {
          nom: nom.trim(),
          description: description.trim() || null,
          objectif: objectif.trim() || null,
          niveau,
          statut,
          cours_ids: coursSelectionnesIds,
        },
        parcoursInitial?.id,
      );
      onFermer();
    } catch (err) {
      setErreur(
        err instanceof Error
          ? err.message
          : 'Erreur lors de la sauvegarde du parcours.',
      );
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <Dialog open={ouvert} onOpenChange={(open) => !open && onFermer()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {estEdition
              ? `Modifier le parcours « ${parcoursInitial?.nom} »`
              : 'Créer un parcours d’apprentissage'}
          </DialogTitle>
          <DialogDescription>
            Définissez le niveau sémantique OWL (
            <code>ParcoursDebutant</code> ou <code>ParcoursAvance</code>) et
            ordonnez les cours existants liés via{' '}
            <code>edu:contientCoursParcours</code>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={soumettre} className="space-y-5 mt-2">
          {erreur && (
            <div
              role="alert"
              className="rounded-md bg-lighterror px-4 py-3 text-sm text-error flex items-center gap-2"
            >
              <Icon icon="solar:danger-triangle-linear" height={18} />
              <span>{erreur}</span>
            </div>
          )}

          {/* Métadonnées principales */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6 space-y-1.5">
              <Label htmlFor="parcours-nom">Nom du parcours *</Label>
              <Input
                id="parcours-nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex. Parcours Ingénierie Web Moderne"
                required
              />
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <Label htmlFor="parcours-niveau">Niveau OWL *</Label>
              <select
                id="parcours-niveau"
                value={niveau}
                onChange={(e) => setNiveau(e.target.value as NiveauParcours)}
                className="flex h-10 w-full rounded-md border border-ld bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="Debutant">Débutant (ParcoursDebutant)</option>
                <option value="Avance">Avancé (ParcoursAvance)</option>
              </select>
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <Label htmlFor="parcours-statut">Statut de publication</Label>
              <select
                id="parcours-statut"
                value={statut}
                onChange={(e) => setStatut(e.target.value as StatutParcours)}
                className="flex h-10 w-full rounded-md border border-ld bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="publie">Publié (visible étudiants)</option>
                <option value="brouillon">Brouillon (interne)</option>
              </select>
            </div>

            <div className="md:col-span-6 space-y-1.5">
              <Label htmlFor="parcours-objectif">Objectif pédagogique</Label>
              <Textarea
                id="parcours-objectif"
                rows={2}
                value={objectif}
                onChange={(e) => setObjectif(e.target.value)}
                placeholder="Compétence métier ou livrable visé à l'issue du parcours…"
              />
            </div>

            <div className="md:col-span-6 space-y-1.5">
              <Label htmlFor="parcours-description">Description</Label>
              <Textarea
                id="parcours-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Présentation synthétique du parcours pour le catalogue…"
              />
            </div>
          </div>

          {/* Compositeur de cours */}
          <div className="rounded-lg border border-ld p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold">
                  Séquence pédagogique des cours ({coursOrdonnes.length})
                </h4>
                <p className="text-xs text-muted-foreground">
                  Glissez-déposez les étapes ou utilisez les flèches pour ajuster
                  l&apos;ordre d&apos;apprentissage.
                </p>
              </div>
              <Badge variant="lightPrimary">
                Durée estimée : {resume.heures} h
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Catalogue de cours OWL en lecture seule */}
              <div className="md:col-span-5 space-y-2 border-b md:border-b-0 md:border-r border-ld pb-4 md:pb-0 md:pr-4">
                <Label htmlFor="recherche-cours" className="text-xs">
                  Ajouter un cours de l&apos;ontologie
                </Label>
                <Input
                  id="recherche-cours"
                  value={rechercheCours}
                  onChange={(e) => setRechercheCours(e.target.value)}
                  placeholder="Filtrer par nom ou compétence…"
                  className="h-9 text-xs"
                />
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {coursDisponibles.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      {catalogueCours.length === coursSelectionnesIds.length
                        ? 'Tous les cours de l’ontologie sont déjà inclus.'
                        : 'Aucun cours ne correspond au filtre.'}
                    </p>
                  ) : (
                    coursDisponibles.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-ld p-2 hover:bg-lightprimary/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{c.nom}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {c.duree}
                            {c.competences.length > 0
                              ? ` · ${c.competences.join(', ')}`
                              : ''}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="lightprimary"
                          className="h-7 px-2.5 text-xs shrink-0"
                          onClick={() => ajouterCours(c.id)}
                        >
                          <Icon icon="solar:add-circle-linear" height={15} />
                          Ajouter
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Liste ordonnée avec Drag & Drop + boutons Haut/Bas */}
              <div className="md:col-span-7 space-y-2">
                <Label className="text-xs">
                  Étapes ordonnées du parcours
                </Label>
                {coursOrdonnes.length === 0 ? (
                  <div className="rounded-md border border-dashed border-ld py-8 px-4 text-center">
                    <Icon
                      icon="solar:routing-2-linear"
                      height={28}
                      className="mx-auto text-muted-foreground mb-1.5"
                    />
                    <p className="text-xs text-muted-foreground">
                      Aucun cours sélectionné. Ajoutez des cours depuis la
                      colonne de gauche.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {coursOrdonnes.map((c, index) => (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={() => setDragIndex(index)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (dragIndex !== null) {
                            deplacerCours(dragIndex, index);
                            setDragIndex(null);
                          }
                        }}
                        onDragEnd={() => setDragIndex(null)}
                        className={`flex items-center justify-between gap-2 rounded-md border p-2.5 bg-background transition-all cursor-grab active:cursor-grabbing ${
                          dragIndex === index
                            ? 'opacity-50 border-primary'
                            : 'border-ld'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs font-semibold">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">
                              {c.nom}{' '}
                              <span className="font-normal text-muted-foreground">
                                ({c.duree})
                              </span>
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {c.competences.length > 0
                                ? `Compétences : ${c.competences.join(', ')}`
                                : 'Aucune compétence déclarée'}
                              {c.prerequis.length > 0
                                ? ` · Prérequis : ${c.prerequis.join(', ')}`
                                : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            title="Monter"
                            disabled={index === 0}
                            onClick={() => deplacerCours(index, index - 1)}
                            className="p-1 rounded hover:bg-lightprimary disabled:opacity-30"
                          >
                            <Icon icon="solar:alt-arrow-up-linear" height={15} />
                          </button>
                          <button
                            type="button"
                            title="Descendre"
                            disabled={index === coursOrdonnes.length - 1}
                            onClick={() => deplacerCours(index, index + 1)}
                            className="p-1 rounded hover:bg-lightprimary disabled:opacity-30"
                          >
                            <Icon
                              icon="solar:alt-arrow-down-linear"
                              height={15}
                            />
                          </button>
                          <button
                            type="button"
                            title="Retirer du parcours"
                            onClick={() => retirerCours(c.id)}
                            className="p-1 rounded text-error hover:bg-lighterror"
                          >
                            <Icon
                              icon="solar:trash-bin-minimalistic-linear"
                              height={15}
                            />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Synthèse temps réel */}
            <div className="rounded-md bg-lightprimary/40 dark:bg-white/5 p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block">
                  Volume horaire cumulé
                </span>
                <span className="font-semibold">
                  {resume.heures} heure{resume.heures > 1 ? 's' : ''} (
                  {coursOrdonnes.length} cours)
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">
                  Compétences développées
                </span>
                <span className="font-semibold">
                  {resume.competences.length > 0
                    ? resume.competences.join(', ')
                    : 'Aucune'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">
                  Prérequis recensés
                </span>
                <span className="font-semibold">
                  {resume.prerequis.length > 0
                    ? resume.prerequis.join(', ')
                    : 'Aucun prérequis'}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onFermer}>
              Annuler
            </Button>
            <Button type="submit" disabled={enregistrement}>
              {enregistrement
                ? 'Enregistrement…'
                : estEdition
                  ? 'Enregistrer les modifications'
                  : 'Créer le parcours'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ParcoursFormModal;

