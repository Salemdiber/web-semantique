/**
 * Section « Parcours d'apprentissage » de la vitrine (Front-Office :3001).
 *
 * S'adapte automatiquement au profil connecté grâce au cookie de session partagé :
 * - Visiteur   : catalogue publié en lecture seule + redirection connexion à l'inscription
 * - Étudiant   : inscription / désinscription en direct, barre de progression dérivée,
 *                recommandations personnalisées et lien profond vers l'espace étudiant (:5173)
 * - Encadrant  : badges statut/inscrits et raccourcis d'administration vers :5173/parcours
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useSession } from '@/utils/session';
import {
    DASHBOARD_URL,
    parcoursLandingAPI,
    type ParcoursPublic,
    type ParcoursRecommandationPublic,
} from '@/app/utils/parcoursApi';

type Props = {
    parcoursIdInitial?: string;
    pleinePage?: boolean;
};

const Parcours = ({ parcoursIdInitial, pleinePage = false }: Props) => {
    const { utilisateur } = useSession();

    const [parcours, setParcours] = useState<ParcoursPublic[]>([]);
    const [recommandations, setRecommandations] = useState<
        ParcoursRecommandationPublic[]
    >([]);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState<string | null>(null);
    const [notification, setNotification] = useState<{
        type: 'succes' | 'erreur';
        texte: string;
    } | null>(null);

    // Filtres
    const [recherche, setRecherche] = useState('');
    const [filtreNiveau, setFiltreNiveau] = useState('');
    const [filtreCompetence, setFiltreCompetence] = useState('');

    // Modale feuille de route
    const [selection, setSelection] = useState<ParcoursPublic | null>(null);
    const [actionId, setActionId] = useState<string | null>(null);

    const estEtudiant = utilisateur?.role === 'etudiant';
    const estAdmin = utilisateur?.role === 'admin';
    const estEncadrant =
        utilisateur?.role === 'admin' || utilisateur?.role === 'formateur';

    const charger = useCallback(async () => {
        setChargement(true);
        setErreur(null);
        try {
            const liste = await parcoursLandingAPI.lister();
            setParcours(liste);
            if (estEtudiant) {
                try {
                    const recs = await parcoursLandingAPI.recommandations();
                    setRecommandations(recs);
                } catch {
                    setRecommandations([]);
                }
            } else {
                setRecommandations([]);
            }
        } catch {
            setErreur(
                "API sémantique injoignable. Vérifiez que Fuseki (:3030) et FastAPI (:8000) sont actifs.",
            );
        } finally {
            setChargement(false);
        }
    }, [estEtudiant]);

    useEffect(() => {
        void charger();
    }, [charger]);

    useEffect(() => {
        if (!parcoursIdInitial || parcours.length === 0) return;
        const cible = parcours.find((p) => p.id === parcoursIdInitial);
        if (cible) {
            void parcoursLandingAPI
                .detail(cible.id)
                .then(setSelection)
                .catch(() => setSelection(cible));
        }
    }, [parcoursIdInitial, parcours]);

    const toutesCompetences = useMemo(() => {
        const s = new Set<string>();
        parcours.forEach((p) => p.competences.forEach((c) => s.add(c)));
        return Array.from(s).sort();
    }, [parcours]);

    const parcoursFiltres = useMemo(() => {
        const q = recherche.trim().toLowerCase();
        return parcours.filter((p) => {
            if (filtreNiveau && p.niveau !== filtreNiveau) return false;
            if (filtreCompetence && !p.competences.includes(filtreCompetence))
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
    }, [parcours, recherche, filtreNiveau, filtreCompetence]);

    const ouvrirDetail = async (p: ParcoursPublic) => {
        try {
            const d = await parcoursLandingAPI.detail(p.id);
            setSelection(d);
        } catch {
            setSelection(p);
        }
    };

    const gererInscription = async (p: ParcoursPublic) => {
        if (!utilisateur) {
            window.location.href = `${DASHBOARD_URL}/auth/auth2/login`;
            return;
        }
        if (!estEtudiant) return;

        setActionId(p.id);
        setNotification(null);
        try {
            const maj = await parcoursLandingAPI.inscrire(p.id);
            setNotification({
                type: 'succes',
                texte: `Inscription confirmée au parcours « ${p.nom} » !`,
            });
            await charger();
            if (selection?.id === p.id) {
                setSelection(maj);
            }
        } catch {
            setNotification({
                type: 'erreur',
                texte: "Impossible de finaliser l'inscription à ce parcours.",
            });
        } finally {
            setActionId(null);
        }
    };

    const gererDesinscription = async (p: ParcoursPublic) => {
        setActionId(p.id);
        setNotification(null);
        try {
            await parcoursLandingAPI.desinscrire(p.id);
            setNotification({
                type: 'succes',
                texte: `Vous êtes désinscrit du parcours « ${p.nom} ».`,
            });
            await charger();
            if (selection?.id === p.id) {
                const maj = await parcoursLandingAPI.detail(p.id);
                setSelection(maj);
            }
        } catch {
            setNotification({
                type: 'erreur',
                texte: 'Impossible de annuler cette inscription.',
            });
        } finally {
            setActionId(null);
        }
    };

    return (
        <section
            id="parcours-section"
            className={`section-tb ${pleinePage ? 'pt-32 bg-cream min-h-screen' : 'bg-white'}`}
        >
            <div className="container mx-auto max-w-7xl px-4">
                {/* En-tête */}
                <div className="mb-10 text-center">
                    <span className="mb-2 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
                        Séquences Pédagogiques Guidées (OWL)
                    </span>
                    <h2 className="text-3xl font-bold text-dark sm:text-4xl">
                        Parcours d&apos;apprentissage structurés
                    </h2>
                    <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-600">
                        Progressez étape par étape à travers des séquences de cours
                        ordonnées selon leurs prérequis et compétences cibles.
                    </p>

                    {/* Barre de raccourcis réservée aux encadrants connectés */}
                    {estEncadrant && (
                        <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
                            <span className="text-xs font-semibold text-primary">
                                Mode {estAdmin ? 'Administrateur' : 'Formateur'} :
                            </span>
                            <a
                                href={`${DASHBOARD_URL}/parcours`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-primary shadow-sm hover:bg-primary hover:text-white transition"
                            >
                                <Icon icon="solar:settings-linear" width={15} />
                                Gérer les parcours
                            </a>
                            {estAdmin && (
                                <a
                                    href={`${DASHBOARD_URL}/parcours?action=new`}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition"
                                >
                                    <Icon icon="solar:add-circle-linear" width={15} />
                                    Créer un parcours
                                </a>
                            )}
                        </div>
                    )}
                </div>

                {/* Notification d'action */}
                {notification && (
                    <div
                        role="status"
                        className={`mb-6 rounded-xl px-4 py-3 text-sm flex items-center justify-between ${
                            notification.type === 'succes'
                                ? 'bg-green-50 text-green-800 border border-green-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                    >
                        <span>{notification.texte}</span>
                        <button
                            type="button"
                            onClick={() => setNotification(null)}
                            className="text-xs font-semibold underline"
                        >
                            Fermer
                        </button>
                    </div>
                )}

                {/* Recommandation personnalisée pour l'étudiant connecté */}
                {estEtudiant && recommandations.length > 0 && (
                    <div className="mb-8 rounded-2xl border border-primary/25 bg-primary/5 p-5 flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1 max-w-2xl">
                            <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary">
                                <Icon
                                    icon="solar:stars-minimalistic-bold"
                                    width={15}
                                />
                                Recommandé pour votre profil ({recommandations[0].scorePertinence}% de pertinence)
                            </span>
                            <h3 className="text-lg font-bold text-dark">
                                {recommandations[0].nom} ·{' '}
                                <span className="text-sm font-medium text-gray-600">
                                    {recommandations[0].dureeTotale}
                                </span>
                            </h3>
                            <p className="text-sm text-gray-600">
                                {recommandations[0].raisons[0]}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => void ouvrirDetail(recommandations[0])}
                                className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-white transition"
                            >
                                Découvrir
                            </button>
                            <a
                                href={`${DASHBOARD_URL}/parcours?tab=recommandes`}
                                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
                            >
                                Toutes mes suggestions
                            </a>
                        </div>
                    </div>
                )}

                {/* Barre de filtres */}
                <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-6">
                        <input
                            type="search"
                            value={recherche}
                            onChange={(e) => setRecherche(e.target.value)}
                            placeholder="Rechercher un parcours, un cours ou une compétence…"
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-dark shadow-xs focus:border-primary focus:outline-none"
                        />
                    </div>
                    <div className="sm:col-span-3">
                        <select
                            aria-label="Filtrer par niveau"
                            value={filtreNiveau}
                            onChange={(e) => setFiltreNiveau(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-dark shadow-xs focus:border-primary focus:outline-none"
                        >
                            <option value="">Tous les niveaux</option>
                            <option value="Debutant">Parcours Débutant</option>
                            <option value="Avance">Parcours Avancé</option>
                        </select>
                    </div>
                    <div className="sm:col-span-3">
                        <select
                            aria-label="Filtrer par compétence"
                            value={filtreCompetence}
                            onChange={(e) => setFiltreCompetence(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-dark shadow-xs focus:border-primary focus:outline-none"
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

                {/* Contenu principal */}
                {erreur ? (
                    <p className="py-10 text-center text-gray-600">{erreur}</p>
                ) : chargement ? (
                    <p className="py-12 text-center text-gray-500">
                        Chargement des parcours depuis l&apos;ontologie…
                    </p>
                ) : parcoursFiltres.length === 0 ? (
                    <p className="py-12 text-center text-gray-500">
                        Aucun parcours ne correspond à votre recherche.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {parcoursFiltres.map((p) => (
                            <article
                                key={p.id}
                                className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-lg"
                            >
                                <div>
                                    {/* Badges niveau & statut */}
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                p.niveau === 'Avance'
                                                    ? 'bg-purple-100 text-purple-700'
                                                    : 'bg-primary/10 text-primary'
                                            }`}
                                        >
                                            {p.niveau === 'Avance'
                                                ? 'Niveau Avancé'
                                                : 'Niveau Débutant'}
                                        </span>

                                        <div className="flex items-center gap-1.5">
                                            {estEncadrant && (
                                                <>
                                                    <span
                                                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                            p.statut === 'publie'
                                                                ? 'bg-green-100 text-green-700'
                                                                : 'bg-amber-100 text-amber-700'
                                                        }`}
                                                    >
                                                        {p.statut === 'publie'
                                                            ? 'Publié'
                                                            : 'Brouillon'}
                                                    </span>
                                                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                                                        {p.nombreInscrits} inscrit
                                                        {p.nombreInscrits > 1
                                                            ? 's'
                                                            : ''}
                                                    </span>
                                                </>
                                            )}
                                            {estEtudiant && p.estInscrit && (
                                                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                                                    {p.estTermine
                                                        ? 'Complété'
                                                        : 'Inscrit'}
                                                </span>
                                            )}
                                            <span className="text-xs font-medium text-gray-500">
                                                ⏳ {p.dureeTotale}
                                            </span>
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-dark">
                                        {p.nom}
                                    </h3>

                                    {p.description && (
                                        <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                                            {p.description}
                                        </p>
                                    )}

                                    {/* Séquence ordonnée de cours */}
                                    <div className="mt-4 rounded-xl bg-cream/70 p-3.5">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                                            Feuille de route ({p.nombreCours}{' '}
                                            cours)
                                        </p>
                                        <ol className="space-y-1.5">
                                            {p.etapes.map((e) => (
                                                <li
                                                    key={e.id}
                                                    className="flex items-center justify-between text-xs text-dark"
                                                >
                                                    <span className="flex items-center gap-2 font-medium truncate">
                                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                                                            {e.position}
                                                        </span>
                                                        {e.nom}
                                                    </span>
                                                    <span className="text-gray-500 shrink-0 ml-2">
                                                        {e.duree}
                                                    </span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>

                                    {/* Compétences visées */}
                                    {p.competences.length > 0 && (
                                        <div className="mt-4 flex flex-wrap gap-1.5">
                                            {p.competences.map((comp) => (
                                                <span
                                                    key={comp}
                                                    className="rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-medium text-secondary"
                                                >
                                                    {comp}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Barre de progression étudiant inscrit */}
                                    {estEtudiant &&
                                        p.estInscrit &&
                                        typeof p.progression === 'number' && (
                                            <div className="mt-4 space-y-1.5">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-600">
                                                        Votre avancement
                                                    </span>
                                                    <span className="font-bold text-primary">
                                                        {p.progression}%
                                                    </span>
                                                </div>
                                                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                                                    <div
                                                        className="h-full rounded-full bg-primary transition-all"
                                                        style={{
                                                            width: `${p.progression}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                </div>

                                {/* Actions selon le rôle */}
                                <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void ouvrirDetail(p)}
                                        className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-dark hover:border-primary hover:text-primary transition cursor-pointer"
                                    >
                                        Détail du parcours
                                    </button>

                                    {!utilisateur && (
                                        <a
                                            href={`${DASHBOARD_URL}/auth/auth2/login`}
                                            className="flex-1 text-center rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition"
                                        >
                                            S&apos;inscrire
                                        </a>
                                    )}

                                    {estEtudiant &&
                                        (p.estInscrit ? (
                                            <a
                                                href={`${DASHBOARD_URL}/parcours?id=${encodeURIComponent(p.id)}`}
                                                className="flex-1 text-center rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition"
                                            >
                                                Continuer →
                                            </a>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={actionId === p.id}
                                                onClick={() =>
                                                    void gererInscription(p)
                                                }
                                                className="flex-1 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition cursor-pointer"
                                            >
                                                {actionId === p.id
                                                    ? 'Inscription…'
                                                    : "S'inscrire"}
                                            </button>
                                        ))}

                                    {estEncadrant && (
                                        <a
                                            href={
                                                estAdmin
                                                    ? `${DASHBOARD_URL}/parcours?edit=${encodeURIComponent(p.id)}`
                                                    : `${DASHBOARD_URL}/parcours?id=${encodeURIComponent(p.id)}`
                                            }
                                            className="flex-1 text-center rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary hover:text-white transition"
                                        >
                                            {estAdmin ? 'Modifier' : 'Analyser'}
                                        </a>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>

            {/* Modale Feuille de route détaillée */}
            {selection && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    onClick={() => setSelection(null)}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
                                        {selection.niveau === 'Avance'
                                            ? 'Parcours Avancé'
                                            : 'Parcours Débutant'}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {selection.nombreCours} cours ·{' '}
                                        {selection.dureeTotale}
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold text-dark">
                                    {selection.nom}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelection(null)}
                                aria-label="Fermer"
                                className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
                            >
                                <Icon
                                    icon="material-symbols:close-rounded"
                                    width={22}
                                />
                            </button>
                        </div>

                        {selection.description && (
                            <p className="mt-3 text-sm text-gray-600">
                                {selection.description}
                            </p>
                        )}
                        {selection.objectif && (
                            <p className="mt-2 rounded-lg bg-primary/5 p-3 text-xs text-dark">
                                <strong>Objectif pédagogique : </strong>
                                {selection.objectif}
                            </p>
                        )}

                        {selection.prerequisEntree.length > 0 && (
                            <p className="mt-3 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
                                <strong>Prérequis conseillés : </strong>
                                {selection.prerequisEntree.join(', ')}
                            </p>
                        )}

                        {/* Étapes ordonnées */}
                        <div className="mt-5 space-y-3">
                            <h4 className="text-sm font-bold text-dark">
                                Séquence ordonnée des cours
                            </h4>
                            <ol className="relative border-s-2 border-primary/30 ms-3 space-y-3">
                                {selection.etapes.map((e) => (
                                    <li key={e.id} className="ms-5">
                                        <span className="absolute -start-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                                            {e.position}
                                        </span>
                                        <div className="rounded-xl border border-gray-200 p-3.5">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <span className="font-semibold text-sm text-dark">
                                                    {e.nom}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {e.type} · {e.duree}
                                                </span>
                                            </div>
                                            {e.description && (
                                                <p className="mt-1 text-xs text-gray-600">
                                                    {e.description}
                                                </p>
                                            )}
                                            {e.formateurs.length > 0 && (
                                                <p className="mt-1 text-xs text-gray-500">
                                                    Formateur(s) :{' '}
                                                    {e.formateurs.join(', ')}
                                                </p>
                                            )}
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {e.competences.map((c) => (
                                                    <span
                                                        key={c}
                                                        className="rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-medium text-green-700"
                                                    >
                                                        Compétence : {c}
                                                    </span>
                                                ))}
                                                {e.prerequis.map((pr) => (
                                                    <span
                                                        key={pr}
                                                        className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700"
                                                    >
                                                        Prérequis : {pr}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-200 flex flex-wrap justify-end gap-3">
                            {!utilisateur && (
                                <a
                                    href={`${DASHBOARD_URL}/auth/auth2/login`}
                                    className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
                                >
                                    Se connecter pour s&apos;inscrire
                                </a>
                            )}

                            {estEtudiant &&
                                (selection.estInscrit ? (
                                    <>
                                        <button
                                            type="button"
                                            disabled={actionId === selection.id}
                                            onClick={() =>
                                                void gererDesinscription(
                                                    selection,
                                                )
                                            }
                                            className="rounded-xl border border-red-300 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                                        >
                                            Se désinscrire
                                        </button>
                                        <a
                                            href={`${DASHBOARD_URL}/parcours?id=${encodeURIComponent(selection.id)}`}
                                            className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-white hover:opacity-90 transition"
                                        >
                                            Suivre ma progression dans mon espace →
                                        </a>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={actionId === selection.id}
                                        onClick={() =>
                                            void gererInscription(selection)
                                        }
                                        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
                                    >
                                        {actionId === selection.id
                                            ? 'Inscription…'
                                            : "S'inscrire à ce parcours"}
                                    </button>
                                ))}

                            {estEncadrant && (
                                <a
                                    href={`${DASHBOARD_URL}/parcours?id=${encodeURIComponent(selection.id)}`}
                                    className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
                                >
                                    Ouvrir dans le back-office →
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default Parcours;

