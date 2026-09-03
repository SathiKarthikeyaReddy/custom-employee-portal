import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert } from 'lucide-react';

export const ProtectedRoute = ({ children, requiredPermission = null }) => {
  const { isAuthenticated, loading, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper text-ink-text">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-stone-400 border-t-forest rounded-full animate-spin"></div>
          <p className="text-xs uppercase tracking-widest font-heading text-stone-500">
            Verifying Credentials...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-12 bg-white border border-border">
        <div className="flex items-start space-x-4">
          <div className="w-10 h-10 bg-amber/10 border border-amber/30 text-amber flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h2 className="font-heading text-lg font-bold text-ink-text uppercase tracking-wide">
              Access Denied: Insufficient Permissions
            </h2>
            <p className="text-sm text-stone-600">
              Your assigned role does not grant permission to view or manage this administrative resource.
            </p>
            <div className="pt-2 text-xs font-mono bg-stone-50 border border-stone-200 px-3 py-1.5 text-stone-600 inline-block">
              Required Permission: <span className="font-bold text-ink-text">{requiredPermission}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
