import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'src/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'src/components/ui/tabs';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Progress } from 'src/components/ui/progress';
import educationAPI from 'src/api/education/education-data';
import type { Parcours, ParcoursAnalyse } from 'src/types/apps/education';

type Props = {
  parcoursId: string | null;
  ongletInitial?: 'feuille' | 'analyse' | 'inscrits';
  estAdmin: boolean;
  onFermer: () => void;
  onModifier?: (parcours: Parcours) => void;
  onParcoursMisAJour: () => Promise<void> | void;
};

const ParcoursDetailPanel = ({
  parcoursId,
  ongletInitial = 'feuille',
  estAdmin,
  onFermer,
  onModifier,
  onParcoursMisAJour,
}: Props) => {
  const [detail, setDetail] = useState<Parcours | null>(null);
  const [analyse, setAnalyse] = useState<ParcoursAnalyse | null>(null);
  const [onglet, setOnglet] = useState<string>(ongletInitial);
  const [chargement, setChargement] = useState(false);
  const [actionEnCours, setActionEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [messageSucces, setMessageSucces] = useState('');

  const chargerTout = async (id: string) => {
    setChargement(true);
    setErreur('');
    try {
      const [d, a] = await Promise.all([
        educationAPI.parcoursDetail(id),
        educationAPI.analyserParcours(id),
      ]);
      setDetail(d);
      setAnalyse(a);
    } catch (e) {
      setErreur(
        e instanceof Error
          ? e.message
          : 'Impossible de charger les détails du parcours.',
      );
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    setOnglet(ongletInitial);
    setMessageSucces('');
    if (parcoursId) {
      void chargerTout(parcoursId);
    } else {
      setDetail(null);
      setAnalyse(null);
    }
  }, [parcoursId, ongletInitial]);

  const appliquerOrdreSuggere = async () => {
    if (!detail || !analyse || !analyse.ameliorationOrdre) return;
    setActionEnCours(true);
    setErreur('');
    setMessageSucces('');
    try {
      await educationAPI.reordonnerCoursParcours(
        detail.id,
        analyse.ordreSuggere,
      );
      await chargerTout(detail.id);
      await onParcoursMisAJour();
      setMessageSucces(
        'Ordre topologique appliqué avec succès et synchronisé dans Fuseki + OWL.',
      );
    } catch (e) {
      setErreur(
        e instanceof Error
          ? e.message
          : 'Échec du réordonnancement du parcours.',
      );
    } finally {
      setActionEnCours(false);
    }
  };

  const ajouterCoursSuggereEnTete = async (coursId: string) => {
    if (!detail) return;
    setActionEnCours(true);
    setErreur('');
    setMessageSucces('');
    try {
      await educationAPI.ajouterCoursParcours(detail.id, coursId, 1);
      await chargerTout(detail.id);
      await onParcoursMisAJour();
      setMessageSucces(
        'Cours prérequis inséré en première étape du parcours.',
      );
    } catch (e) {
      setErreur(
        e instanceof Error ? e.message : "Impossible d'ajouter ce cours.",
      );
    } finally {
      setActionEnCours(false);
    }
  };

  const styleAlerte = (severite: 'erreur' | 'avertissement' | 'info') => {
    if (severite === 'erreur') {
      return {
        bloc: 'bg-lighterror text-error border-error/30',
        icone: 'solar:close-circle-linear',
      };
    }
    if (severite === 'avertissement') {
      return {
        bloc: 'bg-lightwarning text-warning border-warning/30',
        icone: 'solar:danger-triangle-linear',
      };
    }
    return {
      bloc: 'bg-lightinfo text-info border-info/30',
      icone: 'solar:info-circle-linear',
    };
  };

  return (
    <Dialog open={Boolean(parcoursId)} onOpenChange={(o) => !o && onFermer()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="text-xl">
                {detail ? detail.nom : 'Chargement du parcours…'}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {detail ? (
                  <>
                    Individu OWL : <code>edu:{detail.id}</code> · Classe :{' '}
                    <code>edu:{detail.niveauClasse}</code>
                  </>
                ) : (
                  'Interrogation de Fuseki en cours…'
                )}
              </DialogDescription>
            </div>
            {detail && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    detail.niveau === 'Avance' ? 'lightInfo' : 'lightPrimary'
                  }
                >
                  {detail.niveau === 'Avance'
                    ? 'Parcours Avancé'
                    : 'Parcours Débutant'}
                </Badge>
                <Badge
                  variant={
                    detail.statut === 'publie' ? 'lightSuccess' : 'lightWarning'
                  }
                >
                  {detail.statut === 'publie' ? 'Publié' : 'Brouillon'}
                </Badge>
                {estAdmin && onModifier && (
                  <Button
                    type="button"
                    size="sm"
                    variant="lightprimary"
                    onClick={() => onModifier(detail)}
                  >
                    <Icon icon="solar:pen-linear" height={15} />
                    Modifier
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        {erreur && (
          <div className="rounded-md bg-lighterror px-4 py-3 text-sm text-error">
            {erreur}
          </div>
        )}
        {messageSucces && (
          <div className="rounded-md bg-lightsuccess px-4 py-3 text-sm text-success flex items-center gap-2">
            <Icon icon="solar:check-circle-linear" height={18} />
            <span>{messageSucces}</span>
          </div>
        )}

        {chargement && !detail ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Chargement des données sémantiques…
          </p>
        ) : detail ? (
          <div className="space-y-5 mt-2">
            {/* Bandeau résumé */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-ld p-3">
                <p className="text-xs text-muted-foreground">Étapes (Cours)</p>
                <p className="text-lg font-bold">{detail.nombreCours}</p>
              </div>
              <div className="rounded-lg border border-ld p-3">
                <p className="text-xs text-muted-foreground">Durée totale</p>
                <p className="text-lg font-bold">{detail.dureeTotale}</p>
              </div>
              <div className="rounded-lg border border-ld p-3">
                <p className="text-xs text-muted-foreground">
                  Compétences visées
                </p>
                <p className="text-lg font-bold">{detail.competences.length}</p>
              </div>
              <div className="rounded-lg border border-ld p-3">
                <p className="text-xs text-muted-foreground">
                  Étudiants inscrits
                </p>
                <p className="text-lg font-bold">{detail.nombreInscrits}</p>
              </div>
            </div>

            {(detail.description || detail.objectif) && (
              <div className="rounded-lg bg-lightprimary/30 dark:bg-white/5 p-4 space-y-2 text-sm">
                {detail.description && <p>{detail.description}</p>}
                {detail.objectif && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      Objectif visé :{' '}
                    </span>
                    {detail.objectif}
                  </p>
                )}
              </div>
            )}

            <Tabs value={onglet} onValueChange={setOnglet}>
              <TabsList className="w-full justify-start flex-wrap h-auto">
                <TabsTrigger value="feuille">
                  Feuille de route ({detail.nombreCours})
                </TabsTrigger>
                <TabsTrigger value="analyse">
                  Analyse pédagogique
                  {analyse && !analyse.valide && (
                    <span className="ml-1.5 inline-flex h-2 w-2 rounded-full bg-warning" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="inscrits">
                  Étudiants inscrits ({detail.inscrits?.length ?? detail.nombreInscrits})
                </TabsTrigger>
              </TabsList>

              {/* Onglet 1 : Feuille de route ordonnée */}
              <TabsContent value="feuille" className="space-y-4 pt-3">
                {detail.etapes.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Ce parcours ne contient encore aucun cours.
                  </p>
                ) : (
                  <ol className="relative border-s-2 border-primary/30 ms-3 space-y-4">
                    {detail.etapes.map((etape) => (
                      <li key={etape.id} className="ms-6">
                        <span className="absolute -start-3.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white text-xs font-bold ring-4 ring-white dark:ring-dark">
                          {etape.position}
                        </span>
                        <div className="rounded-lg border border-ld p-4 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h5 className="font-semibold text-sm">
                                {etape.nom}
                              </h5>
                              <p className="text-xs text-muted-foreground">
                                {etape.type} · {etape.duree}
                                {etape.formateurs.length > 0
                                  ? ` · Animé par ${etape.formateurs.join(', ')}`
                                  : ''}
                              </p>
                            </div>
                            <Badge variant="gray">edu:{etape.id}</Badge>
                          </div>

                          {etape.description && (
                            <p className="text-xs text-muted-foreground">
                              {etape.description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2 pt-1">
                            {etape.competences.map((comp) => (
                              <Badge key={comp} variant="lightSuccess">
                                Compétence : {comp}
                              </Badge>
                            ))}
                            {etape.prerequis.map((pre) => (
                              <Badge key={pre} variant="lightWarning">
                                Prérequis : {pre}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                {detail.certificationsLiees &&
                  detail.certificationsLiees.length > 0 && (
                    <div className="rounded-lg border border-ld p-4">
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Certifications associées aux compétences du parcours
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {detail.certificationsLiees.map((cert) => (
                          <Badge key={cert.id} variant="lightInfo">
                            <Icon
                              icon="solar:medal-ribbon-star-linear"
                              height={14}
                              className="mr-1"
                            />
                            {cert.nom ?? cert.id}
                            {cert.organisme ? ` (${cert.organisme})` : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
              </TabsContent>

              {/* Onglet 2 : Analyse de cohérence pédagogique */}
              <TabsContent value="analyse" className="space-y-4 pt-3">
                {!analyse ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Analyse indisponible.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-ld p-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ${
                            analyse.scoreCoherence >= 80
                              ? 'bg-lightsuccess text-success'
                              : analyse.scoreCoherence >= 50
                                ? 'bg-lightwarning text-warning'
                                : 'bg-lighterror text-error'
                          }`}
                        >
                          {analyse.scoreCoherence}%
                        </span>
                        <div>
                          <h5 className="font-semibold text-sm">
                            {analyse.valide
                              ? 'Séquence pédagogiquement cohérente'
                              : 'Points d’attention détectés dans la séquence'}
                          </h5>
                          <p className="text-xs text-muted-foreground">
                            Vérification automatique via{' '}
                            <code>aPourPrerequis</code> →{' '}
                            <code>necessiteCompetence</code> ↔{' '}
                            <code>developpeCompetence</code>
                          </p>
                        </div>
                      </div>

                      {analyse.ameliorationOrdre && estAdmin && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={appliquerOrdreSuggere}
                          disabled={actionEnCours}
                        >
                          <Icon icon="solar:magic-stick-3-linear" height={16} />
                          Appliquer l&apos;ordre suggéré
                        </Button>
                      )}
                    </div>

                    {analyse.ameliorationOrdre && (
                      <div className="rounded-lg border border-primary/40 bg-lightprimary/30 p-4 space-y-2">
                        <p className="text-xs font-semibold text-primary">
                          Proposition de réordonnancement topologique (algorithme
                          de Kahn) :
                        </p>
                        <div className="text-xs space-y-1">
                          <p>
                            <span className="text-muted-foreground">
                              Ordre actuel :{' '}
                            </span>
                            {(
                              analyse.ordreActuelNoms ?? analyse.ordreActuel
                            ).join(' → ')}
                          </p>
                          <p className="font-semibold">
                            <span className="text-muted-foreground font-normal">
                              Ordre recommandé :{' '}
                            </span>
                            {analyse.ordreSuggereNoms.join(' → ')}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Alertes */}
                    {analyse.alertes.length === 0 ? (
                      <div className="rounded-md bg-lightsuccess/60 p-4 text-xs text-success flex items-center gap-2">
                        <Icon icon="solar:check-circle-linear" height={18} />
                        <span>
                          Aucune rupture de prérequis ni incohérence de niveau
                          détectée.
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {analyse.alertes.map((al, i) => {
                          const st = styleAlerte(al.severite);
                          return (
                            <div
                              key={`${al.type}-${i}`}
                              className={`rounded-md border p-3 text-xs flex items-start gap-2.5 ${st.bloc}`}
                            >
                              <Icon
                                icon={st.icone}
                                height={18}
                                className="shrink-0 mt-0.5"
                              />
                              <span>{al.message}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Suggestions de cours complémentaires */}
                    {analyse.suggestionsCours.length > 0 && (
                      <div className="rounded-lg border border-ld p-4 space-y-2.5">
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Cours existants pouvant combler les prérequis d&apos;entrée
                        </h5>
                        {analyse.suggestionsCours.map((sug) => (
                          <div
                            key={sug.coursId}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background border border-ld p-2.5 text-xs"
                          >
                            <div>
                              <span className="font-semibold">
                                {sug.coursNom}
                              </span>{' '}
                              <span className="text-muted-foreground">
                                ({sug.duree}) — {sug.raison}
                              </span>
                            </div>
                            {estAdmin && (
                              <Button
                                type="button"
                                size="sm"
                                variant="lightprimary"
                                className="h-7 text-xs"
                                disabled={actionEnCours}
                                onClick={() =>
                                  ajouterCoursSuggereEnTete(sug.coursId)
                                }
                              >
                                + Insérer en étape 1
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Prérequis d'entrée du parcours */}
                    <div className="rounded-lg border border-ld p-4 space-y-2">
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Prérequis d&apos;entrée du parcours (à posséder au départ)
                      </h5>
                      {analyse.prerequisEntree.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Aucun prérequis externe requis : le parcours est
                          accessible directement.
                        </p>
                      ) : (
                        <ul className="space-y-1 text-xs">
                          {analyse.prerequisEntree.map((pe) => (
                            <li key={pe.id} className="flex items-center gap-2">
                              <Icon
                                icon="solar:check-read-linear"
                                height={15}
                                className="text-primary"
                              />
                              <span>
                                <strong>{pe.description}</strong>
                                {pe.competence
                                  ? ` (compétence : ${pe.competence})`
                                  : ''}{' '}
                                — requis pour <em>{pe.pourCours}</em>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Onglet 3 : Étudiants inscrits */}
              <TabsContent value="inscrits" className="pt-3">
                {!detail.inscrits || detail.inscrits.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Aucun étudiant n&apos;est encore inscrit à ce parcours.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-ld">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ld bg-muted/40 text-left text-xs text-muted-foreground">
                          <th className="p-3 font-medium">Étudiant</th>
                          <th className="p-3 font-medium">Inscrit le</th>
                          <th className="p-3 font-medium">Cours validés</th>
                          <th className="p-3 font-medium w-48">Progression</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.inscrits.map((ins) => (
                          <tr
                            key={ins.id}
                            className="border-b border-ld last:border-0"
                          >
                            <td className="p-3">
                              <p className="font-medium text-xs">{ins.nom}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {ins.email}
                              </p>
                            </td>
                            <td className="p-3 text-xs text-muted-foreground">
                              {new Date(ins.creeLe).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="p-3 text-xs">
                              {ins.coursTermines} / {ins.nombreCours}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={ins.progression}
                                  variant={
                                    ins.progression === 100
                                      ? 'success'
                                      : 'primary'
                                  }
                                  className="h-2"
                                />
                                <span className="text-xs font-semibold w-10 text-right">
                                  {ins.progression}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default ParcoursDetailPanel;

