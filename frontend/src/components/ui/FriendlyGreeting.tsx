'use client';

import { useEffect, useState } from 'react';

interface FriendlyGreetingProps {
  firstName: string;
}

interface GreetingData {
  message: string;
  icon: string;
  emoji: string;
}

export default function FriendlyGreeting({ firstName }: FriendlyGreetingProps) {
  const [greeting, setGreeting] = useState<GreetingData>({ message: '', icon: '', emoji: '' });

  useEffect(() => {
    const getTimeBasedGreeting = (): GreetingData => {
      const now = new Date();
      const hour = now.getHours();
      
      // Morning greetings (5 AM - 11 AM)
      if (hour >= 5 && hour < 12) {
        const morningGreetings = [
          { message: `Good morning, ${firstName}!`, emoji: '👋' },
          { message: `Rise and shine, ${firstName}!`, emoji: '🌅' },
          { message: `Morning sunshine, ${firstName}!`, emoji: '☀️' },
          { message: `Hey there, ${firstName}! Ready to seize the day?`, emoji: '👋' },
          { message: `Good morning, ${firstName}! Hope you slept well!`, emoji: '😊' },
          { message: `Hello ${firstName}! What a beautiful morning!`, emoji: '🌤️' }
        ];
        const selected = morningGreetings[Math.floor(Math.random() * morningGreetings.length)];
        return { ...selected, icon: '👋' };
      }
      
      // Afternoon greetings (12 PM - 5 PM)
      if (hour >= 12 && hour < 17) {
        const afternoonGreetings = [
          { message: `Good afternoon, ${firstName}!`, emoji: '👋' },
          { message: `Hey ${firstName}! Hope your day is going well!`, emoji: '😄' },
          { message: `Afternoon, ${firstName}! Keep up the great work!`, emoji: '💪' },
          { message: `Hi there, ${firstName}! Perfect time to get things done!`, emoji: '⚡' },
          { message: `Hello ${firstName}! How's your day treating you?`, emoji: '👋' },
          { message: `Hey ${firstName}! Hope you're having a fantastic afternoon!`, emoji: '🌞' }
        ];
        const selected = afternoonGreetings[Math.floor(Math.random() * afternoonGreetings.length)];
        return { ...selected, icon: '👋' };
      }
      
      // Evening greetings (6 PM - 9 PM)
      if (hour >= 17 && hour < 22) {
        const eveningGreetings = [
          { message: `Good evening, ${firstName}!`, emoji: '👋' },
          { message: `Evening, ${firstName}! Time to wind down?`, emoji: '🌅' },
          { message: `Hey ${firstName}! Hope you had a productive day!`, emoji: '✨' },
          { message: `Good evening, ${firstName}! Almost time to relax!`, emoji: '🌆' },
          { message: `Hi there, ${firstName}! How did your day go?`, emoji: '👋' },
          { message: `Evening ${firstName}! Ready to wrap up the day?`, emoji: '🌙' }
        ];
        const selected = eveningGreetings[Math.floor(Math.random() * eveningGreetings.length)];
        return { ...selected, icon: '👋' };
      }
      
      // Night owl greetings (10 PM - 4 AM)
      const nightGreetings = [
        { message: `Hey there, night owl ${firstName}!`, emoji: '🦉' },
        { message: `Working late, ${firstName}? You're dedicated!`, emoji: '🦉' },
        { message: `Hey night owl! Still going strong, ${firstName}?`, emoji: '🌙' },
        { message: `Burning the midnight oil, ${firstName}?`, emoji: '🦉' },
        { message: `Hey there ${firstName}! The night is young!`, emoji: '⭐' },
        { message: `Hello night warrior, ${firstName}!`, emoji: '🦉' },
        { message: `Hey ${firstName}! Hope you're not working too hard this late!`, emoji: '🌃' }
      ];
      const selected = nightGreetings[Math.floor(Math.random() * nightGreetings.length)];
      return { ...selected, icon: '🦉' };
    };

    const getTimePeriod = () => {
      const now = new Date();
      const hour = now.getHours();
      if (hour >= 5 && hour < 12) return 'morning';
      if (hour >= 12 && hour < 17) return 'afternoon';
      if (hour >= 17 && hour < 22) return 'evening';
      return 'night';
    };

    const today = new Date().toDateString();
    const currentPeriod = getTimePeriod();
    const storageKey = `greeting-${firstName}`;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const savedData = JSON.parse(saved);
        // Use saved greeting if it's the same day and time period
        if (savedData.date === today && savedData.period === currentPeriod && savedData.greeting) {
          setGreeting(savedData.greeting);
          return;
        }
      }
    } catch (e) {
      // If localStorage fails, just continue with new greeting
    }

    // Generate new greeting and save it
    const newGreeting = getTimeBasedGreeting();
    setGreeting(newGreeting);
    
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        date: today,
        period: currentPeriod,
        greeting: newGreeting
      }));
    } catch (e) {
      // If localStorage fails, continue without saving
    }
  }, [firstName]);

  if (!greeting.message) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-lg border border-blue-100 dark:border-gray-600 shadow-sm transition-all duration-200">
      <div className="text-2xl" role="img" aria-label="greeting icon">
        {greeting.emoji}
      </div>
      <div>
        <p className="text-base font-medium text-gray-800 dark:text-gray-100">
          {greeting.message}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          Welcome to Weekly Reports
        </p>
      </div>
    </div>
  );
}