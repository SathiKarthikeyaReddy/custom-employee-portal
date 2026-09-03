import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import zohoService from '../services/zohoService';
import AppTile from '../components/AppTile';
import RoleBadge from '../components/RoleBadge';
import { RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';

export const DashboardPage = () => {
  const { user } = useAuth();
  const [appsData, setAppsData] = useState({ authorized: [], locked: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchApps = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await zohoService.getApps();
      setAppsData(data);
    } catch (err) {
      console.error('Error fetching applications:', err);
      setError('Unable to retrieve application registry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  // Combine apps to preserve standard order: People, CRM, Desk, Books
  const allApps = [];
  const appKeysOrder = ['people', 'crm', 'desk', 'books'];

  // Build a lookup of authorized and locked
  const authorizedMap = new Map((appsData.authorized || []).map((app) => [app.key.toLowerCase(), app]));
  const lockedMap = new Map((appsData.locked || []).map((app) => [app.key.toLowerCase(), app]));

  for (const key of appKeysOrder) {
    if (authorizedMap.has(key)) {
      const app = authorizedMap.get(key);
      const status = app.is_provisioned ? 'authorized' : 'pending_setup';
      allApps.push({ app, status });
    } else if (lockedMap.has(key)) {
      const app = lockedMap.get(key);
      allApps.push({ app, status: 'locked' });
    }
  }

  // Add any extra apps not in the default 4 list
  (appsData.authorized || []).forEach((app) => {
    if (!appKeysOrder.includes(app.key.toLowerCase())) {
      allApps.push({
        app,
        status: app.is_provisioned ? 'authorized' : 'pending_setup',
      });
    }
  });
  (appsData.locked || []).forEach((app) => {
    if (!appKeysOrder.includes(app.key.toLowerCase())) {
      allApps.push({ app, status: 'locked' });
    }
  });

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header Profile Banner */}
      <div className="bg-white border border-border p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-heading font-bold uppercase tracking-widest text-stone-500">
            Current Session
          </span>
          <h1 className="text-2xl font-heading font-bold text-ink-text uppercase tracking-tight mt-1">
            Welcome, {user?.name}
          </h1>
          <p className="text-xs text-stone-600 mt-1">
            Your access permissions determine which integrated Zoho One modules you can launch.
          </p>
        </div>

        <div className="flex flex-col md:items-end space-y-2">
          <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-stone-500">
            Assigned Roles
          </span>
          <div className="flex flex-wrap gap-1.5">
            {Array.isArray(user?.roles) && user.roles.length > 0 ? (
              user.roles.map((r, i) => <RoleBadge key={i} role={r} />)
            ) : (
              <span className="text-xs text-stone-400 italic">No roles assigned</span>
            )}
          </div>
        </div>
      </div>

      {/* Directory Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-heading font-bold uppercase tracking-wider text-ink-text">
              Application Directory
            </h2>
            <p className="text-xs text-stone-500">
              Corporate Zoho One suite mapped to your credentials
            </p>
          </div>
          <button
            onClick={fetchApps}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-border text-xs font-semibold uppercase tracking-wider text-stone-700 hover:text-ink hover:bg-stone-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="border border-border bg-white p-12 text-center text-stone-500">
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-6 h-6 border-2 border-stone-400 border-t-forest rounded-full animate-spin"></div>
              <span className="text-xs font-heading uppercase tracking-widest">
                Querying Zoho application catalog...
              </span>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border space-y-3">
            {allApps.map(({ app, status }) => (
              <AppTile key={app.key} app={app} status={status} />
            ))}
          </div>
        )}
      </div>

      {/* Access Control Notice */}
      <div className="p-4 bg-stone-100/75 border border-border text-xs text-stone-600 flex items-start space-x-3">
        <Sparkles className="w-4 h-4 text-forest flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-heading font-bold text-ink-text uppercase text-[11px]">
            Role-Based Access Enforcement
          </p>
          <p className="leading-relaxed">
            Unauthorized modules remain visible in a locked state to reflect organizational access boundaries.
            Zoho credentials are never exposed directly to users; sessions are proxied via backend service credentials.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
