import { useState } from 'react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Map, AlertTriangle, Brain, Route,
  BarChart3, Database, Bell, Settings, Network,
  ServerCog, Menu, X, Zap, LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

const BOTTOM = [
  { path: '/dashboard', label: 'Home',      icon: LayoutDashboard },
  { path: '/map',       label: 'Map',       icon: Map },
  { path: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { path: '/prediction',label: 'AI',        icon: Brain },
  { path: '/routes',    label: 'Routes',    icon: Route },
];

const ALL_NAV = [
  { path: '/dashboard',    label: 'Overview',      icon: LayoutDashboard },
  { path: '/map',          label: 'Live Map',       icon: Map },
  { path: '/prediction',   label: 'AI Prediction', icon: Brain },
  { path: '/network',      label: 'P2P Network',   icon: Network },
  { path: '/incidents',    label: 'Incidents',     icon: AlertTriangle },
  { path: '/routes',       label: 'Smart Routes',  icon: Route },
  { path: '/analytics',    label: 'Analytics',     icon: BarChart3 },
  { path: '/datasources',  label: 'Data Sources',  icon: Database },
  { path: '/system',       label: 'System Health', icon: ServerCog },
  { path: '/notifications',label: 'Alerts',        icon: Bell },
  { path: '/settings',     label: 'Settings',      icon: Settings },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { unreadCount } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      {/* Bottom bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-1 py-1"
        style={{
          background: 'rgba(8,13,23,0.97)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(30,45,69,0.8)',
          paddingBottom: 'env(safe-area-inset-bottom, 4px)',
        }}
      >
        {BOTTOM.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <button key={path} onClick={() => navigate(path)}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all min-w-[52px]"
              style={{ color: active ? '#38BDF8' : '#475569' }}>
              <Icon size={21} />
              <span className="text-[9px] font-medium leading-none">{label}</span>
              {active && <div className="w-1 h-1 rounded-full bg-accent-blue mt-0.5" />}
            </button>
          );
        })}

        {/* More */}
        <button onClick={() => setOpen(true)}
          className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[52px]"
          style={{ color: '#475569' }}>
          <div className="relative">
            <Menu size={21} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-status-critical rounded-full text-[8px] flex items-center justify-center text-white font-bold">{unreadCount}</span>
            )}
          </div>
          <span className="text-[9px] font-medium leading-none">More</span>
        </button>
      </nav>

      {/* Full-screen drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm"
              onClick={() => setOpen(false)} />

            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
              style={{ background: 'linear-gradient(180deg,#131f30 0%,#0D1520 100%)', maxHeight: '85vh' }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-accent-blue/20 border border-accent-blue/40 flex items-center justify-center">
                    <Zap size={14} className="text-accent-blue" />
                  </div>
                  <span className="text-sm font-bold text-text-primary tracking-widest">TRAFFICX</span>
                </div>
                <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-bg-elevated text-text-muted">
                  <X size={16} />
                </button>
              </div>

              {/* Nav grid */}
              <div className="overflow-y-auto px-4 py-3 pb-6">
                <div className="grid grid-cols-3 gap-2.5">
                  {ALL_NAV.map(({ path, label, icon: Icon }) => {
                    const active = location.pathname === path;
                    const badge  = path === '/notifications' && unreadCount > 0;
                    return (
                      <button key={path} onClick={() => { navigate(path); setOpen(false); }}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all"
                        style={{
                          background: active ? 'rgba(56,189,248,0.1)' : 'rgba(20,31,48,0.6)',
                          borderColor: active ? 'rgba(56,189,248,0.4)' : 'rgba(30,45,69,0.6)',
                          color: active ? '#38BDF8' : '#94A3B8',
                        }}>
                        <div className="relative">
                          <Icon size={22} />
                          {badge && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-status-critical rounded-full text-[7px] flex items-center justify-center text-white font-bold">{unreadCount}</span>}
                        </div>
                        <span className="text-[10px] font-medium leading-tight text-center">{label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* User row */}
                <div className="mt-4 flex items-center gap-3 p-3 rounded-2xl border border-border-subtle bg-bg-card">
                  <div className="w-9 h-9 rounded-full bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center text-accent-blue font-bold text-sm shrink-0">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{user?.name}</div>
                    <div className="text-[11px] text-text-muted truncate">{user?.email}</div>
                  </div>
                  <button onClick={() => { logout(); setOpen(false); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-status-critical border border-status-critical/30 hover:bg-status-critical/10 transition-all shrink-0">
                    <LogOut size={13} /> Sign Out
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
