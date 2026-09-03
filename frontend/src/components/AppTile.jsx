import React, { useState } from 'react';
import { ExternalLink, Lock, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import zohoService from '../services/zohoService';

export const AppTile = ({ app, status, onAuditRefresh }) => {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState(null);

  // Status can be: 'authorized', 'locked', 'pending_setup'
  const isAuthorized = status === 'authorized';
  const isLocked = status === 'locked';
  const isPending = status === 'pending_setup';

  const handleOpen = async () => {
    if (!isAuthorized || opening) return;

    setOpening(true);
    setError(null);
    try {
      const data = await zohoService.openApp(app.key);
      if (data && data.redirectUrl) {
        window.open(data.redirectUrl, '_blank', 'noopener,noreferrer');
        if (onAuditRefresh) onAuditRefresh();
      }
    } catch (err) {
      console.error('Failed to open app:', err);
      const msg = err.response?.data?.message || 'Failed to open application';
      setError(msg);
    } finally {
      setOpening(false);
    }
  };

  return (
    <div
      className={`border px-5 py-4 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isAuthorized
          ? 'bg-white border-forest/40 hover:border-forest shadow-sm'
          : isPending
          ? 'bg-amber-50/40 border-amber/40 cursor-not-allowed'
          : 'bg-stone-100/70 border-stone-200 text-stone-400 cursor-not-allowed select-none'
      }`}
    >
      {/* App Info */}
      <div className="flex items-start space-x-4">
        <div
          className={`w-10 h-10 flex items-center justify-center font-heading font-bold text-sm flex-shrink-0 ${
            isAuthorized
              ? 'bg-forest text-white'
              : isPending
              ? 'bg-amber text-white'
              : 'bg-stone-300 text-stone-600'
          }`}
        >
          {app.name.charAt(0)}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h3
              className={`font-heading text-base font-bold uppercase tracking-wide ${
                isAuthorized ? 'text-ink-text' : isPending ? 'text-stone-800' : 'text-stone-500'
              }`}
            >
              {app.name}
            </h3>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 bg-stone-100 text-stone-600 border border-stone-200">
              {app.key}
            </span>
          </div>
          <p className="text-xs text-stone-600 mt-0.5 max-w-xl">{app.purpose}</p>
          {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
        </div>
      </div>

      {/* Status & Action */}
      <div className="flex items-center space-x-3 self-end md:self-center flex-shrink-0">
        {isAuthorized && (
          <>
            <div className="flex items-center space-x-1.5 text-xs text-forest font-medium uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              <span>Authorized</span>
            </div>
            <button
              onClick={handleOpen}
              disabled={opening}
              className="flex items-center space-x-1.5 px-4 py-2 bg-forest text-white font-heading text-xs font-semibold uppercase tracking-wider hover:bg-[#25583E] transition-colors border border-[#25583E] disabled:opacity-50"
            >
              <span>{opening ? 'Opening...' : 'Launch App'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        {isPending && (
          <div
            className="flex items-center space-x-2 px-3 py-1.5 bg-amber/10 border border-amber/30 text-amber font-medium text-xs tracking-wide"
            title="Zoho application provision is in progress for this organization"
          >
            <Clock className="w-4 h-4" />
            <span className="font-heading uppercase text-[11px] font-bold">Pending setup</span>
          </div>
        )}

        {isLocked && (
          <div
            className="flex items-center space-x-2 px-3 py-1.5 bg-stone-200/80 border border-stone-300 text-stone-600 font-medium text-xs tracking-wide cursor-not-allowed"
            title="Not authorized for your role"
          >
            <Lock className="w-4 h-4 text-stone-500" />
            <span className="font-heading uppercase text-[11px] font-bold text-stone-500">
              Locked (No Access)
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppTile;
