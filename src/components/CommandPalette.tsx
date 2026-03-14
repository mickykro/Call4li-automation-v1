import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutDashboard, MessageSquare, BookOpen, Settings } from 'lucide-react';

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const routes = [
        { name: 'Overview', path: '/', icon: LayoutDashboard },
        { name: 'Conversations', path: '/conversations', icon: MessageSquare },
        { name: 'Knowledge Base', path: '/knowledge', icon: BookOpen },
        { name: 'Settings', path: '/settings', icon: Settings },
    ];

    const filteredRoutes = routes.filter((route) =>
        route.name.toLowerCase().includes(query.toLowerCase())
    );

    const handleSelect = (path: string) => {
        navigate(path);
        setOpen(false);
        setQuery('');
    };

    if (!open) return null;

    return (
        <div className="relative z-[100]">
            <div
                className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
                onClick={() => setOpen(false)}
            />

            <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[10vh] px-4 sm:pt-[20vh]">
                <div
                    className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/10"
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="flex items-center border-b dark:border-zinc-800 px-4 py-3">
                        <Search className="w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            className="flex-1 ml-3 bg-transparent border-none focus:ring-0 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none h-8"
                            placeholder="Type a command or search..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            // eslint-disable-next-line jsx-a11y/no-autofocus
                            autoFocus
                        />
                        <kbd className="hidden sm:inline-block px-2 py-1 text-xs text-gray-400 font-mono tracking-widest bg-gray-100 dark:bg-zinc-800 rounded">
                            ESC
                        </kbd>
                    </div>

                    <div className="max-h-72 overflow-y-auto p-2">
                        {filteredRoutes.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                No results found.
                            </div>
                        ) : (
                            <ul className="space-y-1">
                                {filteredRoutes.map((route) => (
                                    <li key={route.path}>
                                        <button
                                            onClick={() => handleSelect(route.path)}
                                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20 dark:hover:text-primary-foreground rounded-md transition-colors"
                                        >
                                            <route.icon className="w-4 h-4 opacity-70" />
                                            {route.name}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
