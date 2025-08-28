'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

const publicRoutes = ['/login', '/register', '/reset-password'];

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
      
      if (!user && !isPublicRoute) {
        // User is not authenticated and trying to access protected route
        router.push('/login');
      } else if (user && pathname === '/login') {
        // User is authenticated but on login/verify page
        router.push('/');
      }
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login/verify pages even when not authenticated
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  if (!user && isPublicRoute) {
    return <>{children}</>;
  }

  // Show protected content only when authenticated
  if (user && !isPublicRoute) {
    return <>{children}</>;
  }

  // Fallback loading state while redirecting
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <Loader className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Redirecting...</p>
      </div>
    </div>
  );
}