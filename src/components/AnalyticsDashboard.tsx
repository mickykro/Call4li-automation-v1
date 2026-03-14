import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Activity, Phone, Clock, AlertCircle, TrendingUp } from 'lucide-react';

interface AnalyticsDashboardProps {
  businessId: string | null;
}

interface CallData {
  date: string;
  missedCalls: number;
  handledCalls: number;
}

interface CallbackTask {
  id: string;
  customerName: string;
  callbackTime: Date;
  status: 'pending' | 'completed' | 'missed';
}

interface StatusBadgeProps {
  isActive: boolean;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ businessId }) => {
  const [isLive, setIsLive] = useState(false);
  const [callData, setCallData] = useState<CallData[]>([]);
  const [callbackTasks, setCallbackTasks] = useState<CallbackTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCalls: 0,
    missedCalls: 0,
    handledCalls: 0,
    averageResponseTime: 0,
  });

  // Monitor live status
  useEffect(() => {
    if (!businessId) return;

    const businessRef = doc(db, 'businesses', businessId);
    const unsubscribe = onSnapshot(businessRef, (snapshot) => {
      if (snapshot.exists()) {
        setIsLive(snapshot.data().followMeActive === true);
      }
    });

    return unsubscribe;
  }, [businessId]);

  // Load call data for the last 7 days
  useEffect(() => {
    if (!businessId) return;

    const generateMockData = () => {
      const data: CallData[] = [];
      const today = new Date();

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        data.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          missedCalls: Math.floor(Math.random() * 15) + 2,
          handledCalls: Math.floor(Math.random() * 25) + 5,
        });
      }

      return data;
    };

    setCallData(generateMockData());

    // Calculate stats
    const totalMissed = generateMockData().reduce((sum, d) => sum + d.missedCalls, 0);
    const totalHandled = generateMockData().reduce((sum, d) => sum + d.handledCalls, 0);

    setStats({
      totalCalls: totalMissed + totalHandled,
      missedCalls: totalMissed,
      handledCalls: totalHandled,
      averageResponseTime: Math.floor(Math.random() * 30) + 10,
    });

    setLoading(false);
  }, [businessId]);

  // Load callback tasks
  useEffect(() => {
    if (!businessId) return;

    const q = query(
      collection(db, 'callbacks'),
      where('businessId', '==', businessId),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasks: CallbackTask[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        tasks.push({
          id: doc.id,
          customerName: data.customerName,
          callbackTime: data.callbackTime?.toDate() || new Date(),
          status: data.status,
        });
      });

      // Sort by callback time
      tasks.sort((a, b) => a.callbackTime.getTime() - b.callbackTime.getTime());
      setCallbackTasks(tasks.slice(0, 5)); // Show top 5
    });

    return unsubscribe;
  }, [businessId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-600">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Badge */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatusCard
          icon={<Activity className="w-6 h-6" />}
          label="System Status"
          value={isLive ? 'Live' : 'Disconnected'}
          color={isLive ? 'green' : 'red'}
        />
        <StatusCard
          icon={<Phone className="w-6 h-6" />}
          label="Total Calls (7 days)"
          value={stats.totalCalls.toString()}
          color="blue"
        />
        <StatusCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Handled Calls"
          value={stats.handledCalls.toString()}
          color="green"
        />
        <StatusCard
          icon={<AlertCircle className="w-6 h-6" />}
          label="Missed Calls"
          value={stats.missedCalls.toString()}
          color="orange"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Volume Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Call Volume (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={callData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="handledCalls" fill="#10b981" name="Handled Calls" />
              <Bar dataKey="missedCalls" fill="#ef4444" name="Missed Calls" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Callback Queue */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-green-600" />
              Upcoming Callbacks
            </h3>
            <span className="bg-green-100 text-green-800 text-sm font-semibold px-3 py-1 rounded-full">
              {callbackTasks.length} pending
            </span>
          </div>

          {callbackTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No pending callbacks</p>
            </div>
          ) : (
            <div className="space-y-3">
              {callbackTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <p className="font-semibold text-gray-900">{task.customerName}</p>
                    <p className="text-sm text-gray-600">
                      {task.callbackTime.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Performance Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            label="Average Response Time"
            value={`${stats.averageResponseTime}s`}
            description="Time to handle incoming calls"
          />
          <MetricCard
            label="Call Handling Rate"
            value={`${Math.round((stats.handledCalls / stats.totalCalls) * 100)}%`}
            description="Percentage of calls handled"
          />
          <MetricCard
            label="Uptime"
            value={isLive ? '100%' : '0%'}
            description="System availability"
          />
        </div>
      </div>
    </div>
  );
};

interface StatusCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'green' | 'red' | 'blue' | 'orange';
}

const StatusCard: React.FC<StatusCardProps> = ({ icon, label, value, color }) => {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
  };

  const iconColorClasses = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    orange: 'text-orange-600',
  };

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">{label}</p>
        <div className={iconColorClasses[color]}>{icon}</div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: string;
  description: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, description }) => {
  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
};
