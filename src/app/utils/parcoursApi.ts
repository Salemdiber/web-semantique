import axios from 'axios';
import { lireJetonSession } from '@/utils/session';

export const API_URL: string =
    import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const DASHBOARD_URL: string =
    import.meta.env.VITE_DASHBOARD_URL ?? 'http://localhost:5173';

export type EtapeParcoursPublic = {
    position: number;
    id: string;
    nom: string;
    duree: string;
    dureeHeures: number;
    description: string | null;
    type: string;
    prerequis: string[];
    competences: string[];
    formateurs: string[];
    statutEtudiant?: 'non_commence' | 'en_cours' | 'termine';
    noteObtenue?: number | null;
    noteMax?: number | null;
};

export type ParcoursPublic = {
    id: string;
    nom: string;
    description: string | null;
    objectif: string | null;
    statut: 'brouillon' | 'publie';
    niveau: 'Debutant' | 'Avance';
    niveauClasse: 'ParcoursDebutant' | 'ParcoursAvance';
    cours: string[];
    coursIds: string[];
    etapes: EtapeParcoursPublic[];
    nombreCours: number;
    dureeHeures: number;
    dureeTotale: string;
    competences: string[];
    prerequis: string[];
    prerequisEntree: string[];
    formateurs: string[];
    nombreInscrits: number;
    estInscrit?: boolean;
    progression?: number | null;
    coursTermines?: number;
    estTermine?: boolean;
    prochainCours?: {
        id: string;
        nom: string;
        position: number;
        duree: string;
    } | null;
};

export type ParcoursRecommandationPublic = ParcoursPublic & {
    scorePertinence: number;
    raisons: string[];
};

export type EvaluationEtudiant = {
    id: string;
    nom: string;
    type: string | null;
    cours: string;
    date: string | null;
    noteMax: number;
    noteMin: number;
    note: number | null;
    reussi: boolean | null;
    quizQuestions?: number;
    quizPasse?: boolean | null;
};

export type QuizQuestionPublic = {
    id: number;
    enonce: string;
    choix: string[];
    points: number;
};

export type QuizDetailPublic = {
    evaluationId: string;
    nom: string;
    cours: string;
    noteMax: number;
    noteMin: number;
    questions: QuizQuestionPublic[];
    tentative: {
        note: number;
        score: number;
        total: number;
        tentatives: number;
    } | null;
    dejaReussi: boolean;
};

export type ResultatQuizPublic = {
    note: number;
    noteMax: number;
    noteMin: number;
    score: number;
    total: number;
    reussi: boolean;
    tentatives: number;
    corrections: {
        questionId: number;
        choix: number;
        bonneReponse: number;
        correcte: boolean;
    }[];
};

function entetesOptionnelles(): Record<string, string> {
    const jeton = lireJetonSession();
    return jeton ? { Authorization: `Bearer ${jeton}` } : {};
}

export const parcoursLandingAPI = {
    lister: async (): Promise<ParcoursPublic[]> => {
        const res = await axios.get<ParcoursPublic[]>(
            `${API_URL}/education/parcours`,
            { headers: entetesOptionnelles() },
        );
        return res.data;
    },

    detail: async (id: string): Promise<ParcoursPublic> => {
        const res = await axios.get<ParcoursPublic>(
            `${API_URL}/education/parcours/${encodeURIComponent(id)}`,
            { headers: entetesOptionnelles() },
        );
        return res.data;
    },

    recommandations: async (): Promise<ParcoursRecommandationPublic[]> => {
        const res = await axios.get<ParcoursRecommandationPublic[]>(
            `${API_URL}/education/parcours/recommandations`,
            { headers: entetesOptionnelles() },
        );
        return res.data;
    },

    inscrire: async (id: string): Promise<ParcoursPublic> => {
        const res = await axios.post<ParcoursPublic>(
            `${API_URL}/education/parcours/${encodeURIComponent(id)}/inscription`,
            {},
            { headers: entetesOptionnelles() },
        );
        return res.data;
    },

    desinscrire: async (id: string): Promise<void> => {
        await axios.delete(
            `${API_URL}/education/parcours/${encodeURIComponent(id)}/inscription`,
            { headers: entetesOptionnelles() },
        );
    },

    mesEvaluations: async (): Promise<EvaluationEtudiant[]> => {
        const res = await axios.get<EvaluationEtudiant[]>(
            `${API_URL}/education/mes-evaluations`,
            { headers: entetesOptionnelles() },
        );
        return res.data;
    },

    quizDetail: async (id: string): Promise<QuizDetailPublic> => {
        const res = await axios.get<QuizDetailPublic>(
            `${API_URL}/education/quiz/${encodeURIComponent(id)}`,
            { headers: entetesOptionnelles() },
        );
        return res.data;
    },

    soumettreQuiz: async (
        id: string,
        reponses: { question_id: number; choix: number }[],
    ): Promise<ResultatQuizPublic> => {
        const res = await axios.post<ResultatQuizPublic>(
            `${API_URL}/education/quiz/${encodeURIComponent(id)}/soumettre`,
            { reponses },
            { headers: entetesOptionnelles() },
        );
        return res.data;
    },
};
