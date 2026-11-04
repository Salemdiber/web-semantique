import { useEffect, useState } from 'react';
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
import type {
  CoursEntree,
  CoursGestion,
  Formateur,
} from 'src/types/apps/education';

type Props = {
  ouvert: boolean;
  onFermer: () => void;
  coursInitial: CoursGestion | null;
  formateurs: Formateur[];
  onEnregistrer: (donnees: CoursEntree, id?: string) => Promise<void>;
};

const CoursFormModal = ({
  ouvert,
  onFermer,
  coursInitial,
  formateurs,
  onEnregistrer,
}: Props) => {
  const estEdition = Boolean(coursInitial);

  const [nom, setNom] = useState('');
  const [duree, setDuree] = useState('');
  const [categorie, setCategorie] = useState('');
  const [niveau, setNiveau] = useState('');
  const [formateur, setFormateur] = useState('');
  const [description, setDescription] = useState('');
  const [erreur, setErreur] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    if (!ouvert) return;
    setErreur('');
    setNom(coursInitial?.nom ?? '');
    setDuree(coursInitial?.duree ?? '');
    setCategorie(coursInitial?.categorie ?? '');
    setNiveau(coursInitial?.niveau ?? '');
    setFormateur(coursInitial?.formateurIds?.[0] ?? '');
    setDescription(coursInitial?.description ?? '');
  }, [ouvert, coursInitial]);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');

    if (nom.trim().length < 2) {
      setErreur('Le nom du cours doit comporter au moins 2 caractères.');
      return;
    }
    if (!duree.trim()) {
      setErreur('La durée du cours est obligatoire.');
      return;
    }

    setEnregistrement(true);
    try {
      await onEnregistrer(
        {
          nom: nom.trim(),
          duree: duree.trim(),
          description: description.trim() || null,
          niveau: niveau.trim() || null,
          categorie: categorie.trim() || null,
          formateur: formateur || null,
        },
        coursInitial?.id,
      );
      onFermer();
    } catch (err) {
      setErreur(
        err instanceof Error
          ? err.message
          : 'Erreur lors de la sauvegarde du cours.',
      );
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <Dialog open={ouvert} onOpenChange={(open) => !open && onFermer()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {estEdition
              ? `Modifier le cours « ${coursInitial?.nom} »`
              : 'Créer un cours'}
          </DialogTitle>
          <DialogDescription>
            Les données sont enregistrées comme individu OWL{' '}
            <code>edu:Cours</code> dans Fuseki.
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

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-7 space-y-1.5">
              <Label htmlFor="cours-nom">Nom du cours *</Label>
              <Input
                id="cours-nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex. Développement Web"
                required
              />
            </div>

            <div className="md:col-span-5 space-y-1.5">
              <Label htmlFor="cours-duree">Durée *</Label>
              <Input
                id="cours-duree"
                value={duree}
                onChange={(e) => setDuree(e.target.value)}
                placeholder="Ex. 30 heures"
                required
              />
            </div>

            <div className="md:col-span-6 space-y-1.5">
              <Label htmlFor="cours-categorie">Catégorie</Label>
              <Input
                id="cours-categorie"
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                placeholder="Ex. Développement Web"
              />
            </div>

            <div className="md:col-span-6 space-y-1.5">
              <Label htmlFor="cours-niveau">Niveau</Label>
              <Input
                id="cours-niveau"
                value={niveau}
                onChange={(e) => setNiveau(e.target.value)}
                placeholder="Ex. Intermédiaire"
              />
            </div>

            <div className="md:col-span-12 space-y-1.5">
              <Label htmlFor="cours-formateur">Formateur</Label>
              <select
                id="cours-formateur"
                value={formateur}
                onChange={(e) => setFormateur(e.target.value)}
                className="flex h-10 w-full rounded-md border border-ld bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Aucun formateur</option>
                {formateurs.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.prenom}
                    {f.domaine ? ` — ${f.domaine}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-12 space-y-1.5">
              <Label htmlFor="cours-description">Description</Label>
              <Textarea
                id="cours-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Présentation synthétique du cours pour le catalogue…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onFermer}
              disabled={enregistrement}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={enregistrement}>
              {enregistrement ? (
                <Icon
                  icon="solar:refresh-linear"
                  height={18}
                  className="animate-spin"
                />
              ) : (
                <Icon icon="solar:check-circle-linear" height={18} />
              )}
              {estEdition ? 'Enregistrer' : 'Créer le cours'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CoursFormModal;
