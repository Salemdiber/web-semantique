import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import CardBox from 'src/components/shared/CardBox';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Badge } from 'src/components/ui/badge';
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
  CoursEntree,
  CoursGestion,
  Formateur,
} from 'src/types/apps/education';
import { useAuth } from 'src/context/auth-context';
import CoursFormModal from './CoursFormModal';

const GestionCours = () => {
  const { estAdmin } = useAuth();

  const [cours, setCours] = useState<CoursGestion[]>([]);
  const [formateurs, setFormateurs] = useState<Formateur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [recherche, setRecherche] = useState('');

  const [modalOuvert, setModalOuvert] = useState(false);
  const [coursEnEdition, setCoursEnEdition] = useState<CoursGestion | null>(
    null,
  );
  const [coursASupprimer, setCoursASupprimer] =
    useState<CoursGestion | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const chargerDonnees = useCallback(async () => {
    setChargement(true);
    setErreur('');
    try {
      const [liste, listeFormateurs] = await Promise.all([
        educationAPI.coursGestion(),
        educationAPI.formateurs(),
      ]);
      setCours(liste);
      setFormateurs(listeFormateurs);
    } catch (e) {
      setErreur(
        e instanceof Error
          ? e.message
          : 'Impossible de charger les cours depuis Fuseki.',
      );
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void chargerDonnees();
  }, [chargerDonnees]);

  const coursFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return cours;
    return cours.filter((c) =>
      [c.nom, c.id, c.categorie ?? '', c.niveau ?? '', c.description ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [cours, recherche]);

  const enregistrer = async (donnees: CoursEntree, id?: string) => {
    setErreur('');
    setMessage('');
    if (id) {
      await educationAPI.modifierCours(id, donnees);
      setMessage(`Le cours « ${donnees.nom} » a été mis à jour.`);
    } else {
      await educationAPI.creerCours(donnees);
      setMessage(`Le cours « ${donnees.nom} » a été créé.`);
    }
    await chargerDonnees();
  };

  const confirmerSuppression = async () => {
    if (!coursASupprimer) return;
    setSuppressionEnCours(true);
    setErreur('');
    setMessage('');
    try {
      await educationAPI.supprimerCours(coursASupprimer.id);
      setMessage(`Le cours « ${coursASupprimer.nom} » a été supprimé.`);
      setCoursASupprimer(null);
      await chargerDonnees();
    } catch (e) {
      setErreur(
        e instanceof Error
          ? e.message
          : 'Erreur lors de la suppression du cours.',
      );
    } finally {
      setSuppressionEnCours(false);
    }
  };

  return (
    <CardBox className="border-none shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Gestion des cours</h3>
          <p className="text-sm text-muted-foreground">
            {cours.length} cours issu{cours.length > 1 ? 's' : ''} de
            l&apos;ontologie <code>edu:Cours</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un cours…"
            className="h-9 w-56"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void chargerDonnees()}
            disabled={chargement}
          >
            <Icon icon="solar:refresh-linear" height={16} />
            Actualiser
          </Button>
          {estAdmin && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setCoursEnEdition(null);
                setModalOuvert(true);
              }}
            >
              <Icon icon="solar:add-circle-linear" height={16} />
              Nouveau cours
            </Button>
          )}
        </div>
      </div>

      {erreur && (
        <div
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-md bg-lighterror px-4 py-3 text-sm text-error"
        >
          <Icon icon="solar:danger-triangle-linear" height={18} />
          <span>{erreur}</span>
        </div>
      )}

      {message && (
        <div
          role="status"
          className="mt-4 flex items-center gap-2 rounded-md bg-lightsuccess px-4 py-3 text-sm text-success"
        >
          <Icon icon="solar:check-circle-linear" height={18} />
          <span>{message}</span>
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-ld text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-3">Cours</th>
              <th className="px-3 py-3">Catégorie</th>
              <th className="px-3 py-3">Niveau</th>
              <th className="px-3 py-3">Durée</th>
              <th className="px-3 py-3">Formateur</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {chargement ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  Chargement des cours…
                </td>
              </tr>
            ) : coursFiltres.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  Aucun cours ne correspond à la recherche.
                </td>
              </tr>
            ) : (
              coursFiltres.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-ld/70 last:border-0 hover:bg-lightprimary/30"
                >
                  <td className="px-3 py-3">
                    <p className="font-medium text-dark">{c.nom}</p>
                    <p className="text-xs text-muted-foreground">{c.id}</p>
                    {c.description && (
                      <p className="mt-1 max-w-md text-xs text-muted-foreground">
                        {c.description}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3">{c.categorie ?? '—'}</td>
                  <td className="px-3 py-3">
                    <Badge variant="lightPrimary">
                      {c.niveau ?? 'Non précisé'}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">{c.duree}</td>
                  <td className="px-3 py-3">
                    {c.formateurs.length > 0
                      ? c.formateurs.join(', ')
                      : '—'}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {estAdmin ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghostprimary"
                          size="icon"
                          title="Modifier"
                          onClick={() => {
                            setCoursEnEdition(c);
                            setModalOuvert(true);
                          }}
                        >
                          <Icon icon="solar:pen-linear" height={18} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghosterror"
                          size="icon"
                          title="Supprimer"
                          onClick={() => setCoursASupprimer(c)}
                        >
                          <Icon icon="solar:trash-bin-trash-linear" height={18} />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Lecture seule
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CoursFormModal
        ouvert={modalOuvert}
        onFermer={() => setModalOuvert(false)}
        coursInitial={coursEnEdition}
        formateurs={formateurs}
        onEnregistrer={enregistrer}
      />

      <Dialog
        open={Boolean(coursASupprimer)}
        onOpenChange={(open) => !open && setCoursASupprimer(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer ce cours ?</DialogTitle>
            <DialogDescription>
              Le cours « {coursASupprimer?.nom} » sera retiré de l&apos;ontologie
              et de Fuseki. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCoursASupprimer(null)}
              disabled={suppressionEnCours}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmerSuppression()}
              disabled={suppressionEnCours}
            >
              {suppressionEnCours && (
                <Icon
                  icon="solar:refresh-linear"
                  height={18}
                  className="animate-spin"
                />
              )}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CardBox>
  );
};

export default GestionCours;
