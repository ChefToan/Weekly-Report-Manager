'use client';

import { useState, useEffect } from 'react';
import ProgressStats from '@/components/dashboard/ProgressStats';
import ResidentsGrid from '@/components/residents/ResidentsGrid';
import WeeklyReportGenerator from '@/components/reports/WeeklyReportGenerator';
import UserList from '@/components/admin/UserList';
import CodeGenerator from '@/components/admin/CodeGenerator';
import AppleStyleNavBar from '@/components/navigation/AppleStyleNavBar';
import ThemeToggle from '@/components/ui/ThemeToggle';
import FriendlyGreeting from '@/components/ui/FriendlyGreeting';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, User as UserIcon, Users, Key } from 'lucide-react';

type TabType = 'dashboard' | 'residents' | 'reports' | 'admin';
type AdminTabType = 'users' | 'codes';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [adminActiveTab, setAdminActiveTab] = useState<AdminTabType>('users');
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const { user, logout } = useAuth();

  // Load saved tab state from localStorage on mount
  useEffect(() => {
    const savedTab = localStorage.getItem('activeTab') as TabType;
    const savedAdminTab = localStorage.getItem('adminActiveTab') as AdminTabType;
    
    if (savedTab && ['dashboard', 'residents', 'reports', 'admin'].includes(savedTab)) {
      setActiveTab(savedTab);
    }
    
    if (savedAdminTab && ['users', 'codes'].includes(savedAdminTab)) {
      setAdminActiveTab(savedAdminTab);
    }
  }, []);

  const handleInteractionUpdate = () => {
    setStatsRefreshTrigger(prev => prev + 1);
  };

  const handleTabChange = (newTab: TabType) => {
    setActiveTab(newTab);
    localStorage.setItem('activeTab', newTab);
  };

  // For admin users, show only user management
  if (user?.role === 'admin') {
    const adminNavigation = [
      { id: 'users', name: 'User Management', icon: Users },
      { id: 'codes', name: 'Registration Codes', icon: Key },
    ];

    const renderAdminContent = () => {
      switch (adminActiveTab) {
        case 'users':
          return <UserList />;
        case 'codes':
          return <CodeGenerator />;
        default:
          return <UserList />;
      }
    };

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header with User Info and Navigation */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between py-4">
              {/* User Info */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-maroon-600 rounded-full flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Administrator
                  </p>
                </div>
              </div>

              {/* Admin Navigation */}
              <div className="flex-1 flex justify-center">
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full px-2 py-2 flex items-center space-x-1 shadow-lg border border-gray-200 dark:border-gray-600">
                  {adminNavigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = adminActiveTab === item.id;
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          const newAdminTab = item.id as AdminTabType;
                          setAdminActiveTab(newAdminTab);
                          localStorage.setItem('adminActiveTab', newAdminTab);
                        }}
                        className={`
                          flex items-center space-x-2 rounded-full transition-all duration-200 hover:scale-105
                          ${isActive 
                            ? 'bg-blue-500 text-white px-6 py-3 shadow-lg' 
                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 p-3'
                          }
                        `}
                      >
                        <Icon className="h-5 w-5" />
                        {isActive && <span className="text-sm font-medium">{item.name}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Theme Toggle and Logout */}
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <button
                  onClick={logout}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main content area with top padding */}
        <main className="pt-24">
          <div className="p-6">
            <div className="max-w-7xl mx-auto">
              {renderAdminContent()}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <FriendlyGreeting firstName={user?.first_name || 'Friend'} />
            <ProgressStats key={statsRefreshTrigger} />
          </div>
        );

      case 'residents':
        return (
          <div className="space-y-6">
            <ResidentsGrid
              onInteractionUpdate={handleInteractionUpdate}
            />
          </div>
        );

      case 'reports':
        return (
          <div className="space-y-6">
            <WeeklyReportGenerator onInteractionUpdate={handleInteractionUpdate} />
          </div>
        );


      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with Navigation and User Info */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            {/* User Info */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-maroon-600 rounded-full flex items-center justify-center">
                <UserIcon className="h-5 w-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {user?.email}
                </p>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 flex justify-center">
              <AppleStyleNavBar 
                activeTab={activeTab}
                onTabChange={handleTabChange}
                isAdmin={user ? (user.role as 'admin' | 'user') === 'admin' : false}
              />
            </div>

            {/* Theme Toggle and Logout */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={logout}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area with top padding */}
      <main className="pt-24">
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}
