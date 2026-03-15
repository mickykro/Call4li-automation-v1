import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from 'recharts';
import { Activity, CheckCircle2, Clock, Database, Loader, PhoneOff, PhoneOutgoing } from 'lucide-react';

type Conversation = {
  id: string;
  status?: string;
  lastMessageTime?: Date | null;
  messages?: Array<{
    senderId: string;
    timestamp?: Date | { toDate?: () => Date } | string;
  }>;
};

type Callback = {
  id: string;
  customerName?: string;
  callbackTime?: Date | null;
  status?: 'pending' | 'completed' | 'missed';
};

interface AnalyticsDashboardProps {
  businessId: string | null;
}

type StatusBadge = 'ok' | 'warn' | 'error';

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const formatDuration = (ms: number) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (ms <= 0) return 'N/A';
  if (minutes === 0) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}m`;
};

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ businessId }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [callbacks, setCallbacks] = useState<Callback[]>([]);
  const [businessStatus, setBusinessStatus] = useState<{ followMeActive?: boolean; followMeVerified?: boolean; uptime?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'conversations'), where('businessId', '==', businessId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Conversation[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            status: data.status,
            lastMessageTime: toDate(data.lastMessageTime),
            messages: data.messages || [],
          });
        });
        setConversations(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading conversations', err);
        setError('Failed to load analytics data');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [businessId]);

  useEffect(() => {
    if (!businessId) {
      setCallbacks([]);
      return;
    }

    const q = query(
      collection(db, 'callbacks'),
      where('businessId', '==', businessId),
      orderBy('callbackTime', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Callback[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          customerName: data.customerName,
          callbackTime: toDate(data.callbackTime),
          status: data.status,
        });
      });
      setCallbacks(list);
    });

    return unsubscribe;
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    const ref = doc(db, 'businesses', businessId);
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setBusinessStatus({
          followMeActive: data.followMeActive,
          followMeVerified: data.followMeVerified,
          uptime: data.uptimePercent,
        });
      }
    });
    return unsubscribe;
  }, [businessId]);

  const last7DaysBuckets = useMemo(() => {
    const today = new Date();
    const buckets = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - idx));
      return { key: d.toDateString(), label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), count: 0 };
    });

    conversations.forEach((conv) => {
      const ts = conv.lastMessageTime;
      if (!ts) return;
      const diffDays = Math.floor((today.getTime() - ts.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < 7) {
        const index = 6 - diffDays;
        buckets[index].count += 1;
      }
    });
    return buckets;
  }, [conversations]);

  const totals = useMemo(() => {
    const recentConvs = conversations.filter((c) => {
      if (!c.lastMessageTime) return false;
      return Date.now() - c.lastMessageTime.getTime() <= 7 * 86400000;
    });

    const totalCalls = recentConvs.length;
    const handled = recentConvs.filter((c) => c.status && c.status !== 'pending').length;
    const missed = totalCalls - handled;

    const responseDurations: number[] = [];
    recentConvs.forEach((conv) => {
      const messages = conv.messages || [];
      const firstCustomer = messages.find((m) => m.senderId !== businessId);
      if (!firstCustomer) return;
      const customerTime = toDate(firstCustomer.timestamp);
      if (!customerTime) return;
      const firstReply = messages.find((m) => {
        if (m.senderId !== businessId) return false;
        const rt = toDate(m.timestamp);
        return rt ? rt.getTime() > customerTime.getTime() : false;
      });
      if (!firstReply) return;
      const replyTime = toDate(firstReply.timestamp);
      if (!replyTime) return;
      responseDurations.push(replyTime.getTime() - customerTime.getTime());
    });

    const avgResponseMs = responseDurations.length
      ? responseDurations.reduce((a, b) => a + b, 0) / responseDurations.length
      : 0;

    const handlingRate = totalCalls === 0 ? 0 : Math.round((handled / totalCalls) * 100);

    return { totalCalls, handled, missed, avgResponseMs, handlingRate };
  }, [conversations, businessId]);

  const statusBadge: StatusBadge = useMemo(() => {
    const active = businessStatus?.followMeActive;
    const verified = businessStatus?.followMeVerified;
    if (active && verified) return 'ok';
    if (!active && !verified) return 'error';
    return 'warn';
  }, [businessStatus]);

  const uptime = businessStatus?.uptime ?? 99.5;

  const handleCallbackStatus = async (callback: Callback, status: 'completed' | 'missed') => {
    if (!businessId) return;
    try {
      await updateDoc(doc(db, 'callbacks', callback.id), { status });
    } catch (err) {
      console.error('Error updating callback status', err);
    }
  };

  if (!businessId) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm text-center text-gray-700">
        Connect a business to view analytics.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="System Status"
          value={statusBadge === 'ok' ? 'Online' : statusBadge === 'warn' ? 'Attention' : 'Offline'}
          icon={<Activity className="w-5 h-5" />}
          badge={statusBadge}
          helper={
            businessStatus?.followMeVerified
              ? 'Follow-Me verified'
              : 'Follow-Me pending verification'
          }
        />
        <StatCard
          label="Calls (7d)"
          value={totals.totalCalls.toString()}
          icon={<Database className="w-5 h-5" />}
          helper="Conversations seen in last 7 days"
        />
        <StatCard
          label="Handled"
          value={totals.handled.toString()}
          icon={<PhoneOutgoing className="w-5 h-5" />}
          helper="Status not pending"
        />
        <StatCard
          label="Missed"
          value={totals.missed.toString()}
          icon={<PhoneOff className="w-5 h-5" />}
          helper="Pending conversations"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Call Volume (Last 7 Days)</h3>
            <span className="text-sm text-gray-500">Live</span>
          </div>
          <div className="h-64">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-600">
                <Loader className="w-6 h-6 animate-spin mr-2" /> Loading...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={last7DaysBuckets} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" stroke="#6b7280" />
                  <YAxis allowDecimals={false} stroke="#6b7280" />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Handling Rate</h3>
            <span className="text-sm text-gray-500">{totals.handlingRate}%</span>
          </div>
          <div className="h-64">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-600">
                <Loader className="w-6 h-6 animate-spin mr-2" /> Loading...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{ name: 'Calls', handled: totals.handled, missed: totals.missed }]}
                  margin={{ left: -10, right: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" />
                  <YAxis allowDecimals={false} stroke="#6b7280" />
                  <Tooltip />
                  <Bar dataKey="handled" stackId="calls" fill="#16a34a" name="Handled" />
                  <Bar dataKey="missed" stackId="calls" fill="#ef4444" name="Missed" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-2">Handled vs missed conversations based on status.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Response Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {totals.avgResponseMs ? formatDuration(totals.avgResponseMs) : 'N/A'}
              </p>
            </div>
            <Clock className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-sm text-gray-600">Calculated from customer message to first business reply.</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">System Uptime</p>
              <p className="text-2xl font-bold text-gray-900">{uptime.toFixed(2)}%</p>
            </div>
            <Activity className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-sm text-gray-600">Configured on business doc (uptimePercent).</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Callbacks</p>
              <p className="text-2xl font-bold text-gray-900">
                {callbacks.filter((c) => c.status === 'pending').length}
              </p>
            </div>
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-sm text-gray-600">Callbacks waiting to be completed.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Callback Queue</h3>
          <span className="text-sm text-gray-600">Live sync</span>
        </div>
        {callbacks.length === 0 ? (
          <div className="p-6 text-center text-gray-600">No callbacks scheduled.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {callbacks.map((cb) => (
              <div key={cb.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{cb.customerName || 'Customer'}</p>
                  <p className="text-sm text-gray-600">
                    {cb.callbackTime ? cb.callbackTime.toLocaleString() : 'No time set'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      cb.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : cb.status === 'missed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {cb.status || 'pending'}
                  </span>
                  {cb.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleCallbackStatus(cb, 'completed')}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                      >
                        Complete
                      </button>
                      <button
                        onClick={() => handleCallbackStatus(cb, 'missed')}
                        className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                      >
                        Missed
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  helper?: string;
  badge?: StatusBadge;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, helper, badge }) => (
  <div className="bg-white rounded-lg shadow p-4">
    <div className="flex items-center justify-between mb-2">
      <p className="text-sm text-gray-600">{label}</p>
      <span className="text-gray-500">{icon}</span>
    </div>
    <div className="flex items-baseline gap-2">
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {badge && <Badge type={badge} />}
    </div>
    {helper && <p className="text-sm text-gray-600 mt-1">{helper}</p>}
  </div>
);

const Badge: React.FC<{ type: StatusBadge }> = ({ type }) => {
  const styles: Record<StatusBadge, string> = {
    ok: 'bg-green-100 text-green-800',
    warn: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
  };
  const labels: Record<StatusBadge, string> = {
    ok: 'OK',
    warn: 'Check',
    error: 'Offline',
  };
  return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${styles[type]}`}>{labels[type]}</span>;
};
