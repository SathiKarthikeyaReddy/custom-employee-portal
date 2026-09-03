import React from 'react';
import { useAuth } from '../context/AuthContext';
import RoleBadge from './RoleBadge';
import { LogOut, User as UserIcon } from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header className="h-16 bg-white border-b border-border px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center space-x-3">
        <span className="font-heading text-sm uppercase tracking-widest text-stone-500 font-semibold">
          Office Access Management
        </span>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3 border-r border-border pr-4">
          <div className="w-8 h-8 rounded-full bg-ink text-paper flex items-center justify-center font-heading text-xs font-bold">
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-ink-text leading-tight">{user.name}</div>
            <div className="text-xs text-stone-500 leading-tight">{user.email}</div>
          </div>
          <div className="flex flex-wrap gap-1 ml-2">
            {Array.isArray(user.roles) && user.roles.map((r, idx) => (
              <RoleBadge key={idx} role={r} size="small" />
            ))}
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-ink hover:bg-stone-100 transition-colors border border-transparent hover:border-border"
          title="Sign Out"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;
