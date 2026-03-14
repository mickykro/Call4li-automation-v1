import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { DashboardLayout } from './components/layout/DashboardLayout';
import Simulator from './pages/Simulator';

import { Overview } from './pages/Overview';
import { Conversations } from './pages/Conversations';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { ThemeProvider } from './contexts/ThemeContext';

const Settings = () => <div className="p-8"><h1 className="text-2xl font-bold dark:text-white">Settings</h1></div>;

function App() {
    return (
        <ThemeProvider>
            <BrowserRouter>
                <AuthProvider>
                    <Routes>
                        <Route path="/login" element={<Login />} />

                        {/* The Simulator path is unprotected for testing and presentation purposes if needed */}
                        <Route path="/simulator" element={<Simulator />} />

                        <Route element={<ProtectedRoute />}>
                            <Route element={<DashboardLayout />}>
                                <Route path="/" element={<Overview />} />
                                <Route path="/conversations" element={<Conversations />} />
                                <Route path="/knowledge" element={<KnowledgeBase />} />
                                <Route path="/settings" element={<Settings />} />
                            </Route>
                        </Route>

                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </AuthProvider>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;
