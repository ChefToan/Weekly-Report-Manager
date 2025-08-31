'use client';

import { useState, useEffect } from 'react';
import { Users, MessageSquare, Target, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import { sortResidentsNeedingAttentionByRoom } from '@/utils/roomSorting';

interface ProgressStats {
  totalResidents: number;
  totalInteractions: number;
  requiredInteractions: number;
  completionPercentage: number;
  interactionsPerResident: { [key: string]: number };
  residentsData: { [key: string]: { name: string; room: string } };
}

export default function ProgressStats() {
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    fetchStats();
    
    // Check for dark mode
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate smooth color transitions based on percentage (0-100)
  const getProgressColors = (percentage: number) => {
    // Clamp percentage between 0 and 100
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    
    let r, g, b;
    
    if (clampedPercentage <= 50) {
      // Red to Orange/Yellow transition (0-50%) - brighter, more vibrant colors
      const factor = clampedPercentage / 50;
      r = Math.round(255 - (45 * factor)); // Red: 255 to 210 (bright red to vibrant orange)
      g = Math.round(65 + (155 * factor)); // Green: 65 to 220 (creates vibrant orange/yellow)
      b = Math.round(20 + (25 * factor)); // Blue stays low but adds warmth
    } else {
      // Orange to Green transition (50-100%) - vibrant transition
      const factor = (clampedPercentage - 50) / 50;
      r = Math.round(210 - (165 * factor)); // Red decreases from 210 to 45 (vibrant orange to bright green)
      g = Math.round(220 + (25 * factor)); // Green increases from 220 to 245 (bright throughout)
      b = Math.round(45 + (75 * factor)); // Blue increases from 45 to 120 (adds vibrancy to green)
    }
    
    // For dark mode, make colors even more vibrant for better visibility
    const darkR = Math.round(Math.min(255, r * 1.15));
    const darkG = Math.round(Math.min(255, g * 1.15));
    const darkB = Math.round(Math.min(255, b * 1.15));
    
    return {
      light: `rgb(${r}, ${g}, ${b})`,
      dark: `rgb(${darkR}, ${darkG}, ${darkB})`,
      lightBg: `rgba(${r}, ${g}, ${b}, 0.12)`,
      darkBg: `rgba(${darkR}, ${darkG}, ${darkB}, 0.20)`,
      lightBorder: `rgba(${r}, ${g}, ${b}, 0.25)`,
      darkBorder: `rgba(${darkR}, ${darkG}, ${darkB}, 0.35)`
    };
  };

  const getResidentsWithMinInteractions = () => {
    if (!stats) return 0;
    return Object.values(stats.interactionsPerResident).filter(count => count >= 3).length;
  };

  const getResidentsNeedingAttention = () => {
    if (!stats) return [];
    return sortResidentsNeedingAttentionByRoom(
      stats.residentsData,
      stats.interactionsPerResident
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Loading Dashboard</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Fetching progress statistics...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
        <p className="text-red-700 dark:text-red-300">Error loading progress statistics</p>
      </div>
    );
  }

  const residentsWithMinInteractions = getResidentsWithMinInteractions();
  const residentsNeedingAttention = getResidentsNeedingAttention();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Residents</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.totalResidents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Interactions</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.totalInteractions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Required This Semester</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.requiredInteractions}</p>
            </div>
          </div>
        </div>

        <div 
          className="p-6 rounded-lg shadow-sm border transition-all duration-300"
          style={{
            backgroundColor: isDarkMode 
              ? getProgressColors(stats.completionPercentage).darkBg 
              : getProgressColors(stats.completionPercentage).lightBg,
            borderColor: isDarkMode 
              ? getProgressColors(stats.completionPercentage).darkBorder 
              : getProgressColors(stats.completionPercentage).lightBorder,
          }}
        >
          <div className="flex items-center">
            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
              <TrendingUp 
                className="h-6 w-6 transition-colors duration-300"
                style={{
                  color: isDarkMode 
                    ? getProgressColors(stats.completionPercentage).dark
                    : getProgressColors(stats.completionPercentage).light
                }}
              />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Progress</p>
              <p 
                className="text-2xl font-semibold transition-colors duration-300"
                style={{
                  color: isDarkMode 
                    ? getProgressColors(stats.completionPercentage).dark
                    : getProgressColors(stats.completionPercentage).light
                }}
              >
                {stats.completionPercentage}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Residents Meeting Requirements</h3>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
              {residentsWithMinInteractions}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              out of {stats.totalResidents} residents have 3+ interactions
            </div>
            <div className="mt-4 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div 
                className="bg-green-600 dark:bg-green-500 h-2 rounded-full transition-all duration-200"
                style={{ width: `${(residentsWithMinInteractions / stats.totalResidents) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Residents Needing Attention</h3>
          </div>
          {residentsNeedingAttention.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500 dark:text-green-400" />
              <p>All residents have met the minimum requirement!</p>
            </div>
          ) : (
            <div className="relative">
              <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-700">
                {residentsNeedingAttention.map(([emplId, count, resident]) => {
                const displayName = resident 
                  ? `${resident.name} (${resident.room || 'No room'})`
                  : `ID: ${emplId}`;
                
                return (
                  <div key={emplId} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {count} interaction{count !== 1 ? 's' : ''}
                      </span>
                      <div className="flex">
                        {[...Array(3)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-3 h-3 rounded-full mr-1 ${
                              i < count ? 'bg-green-500 dark:bg-green-400' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
              {residentsNeedingAttention.length > 5 && (
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white dark:from-gray-800 to-transparent pointer-events-none" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}