import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ConversationsView } from '../components/ConversationsView';
import { FAQManager } from '../components/FAQManager';
import { CatalogManager } from '../components/CatalogManager';
import { OpeningHoursSelector } from '../components/OpeningHoursSelector';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { AdminPanel } from '../components/AdminPanel';
import { MessageCircle, Settings, BarChart3, Users, LogOut, Menu, X } from 'lucide-react';

type TabType = 'conversations' | 'faq' | 'catalog' | 'hours' | 'analytics' | 'admin';

export const DashboardPage: React.FC = () => {
  const { user, logout, businessId } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('conversations');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isAdmin = user?.email?.endsWith('@call4li.admin'); // Simple admin check

  const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode; requiresAdmin?: boolean }> = [
    { id: 'conversations', label: 'Live Feed', icon: <MessageCircle className="w-5 h-5" /> },
    { id: 'faq', label: 'FAQ Manager', icon: <Settings className="w-5 h-5" /> },
    { id: 'catalog', label: 'Catalog', icon: <Users className="w-5 h-5" /> },
    { id: 'hours', label: 'Opening Hours', icon: <Settings className="w-5 h-5" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-5 h-5" /> },
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin Panel', icon: <Settings className="w-5 h-5" />, requiresAdmin: true }] : []),
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className={`flex items-center ${!sidebarOpen && 'justify-center w-full'}`}>
            <MessageCircle className="w-8 h-8 text-green-600" />
            {sidebarOpen && <span className="ml-2 font-bold text-gray-900">Call4li</span>}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-gray-100 rounded lg:hidden"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center px-4 py-2 rounded-lg transition ${
                activeTab === tab.id
                  ? 'bg-green-100 text-green-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              title={!sidebarOpen ? tab.label : ''}
            >
              {tab.icon}
              {sidebarOpen && <span className="ml-3">{tab.label}</span>}
            </button>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-gray-200">
          <div className={`${!sidebarOpen && 'text-center'}`}>
            {sidebarOpen && (
              <>
                <p className="text-xs text-gray-600">Logged in as</p>
                <p className="font-semibold text-gray-900 truncate">{user?.phoneNumber}</p>
              </>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`w-full mt-3 flex items-center justify-center px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition ${
              !sidebarOpen && 'p-2'
            }`}
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span className="ml-2">Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {activeTab === 'conversations' && 'Real-time conversation monitoring'}
                {activeTab === 'faq' && 'Manage your FAQ knowledge base'}
                {activeTab === 'catalog' && 'Manage your product catalog'}
                {activeTab === 'hours' && 'Set your business opening hours'}
                {activeTab === 'analytics' && 'View system performance and analytics'}
                {activeTab === 'admin' && 'Manage all businesses'}
              </p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'conversations' && <ConversationsView businessId={businessId} />}
          {activeTab === 'faq' && <FAQManager businessId={businessId} />}
          {activeTab === 'catalog' && <CatalogManager businessId={businessId} />}
          {activeTab === 'hours' && <OpeningHoursSelector businessId={businessId} />}
          {activeTab === 'analytics' && <AnalyticsDashboard businessId={businessId} />}
          {activeTab === 'admin' && <AdminPanel />}
        </div>
      </div>
    </div>
  );
};
