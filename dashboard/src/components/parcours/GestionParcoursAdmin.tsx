import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
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
import educationAPI, {
  type ParcoursEntree,
} from 'src/api/education/education-data';
import type {
  Cours,
  Parcours,
  ParcoursStatistiques,
} from 'src/types/apps/education';
import { useAuth } from 'src/context/auth-context';
import ParcoursStatsWidgets from './ParcoursStatsWidgets';
import ParcoursFormModal from './ParcoursFormModal';
import ParcoursDetailPanel from './ParcoursDetailPanel';

const columnHelper = createColumnHelper<Parcours>();

const GestionParcoursAdmin = () => {
  const { estAdmin } = useAuth();
  const { id: paramId } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [parcours, setParcours] = useState<Parcours[]>([]);
  const [catalogueCours, setCatalogueCours] = useState<Cours[]>([]);
  const [statistiques, setStatistiques] =
    useState<ParcoursStatistiques | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  // Filtres
  const [recherche, setRecherche] = useState('');
  const [filtreNiveau, setFiltreNiveau] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreCompetence, setFiltreCompetence] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);

  // Modales & panneaux
  const [modalFormOuvert, setModalFormOuvert] = useState(false);
  const [parcoursEnEdition, setParcoursEnEdition] = useState<Parcours | null>(
    null,
  );
  const [detailParcoursId, setDetailParcoursId] = useState<string | null>(null);
  const [detailOnglet, setDetailOnglet] = useState<
    'feuille' | 'analyse' | 'inscrits'
  >('feuille');
  const [parcoursASupprimer, setParcoursASupprimer] =
    useState<Parcours | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const chargerDonnees = useCallback(async () => {
    setChargement(true);
    setErreur('');
    try {
      const [liste, cours, stats] = await Promise.all([
        educationAPI.parcours(),
        educationAPI.cours(),
        educationAPI.statistiquesParcours(),
      ]);
      setParcours(liste);
      setCatalogueCours(cours);
      setStatistiques(stats);
    } catch (e) {
      setErreur(
        e instanceof Error
          ? e.message
          : 'Impossible de charger les parcours depuis Fuseki.',
      );
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void chargerDonnees();
  }, [chargerDonnees]);

  // Prise en charge des liens profonds (?id=..., ?action=new, ?edit=...)
  useEffect(() => {
    if (chargement) return;
    const action = searchParams.get('action');
    const editId = searchParams.get('edit');
    const viewId = paramId || searchParams.get('id');

    if (action === 'new' && estAdmin) {
      setParcoursEnEdition(null);
      setModalFormOuvert(true);
      setSearchParams({}, { replace: true });
    } else if (editId && estAdmin) {
      const cible = parcours.find((p) => p.id === editId);
      if (cible) {
        setParcoursEnEdition(cible);
        setModalFormOuvert(true);
      }
      setSearchParams({}, { replace: true });
    } else if (viewId) {
      if (parcours.some((p) => p.id === viewId)) {
        setDetailOnglet('feuille');
        setDetailParcoursId(viewId);
      }
      if (searchParams.get('id')) {
        setSearchParams({}, { replace: true });
      }
    }
  }, [chargement, estAdmin, paramId, parcours, searchParams, setSearchParams]);

  const toutesCompetences = useMemo(() => {
    const s = new Set<string>();
    parcours.forEach((p) => p.competences.forEach((c) => s.add(c)));
    return Array.from(s).sort();
  }, [parcours]);

  const parcoursFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return parcours.filter((p) => {
      if (filtreNiveau && p.niveau !== filtreNiveau) return false;
      if (filtreStatut && p.statut !== filtreStatut) return false;
      if (filtreCompetence && !p.competences.includes(filtreCompetence))
        return false;
      if (!q) return true;
      const texte = [
        p.nom,
        p.id,
        p.description ?? '',
        p.objectif ?? '',
        ...p.cours,
        ...p.competences,
      ]
        .join(' ')
        .toLowerCase();
      return texte.includes(q);
    });
  }, [
    parcours,
    recherche,
    filtreNiveau,
    filtreStatut,
    filtreCompetence,
  ]);

  const enregistrerParcours = async (
    donnees: ParcoursEntree,
    id?: string,
  ) => {
    setMessage('');
    if (id) {
      await educationAPI.modifierParcours(id, donnees);
      setMessage(`Le parcours « ${donnees.nom} » a été mis à jour.`);
    } else {
      await educationAPI.creerParcours(donnees);
      setMessage(`Le parcours « ${donnees.nom} » a été créé dans Fuseki et OWL.`);
    }
    await chargerDonnees();
  };

  const dupliquer = async (p: Parcours) => {
    setErreur('');
    setMessage('');
    try {
      const copie = await educationAPI.dupliquerParcours(p.id);
      setMessage(
        `Copie créée en brouillon : « ${copie.nom} » (${copie.nombreCours} cours).`,
      );
      await chargerDonnees();
    } catch (e) {
      setErreur(
        e instanceof Error ? e.message : 'Échec de la duplication du parcours.',
      );
    }
  };

  const confirmerSuppression = async () => {
    if (!parcoursASupprimer) return;
    setSuppressionEnCours(true);
    setErreur('');
    setMessage('');
    try {
      const res = await educationAPI.supprimerParcours(parcoursASupprimer.id);
      setMessage(
        `Parcours « ${parcoursASupprimer.nom} » supprimé (${res.inscriptionsSupprimees} inscription(s) nettoyée(s)).`,
      );
      setParcoursASupprimer(null);
      await chargerDonnees();
    } catch (e) {
      setErreur(
        e instanceof Error ? e.message : 'Échec de la suppression du parcours.',
      );
    } finally {
      setSuppressionEnCours(false);
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('nom', {
        header: 'Parcours',
        cell: (info) => {
          const p = info.row.original;
          return (
            <div className="max-w-xs">
              <button
                type="button"
                onClick={() => {
                  setDetailOnglet('feuille');
                  setDetailParcoursId(p.id);
                }}
                className="font-semibold text-left hover:text-primary transition-colors"
              >
                {p.nom}
              </button>
              {p.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {p.description}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground/80 font-mono">
                edu:{p.id}
              </p>
            </div>
          );
        },
      }),
      columnHelper.accessor('niveau', {
        header: 'Niveau OWL',
        cell: (info) => {
          const niv = info.getValue();
          return (
            <Badge variant={niv === 'Avance' ? 'lightInfo' : 'lightPrimary'}>
              {niv === 'Avance' ? 'Avancé' : 'Débutant'}
            </Badge>
          );
        },
      }),
      columnHelper.accessor('statut', {
        header: 'Statut',
        cell: (info) => {
          const st = info.getValue();
          return (
            <Badge variant={st === 'publie' ? 'lightSuccess' : 'lightWarning'}>
              {st === 'publie' ? 'Publié' : 'Brouillon'}
            </Badge>
          );
        },
      }),
      columnHelper.accessor('nombreCours', {
        header: 'Séquence de cours',
        cell: (info) => {
          const p = info.row.original;
          return (
            <div>
              <span className="text-xs font-semibold">
                {p.nombreCours} cours
              </span>
              {p.cours.length > 0 && (
                <p className="text-[11px] text-muted-foreground max-w-[230px] truncate">
                  {p.cours.join(' → ')}
                </p>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('dureeHeures', {
        header: 'Durée',
        cell: (info) => (
          <span className="text-xs font-medium whitespace-nowrap">
            {info.row.original.dureeTotale}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.competences.length, {
        id: 'competences',
        header: 'Compétences visées',
        cell: (info) => {
          const comps = info.row.original.competences;
          if (comps.length === 0) {
            return (
              <span className="text-xs text-muted-foreground">Aucune</span>
            );
          }
          return (
            <div className="flex flex-wrap gap-1 max-w-[210px]">
              {comps.slice(0, 2).map((c) => (
                <Badge key={c} variant="lightSecondary">
                  {c}
                </Badge>
              ))}
              {comps.length > 2 && (
                <Badge variant="gray">+{comps.length - 2}</Badge>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('nombreInscrits', {
        header: 'Inscrits',
        cell: (info) => (
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            <Icon
              icon="solar:users-group-rounded-linear"
              height={15}
              className="text-primary"
            />
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => {
          const p = info.row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                title="Voir la feuille de route"
                onClick={() => {
                  setDetailOnglet('feuille');
                  setDetailParcoursId(p.id);
                }}
                className="p-1.5 rounded-md hover:bg-lightprimary text-primary transition-colors"
              >
                <Icon icon="solar:eye-linear" height={17} />
              </button>
              <button
                type="button"
                title="Analyse de cohérence pédagogique"
                onClick={() => {
                  setDetailOnglet('analyse');
                  setDetailParcoursId(p.id);
                }}
                className="p-1.5 rounded-md hover:bg-lightinfo text-info transition-colors"
              >
                <Icon icon="solar:magic-stick-3-linear" height={17} />
              </button>
              {estAdmin && (
                <>
                  <button
                    type="button"
                    title="Modifier le parcours"
                    onClick={() => {
                      setParcoursEnEdition(p);
                      setModalFormOuvert(true);
                    }}
                    className="p-1.5 rounded-md hover:bg-lightwarning text-warning transition-colors"
                  >
                    <Icon icon="solar:pen-linear" height={17} />
                  </button>
                  <button
                    type="button"
                    title="Dupliquer en brouillon"
                    onClick={() => void dupliquer(p)}
                    className="p-1.5 rounded-md hover:bg-lightsecondary text-secondary transition-colors"
                  >
                    <Icon icon="solar:copy-linear" height={17} />
                  </button>
                  <button
                    type="button"
                    title="Supprimer le parcours"
                    onClick={() => setParcoursASupprimer(p)}
                    className="p-1.5 rounded-md hover:bg-lighterror text-error transition-colors"
                  >
                    <Icon
                      icon="solar:trash-bin-minimalistic-linear"
                      height={17}
                    />
                  </button>
                </>
              )}
            </div>
          );
        },
      }),
    ],
    [estAdmin],
  );

  const table = useReactTable({
    data: parcoursFiltres,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-6">
      <ParcoursStatsWidgets
        statistiques={statistiques}
        chargement={chargement}
      />

      <CardBox className="p-6">
        {/* Barre d'en-tête */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-semibold">
              Référentiel des parcours d&apos;apprentissage
            </h3>
            <p className="text-xs text-muted-foreground">
              {estAdmin
                ? 'Administration complète des parcours OWL (synchronisation temps réel Fuseki + fichier Protégé .owl).'
                : 'Mode consultation formateur : explorez les séquences de cours et leur cohérence pédagogique.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
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
                  setParcoursEnEdition(null);
                  setModalFormOuvert(true);
                }}
              >
                <Icon icon="solar:add-circle-linear" height={17} />
                Nouveau parcours
              </Button>
            )}
          </div>
        </div>

        {erreur && (
          <div
            role="alert"
            className="mb-4 rounded-md bg-lighterror px-4 py-3 text-sm text-error flex items-center justify-between"
          >
            <span>{erreur}</span>
            <button
              type="button"
              onClick={() => setErreur('')}
              className="text-xs underline"
            >
              Fermer
            </button>
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-md bg-lightsuccess px-4 py-3 text-sm text-success flex items-center justify-between">
            <span>{message}</span>
            <button
              type="button"
              onClick={() => setMessage('')}
              className="text-xs underline"
            >
              Fermer
            </button>
          </div>
        )}

        {/* Barre de filtres */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 mb-5">
          <div className="lg:col-span-5 relative">
            <Input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher par nom, cours, compétence, objectif…"
            />
          </div>
          <div className="lg:col-span-2">
            <select
              aria-label="Filtrer par niveau"
              value={filtreNiveau}
              onChange={(e) => setFiltreNiveau(e.target.value)}
              className="flex h-10 w-full rounded-md border border-ld bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Tous les niveaux</option>
              <option value="Debutant">Débutant</option>
              <option value="Avance">Avancé</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <select
              aria-label="Filtrer par statut"
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value)}
              className="flex h-10 w-full rounded-md border border-ld bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Tous les statuts</option>
              <option value="publie">Publié</option>
              <option value="brouillon">Brouillon</option>
            </select>
          </div>
          <div className="lg:col-span-3">
            <select
              aria-label="Filtrer par compétence"
              value={filtreCompetence}
              onChange={(e) => setFiltreCompetence(e.target.value)}
              className="flex h-10 w-full rounded-md border border-ld bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Toutes les compétences</option>
              {toutesCompetences.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table TanStack */}
        {chargement ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Chargement des parcours depuis Fuseki…
          </p>
        ) : parcoursFiltres.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-ld rounded-lg">
            <Icon
              icon="solar:routing-2-linear"
              height={36}
              className="mx-auto text-muted-foreground mb-2"
            />
            <p className="text-sm font-medium">
              Aucun parcours ne correspond aux critères sélectionnés.
            </p>
            {(recherche || filtreNiveau || filtreStatut || filtreCompetence) && (
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => {
                  setRecherche('');
                  setFiltreNiveau('');
                  setFiltreStatut('');
                  setFiltreCompetence('');
                }}
              >
                Réinitialiser les filtres
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-ld">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr
                    key={hg.id}
                    className="border-b border-ld bg-muted/40 text-left text-xs text-muted-foreground"
                  >
                    {hg.headers.map((header) => {
                      const triable = header.column.getCanSort();
                      const dir = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          className={`p-3.5 font-semibold ${
                            header.id === 'actions' ? 'text-right' : ''
                          } ${triable ? 'cursor-pointer select-none hover:text-foreground' : ''}`}
                          onClick={
                            triable
                              ? header.column.getToggleSortingHandler()
                              : undefined
                          }
                        >
                          <span className="inline-flex items-center gap-1">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            {dir === 'asc' && ' ▲'}
                            {dir === 'desc' && ' ▼'}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-ld last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="p-3.5 align-middle">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBox>

      {/* Modale Création / Édition */}
      <ParcoursFormModal
        ouvert={modalFormOuvert}
        onFermer={() => setModalFormOuvert(false)}
        parcoursInitial={parcoursEnEdition}
        catalogueCours={catalogueCours}
        onEnregistrer={enregistrerParcours}
      />

      {/* Panneau Détail & Analyse de cohérence */}
      <ParcoursDetailPanel
        parcoursId={detailParcoursId}
        ongletInitial={detailOnglet}
        estAdmin={estAdmin}
        onFermer={() => setDetailParcoursId(null)}
        onModifier={(p) => {
          setDetailParcoursId(null);
          setParcoursEnEdition(p);
          setModalFormOuvert(true);
        }}
        onParcoursMisAJour={chargerDonnees}
      />

      {/* Confirmation de suppression avec impact */}
      <Dialog
        open={Boolean(parcoursASupprimer)}
        onOpenChange={(o) => !o && setParcoursASupprimer(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer ce parcours ?</DialogTitle>
            <DialogDescription>
              Cette action supprimera définitivement l&apos;individu{' '}
              <code>edu:{parcoursASupprimer?.id}</code> de Fuseki et du fichier{' '}
              <code>education_formation_protege.owl</code>.
            </DialogDescription>
          </DialogHeader>

          {parcoursASupprimer && (
            <div className="rounded-lg bg-lighterror/50 border border-error/20 p-3.5 text-xs space-y-1.5">
              <p className="font-semibold text-error">
                Impact de la suppression de « {parcoursASupprimer.nom} » :
              </p>
              <ul className="list-disc pl-4 space-y-1 text-foreground">
                <li>
                  <strong>{parcoursASupprimer.nombreCours}</strong> lien(s){' '}
                  <code>contientCoursParcours</code> retiré(s) (les cours eux-mêmes
                  sont conservés dans l&apos;ontologie).
                </li>
                <li>
                  <strong>{parcoursASupprimer.nombreInscrits}</strong>{' '}
                  inscription(s) étudiante(s) active(s) seront désinscrites.
                </li>
              </ul>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setParcoursASupprimer(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="error"
              disabled={suppressionEnCours}
              onClick={() => void confirmerSuppression()}
            >
              {suppressionEnCours ? 'Suppression…' : 'Confirmer la suppression'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GestionParcoursAdmin;
