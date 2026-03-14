import { useAuth } from '../contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PhoneMissed, MessageCircle, Clock, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';

// Mock data for the chart
const mockChartData = [
    { name: 'Mon', calls: 12 },
    { name: 'Tue', calls: 19 },
    { name: 'Wed', calls: 15 },
    { name: 'Thu', calls: 22 },
    { name: 'Fri', calls: 28 },
    { name: 'Sat', calls: 40 },
    { name: 'Sun', calls: 35 },
];

export const Overview = () => {
    const { businessData } = useAuth();
    const [stats, setStats] = useState({
        missedCalls: 0,
        activeChats: 0,
        pendingCallbacks: 0,
    });

    // In a real app we'd fetch these from Firestore, here we mock it for the shell
    useEffect(() => {
        setStats({
            missedCalls: 12,
            activeChats: 5,
            pendingCallbacks: 3,
        });
    }, []);

    const isFollowMeActive = businessData?.followMeActive === true;

    return (
        <div className="p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                        Overview
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Here's what's happening with Forli today.
                    </p>
                </div>

                {/* Live Status Indicator */}
                <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 px-4 py-2 rounded-full border border-gray-200 dark:border-zinc-800 shadow-sm">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Follow-Me Status:
                    </span>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isFollowMeActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${isFollowMeActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        {isFollowMeActive ? 'Active' : 'Inactive'}
                    </div>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Missed Calls</h3>
                        <PhoneMissed className="w-5 h-5 text-indigo-500" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-4">{stats.missedCalls}</p>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                        <Activity className="w-4 h-4" /> +2% from yesterday
                    </p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Chats</h3>
                        <MessageCircle className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-4">{stats.activeChats}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Currently talking to Forli</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Callbacks</h3>
                        <Clock className="w-5 h-5 text-amber-500" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-4">{stats.pendingCallbacks}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Require your attention</p>
                </div>
            </div>

            {/* Charts */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Calls per Day (Last 7 Days)</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={mockChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-200 dark:text-zinc-800" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#6b7280', fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#6b7280', fontSize: 12 }}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    borderRadius: '8px',
                                    border: '1px solid #e5e7eb',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                                itemStyle={{ color: '#111827', fontWeight: 'bold' }}
                            />
                            <Bar
                                dataKey="calls"
                                fill="#6366f1"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={50}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
