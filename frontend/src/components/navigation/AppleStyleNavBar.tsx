'use client';

import { Home, Users, FileText, Settings } from 'lucide-react';
type TabType = 'dashboard' | 'residents' | 'reports' | 'admin';

interface AppleStyleNavBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isAdmin?: boolean;
}

export default function AppleStyleNavBar({ activeTab, onTabChange, isAdmin }: AppleStyleNavBarProps) {
  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: Home },
    { id: 'residents', name: 'Residents', icon: Users },
    { id: 'reports', name: 'Reports', icon: FileText },
    ...(isAdmin ? [{ id: 'admin', name: 'User Management', icon: Settings }] : []),
  ];

  return (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full px-2 py-2 flex items-center space-x-1 shadow-lg border border-gray-200 dark:border-gray-600">
      {/* Navigation buttons - all in fixed positions */}
      {navigation.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id as TabType)}
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
  );
}
