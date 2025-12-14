/**
 * ProtectedRoute Component
 *
 * Protects routes that require authentication
 * Redirects to login if user is not authenticated
 * Shows loading state while checking auth
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LoginPage from './LoginPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  onSwitchToSetup?: () => void;
}

export default function ProtectedRoute({ children, onSwitchToSetup }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onSwitchToSetup={onSwitchToSetup} />;
  }

  // User is authenticated, render protected content
  return <>{children}</>;
}
