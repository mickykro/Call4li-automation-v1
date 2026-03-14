import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    LayoutDashboard,
    MessageSquare,
    BookOpen,
    Settings,
    LogOut,
    Menu,
    X,
    Bot
} from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { CommandPalette } from '../CommandPalette';

const navigation = [
    { name: 'Overview', href: '/', icon: LayoutDashboard },
    { name: 'Conversations', href: '/conversations', icon: MessageSquare },
    { name: 'Knowledge Base', href: '/knowledge', icon: BookOpen },
    { name: 'Settings', href: '/settings', icon: Settings },
];

export const DashboardLayout = () => {
    const { logout, businessData } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-zinc-950">
            {/* Mobile sidebar */}
            <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
                <div className="fixed inset-0 bg-gray-900/80" onClick={() => setSidebarOpen(false)} />
                <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-zinc-900 flex flex-col">
                    <div className="flex items-center justify-between h-16 px-4 border-b dark:border-zinc-800">
                        <div className="flex items-center gap-2 text-primary font-bold text-xl">
                            <Bot className="w-6 h-6" />
                            Forli Dashboard
                        </div>
                        <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <nav className="flex-1 px-4 py-4 space-y-1">
                        {navigation.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800'
                                    }`
                                }
                            >
                                <item.icon className="w-5 h-5" />
                                {item.name}
                            </NavLink>
                        ))}
                    </nav>
                    <div className="p-4 border-t dark:border-zinc-800">
                        <div className="flex items-center gap-3 px-3 py-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                {businessData?.businessName ? String(businessData.businessName).charAt(0) : 'B'}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {businessData?.businessName || 'Business'}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                            Sign out
                        </button>
                    </div>
                </div>
            </div>

            {/* Desktop sidebar */}
            <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:bg-white dark:lg:bg-zinc-900 dark:lg:border-zinc-800">
                <div className="flex items-center h-16 px-6 border-b dark:border-zinc-800">
                    <div className="flex items-center gap-2 text-primary font-bold text-xl">
                        <Bot className="w-6 h-6" />
                        Forli Dashboard
                    </div>
                </div>
                <nav className="flex-1 px-4 py-4 space-y-1">
                    {navigation.map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.href}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800'
                                }`
                            }
                        >
                            <item.icon className="w-5 h-5" />
                            {item.name}
                        </NavLink>
                    ))}
                </nav>
                <div className="p-4 border-t dark:border-zinc-800">
                    <div className="flex items-center gap-3 px-3 py-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                            {businessData?.businessName ? String(businessData.businessName).charAt(0) : 'B'}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {businessData?.businessName || 'Business'}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign out
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col lg:pl-64 overflow-hidden">
                <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-4 lg:px-8 dark:bg-zinc-900 dark:border-zinc-800">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <div className="flex flex-1 justify-end items-center gap-4">
                        <ThemeToggle />
                    </div>
                </header>
                <main className="flex-1 overflow-auto bg-gray-50 dark:bg-zinc-950">
                    <Outlet />
                    <CommandPalette />
                </main>
            </div>
        </div>
    );
};
