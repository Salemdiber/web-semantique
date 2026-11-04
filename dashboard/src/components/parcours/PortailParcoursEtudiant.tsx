import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Icon } from '@iconify/react';
import CardBox from 'src/components/shared/CardBox';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Badge } from 'src/components/ui/badge';
import { Progress } from 'src/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'src/components/ui/tabs';
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
  Parcours,
  ParcoursRecommandation,
  StatutCoursEtudiant,
} from 'src/types/apps/education';

function badgeStatutEtape(statut?: StatutCoursEtudiant) {
  if (statut === 'termine') {
    return {
      texte: 'Validé',
      variant: 'lightSuccess' as const,
      cercle: 'bg-success text-white',
      icone: 'solar:check-circle-bold',
    };
  }
  if (statut === 'en_cours') {
    return {
      texte: 'En cours',
      variant: 'lightPrimary' as const,
      cercle: 'bg-primary text-white',
      icone: 'solar:play-circle-bold',
    };
  }
  return {
    texte: 'À venir',
    variant: 'gray' as const,
    cercle: 'bg-muted text-muted-foreground',
    icone: 'solar:clock-circle-linear',
  };
}

const PortailParcoursEtudiant = () => {
  const { id: paramId } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [catalogue, setCatalogue] = useState<Parcours[]>([]);
  const [mesParcours, setMesParcours] = useState<Parcours[]>([]);
  const [recommandations, setRecommandations] = useState<
    ParcoursRecommandation[]
  >([]);
  const [onglet, setOnglet] = useState<string>('catalogue');
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  // Filtres catalogue
  const [recherche, setRecherche] = useState('');
  const [filtreNiveau, setFiltreNiveau] = useState('');
  const [filtreCompetence, setFiltreCompetence] = useState('');
  const [dureeMax, setDureeMax] = useState<string>('');

  // Feuille de route interactive (modale détail)
  const [parcoursSelectionne, setParcoursSelectionne] =
    useState<Parcours | null>(null);
  const [chargementDetail, setChargementDetail] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const chargerTout = useCallback(async () => {
    setChargement(true);
    setErreur('');
    try {
      const [cat, mes, recs] = await Promise.all([
        educationAPI.parcours(),
        educationAPI.mesParcours(),
        educationAPI.recommandationsParcours(),
      ]);
      setCatalogue(cat);
      setMesParcours(mes);
      setRecommandations(recs);
    } catch (e) {
      setErreur(
        e instanceof Error
          ? e.message
          : 'Impossible de charger les parcours d’apprentissage.',
      );
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void chargerTout();
  }, [chargerTout]);

  const ouvrirFeuilleDeRoute = useCallback(async (id: string) => {
    setChargementDetail(true);
    try {
      const d = await educationAPI.parcoursDetail(id);
      setParcoursSelectionne(d);
    } catch (e) {
      setErreur(
        e instanceof Error
          ? e.message
          : 'Impossible de charger la feuille de route de ce parcours.',
      );
    } finally {
      setChargementDetail(false);
    }
  }, []);

  // Ouverture automatique par lien profond (/parcours/:id ou ?id=...)
  useEffect(() => {
    if (chargement) return;
    const cible = paramId || searchParams.get('id');
    const tabParam = searchParams.get('tab');
    if (tabParam && ['catalogue', 'mes-parcours', 'recommandes'].includes(tabParam)) {
      setOnglet(tabParam);
    }
    if (cible) {
      void ouvrirFeuilleDeRoute(cible);
      if (searchParams.get('id')) {
        setSearchParams({}, { replace: true });
      }
    }
  }, [chargement, ouvrirFeuilleDeRoute, paramId, searchParams, setSearchParams]);

  const toutesCompetences = useMemo(() => {
    const s = new Set<string>();
    catalogue.forEach((p) => p.competences.forEach((c) => s.add(c)));
    return Array.from(s).sort();
  }, [catalogue]);

  const catalogueFiltre = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const maxH = dureeMax ? Number(dureeMax) : null;
    return catalogue.filter((p) => {
      if (filtreNiveau && p.niveau !== filtreNiveau) return false;
      if (filtreCompetence && !p.competences.includes(filtreCompetence))
        return false;
      if (maxH !== null && !Number.isNaN(maxH) && p.dureeHeures > maxH)
        return false;
      if (!q) return true;
      const texte = [
        p.nom,
        p.description ?? '',
        p.objectif ?? '',
        ...p.cours,
        ...p.competences,
      ]
        .join(' ')
        .toLowerCase();
      return texte.includes(q);
    });
  }, [catalogue, recherche, filtreNiveau, filtreCompetence, dureeMax]);

  const inscrire = async (p: Parcours) => {
    setActionId(p.id);
    setErreur('');
    setMessage('');
    try {
      const detailMaj = await educationAPI.inscrireParcours(p.id);
      setMessage(
        `Inscription confirmée à « ${p.nom} ». Votre premier cours à suivre a été synchronisé dans votre dossier sémantique.`,
      );
      await chargerTout();
      setParcoursSelectionne(detailMaj);
    } catch (e) {
      setErreur(
        e instanceof Error ? e.message : "Échec de l'inscription au parcours.",
      );
    } finally {
      setActionId(null);
    }
  };

  const desinscrire = async (p: Parcours) => {
    setActionId(p.id);
    setErreur('');
    setMessage('');
    try {
      await educationAPI.desinscrireParcours(p.id);
      setMessage(`Vous êtes désinscrit du parcours « ${p.nom} ».`);
      await chargerTout();
      if (parcoursSelectionne?.id === p.id) {
        const d = await educationAPI.parcoursDetail(p.id);
        setParcoursSelectionne(d);
      }
    } catch (e) {
      setErreur(
        e instanceof Error ? e.message : 'Échec de la désinscription.',
      );
    } finally {
      setActionId(null);
    }
  };

  const statsEtudiant = useMemo(() => {
    const totalSuivis = mesParcours.length;
    const termines = mesParcours.filter((p) => p.estTermine).length;
    const moyProg =
      totalSuivis > 0
        ? Math.round(
            mesParcours.reduce((acc, p) => acc + (p.progression ?? 0), 0) /
              totalSuivis,
          )
        : 0;
    return { totalSuivis, termines, moyProg };
  }, [mesParcours]);

  return (
    <div className="space-y-6">
      {/* Bandeau résumé étudiant */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 sm:col-span-4">
          <CardBox className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Parcours suivis</p>
              <h3 className="text-2xl font-bold mt-0.5">
                {statsEtudiant.totalSuivis}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                { catalogue.length } parcours publiés disponibles
              </p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lightprimary text-primary">
              <Icon icon="solar:routing-2-linear" height={22} />
            </span>
          </CardBox>
        </div>

        <div className="col-span-12 sm:col-span-4">
          <CardBox className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                Progression moyenne
              </p>
              <h3 className="text-2xl font-bold mt-0.5">
                {statsEtudiant.moyProg}%
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Calculée depuis vos quiz &amp; examens validés
              </p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lightinfo text-info">
              <Icon icon="solar:chart-square-linear" height={22} />
            </span>
          </CardBox>
        </div>

        <div className="col-span-12 sm:col-span-4">
          <CardBox className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                Parcours complétés
              </p>
              <h3 className="text-2xl font-bold mt-0.5">
                {statsEtudiant.termines}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {recommandations.length} suggestion(s) personnalisée(s)
              </p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lightsuccess text-success">
              <Icon icon="solar:diploma-verified-linear" height={22} />
            </span>
          </CardBox>
        </div>
      </div>

      {erreur && (
        <div
          role="alert"
          className="rounded-md bg-lighterror px-4 py-3 text-sm text-error flex items-center justify-between"
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
        <div className="rounded-md bg-lightsuccess px-4 py-3 text-sm text-success flex items-center justify-between">
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

      <CardBox className="p-6">
        <Tabs value={onglet} onValueChange={setOnglet}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="catalogue">
                Catalogue des parcours ({catalogue.length})
              </TabsTrigger>
              <TabsTrigger value="mes-parcours">
                Mes parcours ({mesParcours.length})
              </TabsTrigger>
              <TabsTrigger value="recommandes">
                Recommandés pour moi ({recommandations.length})
              </TabsTrigger>
            </TabsList>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void chargerTout()}
              disabled={chargement}
            >
              <Icon icon="solar:refresh-linear" height={15} />
              Actualiser
            </Button>
          </div>

          {/* ONGLET 1 : CATALOGUE */}
          <TabsContent value="catalogue" className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-5">
                <Input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher un parcours, un cours ou une compétence…"
                />
              </div>
              <div className="lg:col-span-2">
                <select
                  aria-label="Niveau"
                  value={filtreNiveau}
                  onChange={(e) => setFiltreNiveau(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-ld bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Tous les niveaux</option>
                  <option value="Debutant">Débutant</option>
                  <option value="Avance">Avancé</option>
                </select>
              </div>
              <div className="lg:col-span-3">
                <select
                  aria-label="Compétence"
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
              <div className="lg:col-span-2">
                <select
                  aria-label="Durée maximale"
                  value={dureeMax}
                  onChange={(e) => setDureeMax(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-ld bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Toute durée</option>
                  <option value="35">≤ 35 heures</option>
                  <option value="60">≤ 60 heures</option>
                  <option value="100">≤ 100 heures</option>
                </select>
              </div>
            </div>

            {chargement ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Chargement du catalogue…
              </p>
            ) : catalogueFiltre.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Aucun parcours publié ne correspond à vos filtres.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {catalogueFiltre.map((p) => (
                  <div
                    key={p.id}
                    className={`rounded-xl border p-5 flex flex-col justify-between transition-all hover:shadow-md ${
                      p.estInscrit
                        ? 'border-primary/50 bg-lightprimary/15'
                        : 'border-ld'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge
                          variant={
                            p.niveau === 'Avance' ? 'lightInfo' : 'lightPrimary'
                          }
                        >
                          {p.niveau === 'Avance' ? 'Avancé' : 'Débutant'}
                        </Badge>
                        {p.estInscrit ? (
                          <Badge
                            variant={
                              p.estTermine ? 'lightSuccess' : 'primary'
                            }
                          >
                            {p.estTermine ? 'Terminé' : 'Inscrit'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {p.dureeTotale}
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-base font-semibold">{p.nom}</h4>
                        {p.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {p.description}
                          </p>
                        )}
                      </div>

                      {/* Séquence résumée */}
                      <div className="rounded-md bg-background/80 border border-ld p-2.5 text-xs">
                        <span className="font-medium text-muted-foreground block mb-1">
                          {p.nombreCours} cours · {p.dureeTotale}
                        </span>
                        <p className="truncate font-medium">
                          {p.cours.join(' → ')}
                        </p>
                      </div>

                      {p.competences.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {p.competences.map((c) => (
                            <Badge key={c} variant="lightSecondary">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {p.estInscrit && typeof p.progression === 'number' && (
                        <div className="space-y-1 pt-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Progression
                            </span>
                            <span className="font-semibold">
                              {p.progression}%
                            </span>
                          </div>
                          <Progress
                            value={p.progression}
                            variant={p.estTermine ? 'success' : 'primary'}
                            className="h-2"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-4 mt-4 border-t border-ld">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => void ouvrirFeuilleDeRoute(p.id)}
                      >
                        Feuille de route
                      </Button>
                      {p.estInscrit ? (
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1"
                          onClick={() => void ouvrirFeuilleDeRoute(p.id)}
                        >
                          Continuer
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1"
                          disabled={actionId === p.id}
                          onClick={() => void inscrire(p)}
                        >
                          {actionId === p.id ? 'Inscription…' : "S'inscrire"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ONGLET 2 : MES PARCOURS */}
          <TabsContent value="mes-parcours" className="space-y-4">
            {mesParcours.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-ld rounded-lg space-y-3">
                <Icon
                  icon="solar:routing-2-linear"
                  height={38}
                  className="mx-auto text-muted-foreground"
                />
                <div>
                  <p className="text-sm font-semibold">
                    Vous n&apos;êtes inscrit à aucun parcours pour le moment.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Explorez le catalogue ou vos recommandations personnalisées
                    pour démarrer une séquence guidée.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setOnglet('recommandes')}
                >
                  Voir mes recommandations
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {mesParcours.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-ld p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1 max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-semibold">{p.nom}</h4>
                          <Badge
                            variant={
                              p.niveau === 'Avance'
                                ? 'lightInfo'
                                : 'lightPrimary'
                            }
                          >
                            {p.niveau === 'Avance' ? 'Avancé' : 'Débutant'}
                          </Badge>
                          {p.estTermine && (
                            <Badge variant="lightSuccess">
                              Parcours validé à 100%
                            </Badge>
                          )}
                        </div>
                        {p.objectif && (
                          <p className="text-xs text-muted-foreground">
                            Objectif : {p.objectif}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void ouvrirFeuilleDeRoute(p.id)}
                        >
                          <Icon icon="solar:map-arrow-right-linear" height={16} />
                          Feuille de route détaillée
                        </Button>
                        <Button
                          asChild
                          variant="lightprimary"
                          size="sm"
                        >
                          <Link to="/evaluations">
                            Passer un quiz / examen
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="ghosterror"
                          size="sm"
                          disabled={actionId === p.id}
                          onClick={() => void desinscrire(p)}
                        >
                          Se désinscrire
                        </Button>
                      </div>
                    </div>

                    {/* Barre de progression globale */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {p.coursTermines ?? 0} sur {p.nombreCours} cours
                          validés ({p.dureeTotale})
                        </span>
                        <span className="font-bold text-sm">
                          {p.progression ?? 0}%
                        </span>
                      </div>
                      <Progress
                        value={p.progression ?? 0}
                        variant={p.estTermine ? 'success' : 'primary'}
                        className="h-2.5"
                      />
                    </div>

                    {/* Étapes en ligne + Prochaine étape */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {p.etapes.map((etape) => {
                        const st = badgeStatutEtape(etape.statutEtudiant);
                        return (
                          <div
                            key={etape.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-ld p-2.5 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${st.cercle}`}
                              >
                                {etape.position}
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium truncate">
                                  {etape.nom}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {etape.duree}
                                  {etape.noteObtenue !== null &&
                                  etape.noteObtenue !== undefined
                                    ? ` · Note : ${etape.noteObtenue}/${etape.noteMax ?? 20}`
                                    : ''}
                                </p>
                              </div>
                            </div>
                            <Badge variant={st.variant}>{st.texte}</Badge>
                          </div>
                        );
                      })}
                    </div>

                    {p.prochainCours && (
                      <div className="rounded-lg bg-lightprimary/40 px-3.5 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <strong>Prochaine étape recommandée :</strong>{' '}
                          Étape {p.prochainCours.position} —{' '}
                          {p.prochainCours.nom} ({p.prochainCours.duree})
                        </span>
                        <Link
                          to="/evaluations"
                          className="font-semibold text-primary hover:underline"
                        >
                          Valider l&apos;évaluation associée →
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ONGLET 3 : RECOMMANDATIONS PERSONNALISÉES */}
          <TabsContent value="recommandes" className="space-y-4">
            {recommandations.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Vous suivez déjà tous les parcours pertinents du catalogue !
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {recommandations.map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded-xl border border-ld p-5 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              rec.niveau === 'Avance'
                                ? 'lightInfo'
                                : 'lightPrimary'
                            }
                          >
                            {rec.niveau === 'Avance' ? 'Avancé' : 'Débutant'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {rec.nombreCours} cours · {rec.dureeTotale}
                          </span>
                        </div>
                        <Badge variant="lightSuccess">
                          Pertinence : {rec.scorePertinence}%
                        </Badge>
                      </div>

                      <div>
                        <h4 className="text-base font-semibold">{rec.nom}</h4>
                        {rec.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {rec.description}
                          </p>
                        )}
                      </div>

                      {/* Pourquoi ce parcours ? */}
                      <div className="rounded-lg bg-lightprimary/30 dark:bg-white/5 p-3 space-y-1.5">
                        <p className="text-xs font-semibold text-primary">
                          Pourquoi ce parcours vous est recommandé :
                        </p>
                        <ul className="space-y-1 text-xs">
                          {rec.raisons.map((r, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <Icon
                                icon="solar:stars-minimalistic-linear"
                                height={14}
                                className="text-primary shrink-0 mt-0.5"
                              />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-ld">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => void ouvrirFeuilleDeRoute(rec.id)}
                      >
                        Voir les étapes
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1"
                        disabled={actionId === rec.id}
                        onClick={() => void inscrire(rec)}
                      >
                        {actionId === rec.id ? 'Inscription…' : "S'inscrire"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardBox>

      {/* Modale Feuille de route visuelle (Stepper) */}
      <Dialog
        open={Boolean(parcoursSelectionne) || chargementDetail}
        onOpenChange={(o) => !o && setParcoursSelectionne(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {chargementDetail && !parcoursSelectionne ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Chargement de votre feuille de route…
            </p>
          ) : parcoursSelectionne ? (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge
                    variant={
                      parcoursSelectionne.niveau === 'Avance'
                        ? 'lightInfo'
                        : 'lightPrimary'
                    }
                  >
                    {parcoursSelectionne.niveau === 'Avance'
                      ? 'Parcours Avancé'
                      : 'Parcours Débutant'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {parcoursSelectionne.nombreCours} cours ·{' '}
                    {parcoursSelectionne.dureeTotale}
                  </span>
                  {parcoursSelectionne.estInscrit && (
                    <Badge variant="lightSuccess">Inscrit</Badge>
                  )}
                </div>
                <DialogTitle className="text-xl">
                  {parcoursSelectionne.nom}
                </DialogTitle>
                {parcoursSelectionne.description && (
                  <DialogDescription>
                    {parcoursSelectionne.description}
                  </DialogDescription>
                )}
              </DialogHeader>

              <div className="space-y-5 mt-2">
                {typeof parcoursSelectionne.progression === 'number' && (
                  <div className="rounded-lg border border-ld p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">
                        Progression globale ({parcoursSelectionne.coursTermines ?? 0}/
                        {parcoursSelectionne.nombreCours} cours validés)
                      </span>
                      <span className="font-bold text-sm">
                        {parcoursSelectionne.progression}%
                      </span>
                    </div>
                    <Progress
                      value={parcoursSelectionne.progression}
                      variant={
                        parcoursSelectionne.estTermine ? 'success' : 'primary'
                      }
                      className="h-2.5"
                    />
                  </div>
                )}

                {parcoursSelectionne.prerequisEntree.length > 0 && (
                  <div className="rounded-lg bg-lightwarning/40 p-3 text-xs">
                    <span className="font-semibold">
                      Prérequis conseillés au départ :{' '}
                    </span>
                    {parcoursSelectionne.prerequisEntree.join(', ')}
                  </div>
                )}

                {/* Stepper vertical ordonné */}
                <ol className="relative border-s-2 border-primary/30 ms-3 space-y-4">
                  {parcoursSelectionne.etapes.map((etape) => {
                    const st = badgeStatutEtape(etape.statutEtudiant);
                    const estProchain =
                      parcoursSelectionne.prochainCours?.id === etape.id;
                    return (
                      <li key={etape.id} className="ms-6">
                        <span
                          className={`absolute -start-3.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ring-4 ring-white dark:ring-dark ${st.cercle}`}
                        >
                          {etape.position}
                        </span>
                        <div
                          className={`rounded-lg border p-4 space-y-2 ${
                            estProchain
                              ? 'border-primary bg-lightprimary/20'
                              : 'border-ld'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h5 className="font-semibold text-sm flex items-center gap-2">
                                {etape.nom}
                                {estProchain && (
                                  <Badge variant="primary">
                                    Prochaine étape
                                  </Badge>
                                )}
                              </h5>
                              <p className="text-xs text-muted-foreground">
                                {etape.type} · {etape.duree}
                                {etape.formateurs.length > 0
                                  ? ` · Formateur(s) : ${etape.formateurs.join(', ')}`
                                  : ''}
                              </p>
                            </div>
                            <Badge variant={st.variant}>{st.texte}</Badge>
                          </div>

                          {etape.description && (
                            <p className="text-xs text-muted-foreground">
                              {etape.description}
                            </p>
                          )}

                          {etape.noteObtenue !== null &&
                            etape.noteObtenue !== undefined && (
                              <p className="text-xs font-medium text-success">
                                Meilleure note obtenue : {etape.noteObtenue} /{' '}
                                {etape.noteMax ?? 20}
                              </p>
                            )}

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {etape.competences.map((c) => (
                              <Badge key={c} variant="lightSecondary">
                                Compétence : {c}
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
                    );
                  })}
                </ol>

                {parcoursSelectionne.certificationsLiees &&
                  parcoursSelectionne.certificationsLiees.length > 0 && (
                    <div className="rounded-lg border border-ld p-3.5 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Certifications en lien avec ce parcours :
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {parcoursSelectionne.certificationsLiees.map((c) => (
                          <Badge key={c.id} variant="lightInfo">
                            {c.nom ?? c.id}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              <DialogFooter className="gap-2">
                {parcoursSelectionne.estInscrit ? (
                  <>
                    <Button
                      type="button"
                      variant="ghosterror"
                      disabled={actionId === parcoursSelectionne.id}
                      onClick={() => void desinscrire(parcoursSelectionne)}
                    >
                      Se désinscrire
                    </Button>
                    <Button asChild>
                      <Link to="/evaluations">
                        Accéder à mes évaluations &amp; quiz
                      </Link>
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    disabled={actionId === parcoursSelectionne.id}
                    onClick={() => void inscrire(parcoursSelectionne)}
                  >
                    {actionId === parcoursSelectionne.id
                      ? 'Inscription…'
                      : "S'inscrire à ce parcours"}
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortailParcoursEtudiant;

