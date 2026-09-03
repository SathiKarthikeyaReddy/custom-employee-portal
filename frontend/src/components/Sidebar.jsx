import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  ShieldCheck, 
  ClipboardList, 
  Layers
} from 'lucide-react';

export const Sidebar = () => {
  const { hasPermission } = useAuth();

  const navItems = [
    {
      to: '/dashboard',
      label: 'Directory',
      icon: LayoutDashboard,
      show: true,
    },
    {
      to: '/admin/users',
      label: 'Staff Users',
      icon: Users,
      show: hasPermission('admin.users.manage'),
    },
    {
      to: '/admin/roles',
      label: 'Role Permissions',
      icon: ShieldCheck,
      show: hasPermission('admin.roles.manage'),
    },
    {
      to: '/admin/audit',
      label: 'Audit Trail',
      icon: ClipboardList,
      show: hasPermission('admin.audit.view'),
    },
  ];

  return (
    <aside className="w-64 bg-ink text-paper flex-shrink-0 flex flex-col border-r border-[#222733] min-h-screen">
      {/* Brand / Logo */}
      <div className="h-16 px-6 flex items-center space-x-3 border-b border-[#222733]">
        <div className="w-7 h-7 bg-forest flex items-center justify-center text-white">
          <Layers className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="font-heading text-sm font-bold tracking-wider text-white uppercase">
            Brainwave Portal
          </span>
          <span className="text-[10px] text-stone-400 tracking-widest uppercase">
            Zoho One Gateway
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1.5">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-stone-500 font-heading">
          Applications & Access
        </div>

        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3.5 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                    isActive
                      ? 'bg-forest text-white'
                      : 'text-stone-300 hover:text-white hover:bg-[#1C212D]'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
      </nav>

      {/* Footer / System Status */}
      <div className="p-4 border-t border-[#222733] text-[11px] text-stone-400 space-y-1">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-forest inline-block animate-pulse"></span>
          <span className="text-stone-300 font-medium">Zoho SSO Proxy Active</span>
        </div>
        <div className="text-[10px] text-stone-500">Service Account Mode</div>
      </div>
    </aside>
  );
};

export default Sidebar;
