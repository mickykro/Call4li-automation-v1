import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Settings, Power, AlertCircle, CheckCircle, Clock, Loader, Search } from 'lucide-react';

interface Business {
  id: string;
  name: string;
  email: string;
  phone: string;
  plan: 'Basic' | 'Premium';
  status: 'active' | 'pending' | 'suspended';
  followMeVerified: boolean;
  createdAt: Date;
  lastActive: Date;
}

export const AdminPanel: React.FC = () => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'pending' | 'suspended'>('all');
  const [suspendingId, setSuspendingId] = useState<string | null>(null);

  // Load all businesses
  useEffect(() => {
    const q = query(collection(db, 'businesses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const businessList: Business[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        businessList.push({
          id: doc.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          plan: data.plan || 'Basic',
          status: data.status || 'active',
          followMeVerified: data.followMeVerified || false,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastActive: data.lastActive?.toDate() || new Date(),
        });
      });

      // Sort by creation date (newest first)
      businessList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setBusinesses(businessList);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const filteredBusinesses = businesses.filter((business) => {
    const matchesSearch =
      business.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      business.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      business.phone.includes(searchTerm);

    const matchesStatus = filterStatus === 'all' || business.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleSuspend = async (businessId: string) => {
    if (!window.confirm('Are you sure you want to suspend this business? This will disable their AI bot.')) {
      return;
    }

    try {
      setSuspendingId(businessId);
      const businessRef = doc(db, 'businesses', businessId);
      await updateDoc(businessRef, {
        status: 'suspended',
        suspendedAt: new Date(),
      });
    } catch (error) {
      console.error('Error suspending business:', error);
      alert('Failed to suspend business');
    } finally {
      setSuspendingId(null);
    }
  };

  const handleActivate = async (businessId: string) => {
    try {
      setSuspendingId(businessId);
      const businessRef = doc(db, 'businesses', businessId);
      await updateDoc(businessRef, {
        status: 'active',
      });
    } catch (error) {
      console.error('Error activating business:', error);
      alert('Failed to activate business');
    } finally {
      setSuspendingId(null);
    }
  };

  const stats = {
    total: businesses.length,
    active: businesses.filter((b) => b.status === 'active').length,
    pending: businesses.filter((b) => b.status === 'pending').length,
    suspended: businesses.filter((b) => b.status === 'suspended').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Settings className="w-8 h-8 mr-3 text-green-600" />
            Admin Control Panel
          </h1>
          <p className="text-gray-600 mt-1">Manage all Call4li businesses</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Businesses" value={stats.total} color="blue" />
        <StatCard label="Active" value={stats.active} color="green" />
        <StatCard label="Pending Setup" value={stats.pending} color="yellow" />
        <StatCard label="Suspended" value={stats.suspended} color="red" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, or phone..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Businesses Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Business</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Follow-Me</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Last Active</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBusinesses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No businesses found
                  </td>
                </tr>
              ) : (
                filteredBusinesses.map((business) => (
                  <tr key={business.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">{business.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{business.id}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="text-gray-900">{business.email}</p>
                        <p className="text-gray-600">{business.phone}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          business.plan === 'Premium'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {business.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={business.status} />
                    </td>
                    <td className="px-6 py-4">
                      {business.followMeVerified ? (
                        <span className="flex items-center text-green-600 text-sm font-semibold">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Verified
                        </span>
                      ) : (
                        <span className="flex items-center text-orange-600 text-sm font-semibold">
                          <Clock className="w-4 h-4 mr-1" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {business.lastActive.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {business.status === 'suspended' ? (
                          <button
                            onClick={() => handleActivate(business.id)}
                            disabled={suspendingId === business.id}
                            className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-semibold hover:bg-green-200 transition disabled:opacity-50"
                          >
                            {suspendingId === business.id ? 'Activating...' : 'Activate'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSuspend(business.id)}
                            disabled={suspendingId === business.id}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-semibold hover:bg-red-200 transition disabled:opacity-50 flex items-center"
                          >
                            {suspendingId === business.id ? (
                              <>
                                <Loader className="w-3 h-3 mr-1 animate-spin" />
                                Suspending...
                              </>
                            ) : (
                              <>
                                <Power className="w-3 h-3 mr-1" />
                                Suspend
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboarding Audit Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
          <AlertCircle className="w-6 h-6 mr-2 text-orange-600" />
          Onboarding Audit
        </h2>

        <div className="space-y-3">
          {businesses
            .filter((b) => b.status === 'pending' && !b.followMeVerified)
            .slice(0, 5)
            .map((business) => (
              <div key={business.id} className="flex items-center justify-between p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div>
                  <p className="font-semibold text-gray-900">{business.name}</p>
                  <p className="text-sm text-gray-600">Waiting for Follow-Me verification</p>
                </div>
                <span className="text-xs font-semibold text-orange-700 bg-orange-100 px-3 py-1 rounded-full">
                  Pending
                </span>
              </div>
            ))}

          {businesses.filter((b) => b.status === 'pending' && !b.followMeVerified).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-400" />
              <p>All businesses have completed Follow-Me verification!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'yellow' | 'red';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  };

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color]}`}>
      <p className="text-sm font-medium mb-1">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
};

interface StatusBadgeProps {
  status: 'active' | 'pending' | 'suspended';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const statusConfig = {
    active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
    suspended: { bg: 'bg-red-100', text: 'text-red-800', label: 'Suspended' },
  };

  const config = statusConfig[status];

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};
