/**
 * Session d'authentification locale.
 *
 * Remplace `next-auth/react`. Le template Next.js d'origine n'avait aucune
 * route d'authentification configuree (aucun handler `[...nextauth]`), donc
 * `signIn('credentials')` ne pouvait aboutir. On conserve exactement la meme
 * signature d'appel (`signIn(provider, options) -> Promise<{ok, error}>`),
 * avec une session stockee dans le localStorage.
 */

export type SignInOptions = {
    email?: string;
    password?: string;
    redirect?: boolean;
    callbackUrl?: string;
    [key: string]: unknown;
};

export type SignInResult = {
    ok: boolean;
    error: string | null;
    status: number;
    url?: string;
};

export type Session = {
    provider: string;
    email: string;
    createdAt: string;
};

const SESSION_KEY = 'si-education-session';

/** Session courante, ou null si l'utilisateur n'est pas connecte. */
export const getSession = (): Session | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(SESSION_KEY);
        return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
        return null;
    }
};

/** Supprime la session locale. */
export const signOut = (): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(SESSION_KEY);
};

/**
 * Ouvre une session. Meme contrat que `next-auth/react` :
 * resout `{ok: true, error: null}` en cas de succes, `{ok: false, error: '...'}`
 * sinon, et rejette sur erreur inattendue.
 */
export const signIn = async (
    provider: string,
    options: SignInOptions = {},
): Promise<SignInResult> => {
    const email = typeof options.email === 'string' ? options.email.trim() : '';
    const password = typeof options.password === 'string' ? options.password : '';

    if (provider === 'credentials' && (!email || !password)) {
        return {
            ok: false,
            error: 'Email and password are required',
            status: 401,
        };
    }

    if (provider === 'email' && !email) {
        return { ok: false, error: 'Email is required', status: 400 };
    }

    if (typeof window !== 'undefined') {
        const session: Session = {
            provider,
            email,
            createdAt: new Date().toISOString(),
        };
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }

    return {
        ok: true,
        error: null,
        status: 200,
        url: options.callbackUrl ?? '/',
    };
};
