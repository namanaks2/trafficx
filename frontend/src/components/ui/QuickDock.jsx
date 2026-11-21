import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Map, AlertTriangle, Brain, Plus, LayoutDashboard, Network, Settings, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const PRIMARY = [
  { path: '/map', label: 'Live Map', icon: Map, primary: true },
  { path: '/incidents', label: 'Incidents', icon: AlertTriangle, badge: true },
  { path: '/prediction', label: 'AI Prediction', icon: Brain },
];

const EXTRA = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/network', label: 'Network', icon: Network },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function QuickDock() {
  const [open, setOpen] = useState(false);
  const { incidents } = useApp();
  const location = useLocation();
  const incidentCount = incidents?.filter(item => item.status !== 'resolved').length || 0;

  const buttonClass = isActive => `group relative flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-200 ${
    isActive
      ? 'border-[#EF4444] bg-[#EF4444] text-white shadow-[0_10px_24px_rgba(239,68,68,.28)]'
      : 'border-border-subtle bg-bg-card text-text-secondary shadow-[0_8px_24px_rgba(0,0,0,.12)] hover:-translate-y-0.5 hover:border-[#412D15]/50 hover:text-text-primary'
  }`;

  return (
    <div className="fixed bottom-4 right-3 z-50 md:bottom-5 md:right-5">
      <div className="hidden items-center gap-1.5 rounded-2xl border border-border-subtle bg-bg-secondary/95 p-1.5 shadow-[0_14px_36px_rgba(0,0,0,.16)] backdrop-blur-md md:flex">
        {PRIMARY.map(({ path, label, icon: Icon, primary, badge }) => {
          const active = location.pathname === path;
          return (
            <NavLink
              key={path}
              to={path}
              className={`${buttonClass(active)} ${primary ? 'h-12 w-12 rounded-[14px]' : ''}`}
              aria-label={label}
            >
              <Icon size={primary ? 19 : 17} />
              {badge && incidentCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF4444] px-1 text-[8px] font-bold text-white ring-2 ring-bg-secondary">
                  {incidentCount > 9 ? '9+' : incidentCount}
                </span>
              )}
              <span className="pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-md bg-[#000000] px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                {label}
              </span>
            </NavLink>
          );
        })}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className={`${buttonClass(open)} ${open ? 'rotate-45' : ''}`}
            aria-label="Quick actions"
            aria-expanded={open}
          >
            <Plus size={17} />
            <span className="pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-md bg-[#000000] px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              Quick actions
            </span>
          </button>
          {open && (
            <div className="absolute bottom-[54px] right-0 flex flex-col-reverse gap-1.5">
              {EXTRA.map(({ path, label, icon: Icon }) => {
                const active = location.pathname === path;
                return (
                  <NavLink key={path} to={path} onClick={() => setOpen(false)} className={buttonClass(active)} aria-label={label}>
                    <Icon size={17} />
                    <span className="pointer-events-none absolute right-full mr-2 whitespace-nowrap rounded-md bg-[#000000] px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                      {label}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="relative md:hidden">
        {open && (
          <div className="absolute bottom-14 right-0 flex flex-col-reverse gap-2">
            {[...PRIMARY, ...EXTRA].map(({ path, label, icon: Icon, badge, primary }) => {
              const active = location.pathname === path;
              return (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setOpen(false)}
                  className={`relative flex h-12 w-12 items-center justify-center rounded-2xl border shadow-[0_10px_26px_rgba(0,0,0,.18)] ${
                    active || primary
                      ? 'border-[#EF4444] bg-[#EF4444] text-white'
                      : 'border-border-subtle bg-bg-card text-text-primary'
                  }`}
                  aria-label={label}
                >
                  <Icon size={18} />
                  {badge && incidentCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#000] px-1 text-[8px] font-bold text-white">
                      {incidentCount > 9 ? '9+' : incidentCount}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#EF4444] bg-[#EF4444] text-white shadow-[0_14px_32px_rgba(239,68,68,.32)]"
          aria-label={open ? 'Close quick actions' : 'Open quick actions'}
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Plus size={22} />}
        </button>
      </div>
    </div>
  );
}
