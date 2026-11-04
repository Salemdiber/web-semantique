import { useEffect, useMemo, useState } from 'react';
import { DASHBOARD_URL, parcoursLandingAPI, type EvaluationEtudiant, type QuizDetailPublic, type ResultatQuizPublic } from '@/app/utils/parcoursApi';
import { useSession } from '@/utils/session';

const Evaluations = () => {
    const { utilisateur } = useSession();
    const [evaluations, setEvaluations] = useState<EvaluationEtudiant[]>([]);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState('');
    const [quizId, setQuizId] = useState<string | null>(null);

    useEffect(() => {
        if (utilisateur?.role !== 'etudiant') {
            setChargement(false);
            return;
        }
        void parcoursLandingAPI
            .mesEvaluations()
            .then(setEvaluations)
            .catch((cause) =>
                setErreur(
                    cause instanceof Error
                        ? cause.message
                        : 'Impossible de charger vos évaluations.',
                ),
            )
            .finally(() => setChargement(false));
    }, [utilisateur?.role]);

    const quiz = useMemo(
        () => evaluations.filter((evaluation) => evaluation.type === 'Quiz'),
        [evaluations],
    );

    if (!utilisateur) {
        return (
            <section className="min-h-screen bg-cream px-4 pb-20 pt-32">
                <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
                    <h1 className="text-3xl font-bold text-dark">Mes quiz</h1>
                    <p className="mt-3 text-gray-600">Connectez-vous pour accéder à vos quiz.</p>
                    <a href={`${DASHBOARD_URL}/auth/auth2/login`} className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-white">
                        Se connecter
                    </a>
                </div>
            </section>
        );
    }

    if (utilisateur.role !== 'etudiant') {
        return <section className="min-h-screen bg-cream px-4 pb-20 pt-32 text-center text-gray-600">Cette page est réservée aux étudiants.</section>;
    }

    return (
        <section className="min-h-screen bg-cream px-4 pb-20 pt-32">
            <div className="mx-auto max-w-5xl">
                <div className="mb-8">
                    <span className="rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">Espace étudiant</span>
                    <h1 className="mt-3 text-4xl font-bold text-dark">Mes quiz</h1>
                    <p className="mt-2 text-gray-600">Passez vos quiz directement depuis le front-office.</p>
                </div>
                {chargement && <p className="text-gray-600">Chargement des quiz…</p>}
                {erreur && <p className="rounded-xl bg-red-50 p-4 text-red-700">{erreur}</p>}
                {!chargement && !erreur && quiz.length === 0 && <p className="rounded-xl bg-white p-6 text-gray-600">Aucun quiz ne vous est attribué.</p>}
                <div className="grid gap-4 md:grid-cols-2">
                    {quiz.map((evaluation) => (
                        <article key={evaluation.id} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-xl font-bold text-dark">{evaluation.nom}</h2>
                                    <p className="mt-1 text-sm text-gray-500">{evaluation.cours}</p>
                                </div>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${evaluation.reussi ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'}`}>
                                    {evaluation.reussi ? 'Réussi' : evaluation.quizPasse ? 'À refaire' : 'À passer'}
                                </span>
                            </div>
                            <p className="mt-4 text-sm text-gray-600">{evaluation.quizQuestions ?? 0} question(s) · Seuil : {evaluation.noteMin}/{evaluation.noteMax}</p>
                            <button type="button" onClick={() => setQuizId(evaluation.id)} className="mt-5 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90">
                                {evaluation.reussi ? 'Voir le résultat' : evaluation.quizPasse ? 'Réessayer' : 'Passer le quiz'}
                            </button>
                        </article>
                    ))}
                </div>
            </div>
            {quizId && <QuizModal evaluationId={quizId} onClose={() => setQuizId(null)} onTermine={() => void parcoursLandingAPI.mesEvaluations().then(setEvaluations)} />}
        </section>
    );
};

const QuizModal = ({ evaluationId, onClose, onTermine }: { evaluationId: string; onClose: () => void; onTermine: () => void }) => {
    const [detail, setDetail] = useState<QuizDetailPublic | null>(null);
    const [resultat, setResultat] = useState<ResultatQuizPublic | null>(null);
    const [reponses, setReponses] = useState<Record<number, number>>({});
    const [erreur, setErreur] = useState('');
    const [envoi, setEnvoi] = useState(false);

    useEffect(() => {
        void parcoursLandingAPI.quizDetail(evaluationId).then(setDetail).catch((cause) => setErreur(cause instanceof Error ? cause.message : 'Impossible de charger le quiz.'));
    }, [evaluationId]);

    const repondues = Object.keys(reponses).length;
    const bilan = resultat ?? (detail?.dejaReussi ? { note: detail.tentative?.note ?? 0, noteMax: detail.noteMax, noteMin: detail.noteMin, score: detail.tentative?.score ?? 0, total: detail.tentative?.total ?? 0, reussi: true, tentatives: detail.tentative?.tentatives ?? 0, corrections: [] } : null);
    const soumettre = async () => {
        if (!detail || repondues !== detail.questions.length) return;
        setEnvoi(true);
        try {
            const retour = await parcoursLandingAPI.soumettreQuiz(detail.evaluationId, detail.questions.map((q) => ({ question_id: q.id, choix: reponses[q.id] })));
            setResultat(retour);
            onTermine();
        } catch (cause) {
            setErreur(cause instanceof Error ? cause.message : 'Envoi des réponses impossible.');
        } finally {
            setEnvoi(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-start justify-between gap-4">
                    <div><p className="text-sm font-semibold text-primary">Quiz</p><h2 className="text-2xl font-bold text-dark">{detail?.nom ?? 'Chargement…'}</h2></div>
                    <button type="button" onClick={onClose} className="text-2xl text-gray-400" aria-label="Fermer">×</button>
                </div>
                {erreur && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
                {!detail && !erreur && <p className="py-10 text-center text-gray-500">Chargement du questionnaire…</p>}
                {detail && !bilan && <div className="mt-5 space-y-4">
                    <div className="rounded-xl bg-primary/5 p-3 text-sm text-gray-600">
                        Progression : <strong>{repondues}/{detail.questions.length}</strong>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${detail.questions.length ? (repondues / detail.questions.length) * 100 : 0}%` }} /></div>
                    </div>
                    {detail.questions.map((question, index) => <div key={question.id} className="rounded-xl border border-gray-200 p-4">
                        <div className="flex justify-between gap-3"><p className="font-semibold text-dark">{index + 1}. {question.enonce}</p><span className="text-xs text-gray-500">{question.points} pt</span></div>
                        <div className="mt-3 space-y-2">{question.choix.map((choix, choixIndex) => <button key={choix} type="button" aria-pressed={reponses[question.id] === choixIndex} onClick={() => setReponses({ ...reponses, [question.id]: choixIndex })} className={`w-full rounded-lg border p-3 text-left text-sm ${reponses[question.id] === choixIndex ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 hover:border-primary'}`}>{choix}</button>)}</div>
                    </div>)}
                    <button type="button" disabled={envoi || repondues !== detail.questions.length} onClick={() => void soumettre()} className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{envoi ? 'Correction…' : 'Valider mes réponses'}</button>
                </div>}
                {bilan && <div className="mt-6 rounded-xl bg-primary/5 p-6 text-center"><p className="text-4xl font-bold text-dark">{bilan.note.toFixed(2)} / {bilan.noteMax}</p><p className={`mt-2 font-semibold ${bilan.reussi ? 'text-green-700' : 'text-red-700'}`}>{bilan.reussi ? 'Quiz réussi' : 'Quiz échoué'} · seuil {bilan.noteMin}/{bilan.noteMax}</p><button type="button" onClick={onClose} className="mt-5 rounded-xl bg-primary px-5 py-2.5 font-semibold text-white">Fermer</button></div>}
            </div>
        </div>
    );
};

export default Evaluations;
