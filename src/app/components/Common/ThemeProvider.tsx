import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

export type Theme = 'light' | 'dark';

type ThemeContextValue = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'light',
    setTheme: () => {},
});

const STORAGE_KEY = 'si-education-theme';

/**
 * La landing est conçue uniquement en thème clair : on ignore la préférence
 * système (et un ancien choix stocké), sinon la classe `dark` assombrit des
 * sections qui n'ont pas de fond propre.
 */
const readInitialTheme = (): Theme => 'light';

/**
 * Gestion du theme clair/sombre.
 * Remplace `next-themes` : la classe `dark` est posee sur <html>,
 * ce que Tailwind attend via `@custom-variant dark (&:is(.dark *))`.
 */
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [theme, setTheme] = useState<Theme>(readInitialTheme);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', theme === 'dark');
        root.style.colorScheme = theme;
        window.localStorage.setItem(STORAGE_KEY, theme);
    }, [theme]);

    const setThemeValue = useCallback((next: Theme) => setTheme(next), []);

    const value = useMemo(
        () => ({ theme, setTheme: setThemeValue }),
        [theme, setThemeValue],
    );

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
