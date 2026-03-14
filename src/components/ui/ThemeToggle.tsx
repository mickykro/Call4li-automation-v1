
import { useTheme } from '../../contexts/ThemeContext';
import { Moon as LucideMoon, Sun as LucideSun } from 'lucide-react';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    return (
        <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
            title="Toggle theme"
        >
            <span className="sr-only">Toggle theme</span>
            {theme === 'light' ? <LucideMoon className="w-5 h-5" /> : <LucideSun className="w-5 h-5" />}
        </button>
    );
}
