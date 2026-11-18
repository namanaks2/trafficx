import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Map, Brain, Network, AlertTriangle,
  Route, BarChart3, Settings, Search,
  Zap, LogOut, ChevronLeft, ChevronRight, ChevronDown,
  FileText, Activity
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

const NAV = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/map', label: 'Live Map', icon: Map },
];

const ANALYTICS = [
  { path: '/analytics', label: 'Congestion', icon: Activity },
  { path: '/datasources', label: 'Traffic Density', icon: BarChart3 },
  { path: '/prediction', label: 'AI Prediction', icon: Brain },
];

const OPERATIONS = [
  { path: '/incidents', label: 'Incidents', icon: AlertTriangle, badge: true },
  { path: '/routes', label: 'Smart Routes', icon: Route },
  { path: '/network', label: 'Network', icon: Network },
  { path: '/analytics', label: 'Reports', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const ROLE_COLORS = {
  administrator:'text-status-critical', traffic_authority:'text-status-warning',
  traffic_analyst:'text-accent-blue',   general_user:'text-status-success',
};

export default function DesktopSidebar() {
  const { user, logout } = useAuth();
  const { sidebarCollapsed, setSidebarCollapsed, incidents } = useApp();
  const [analyticsOpen, setAnalyticsOpen] = useState(true);
  const location = useLocation();
  const w = sidebarCollapsed ? 76 : 252;

  return (
    <motion.aside
      animate={{ width: w }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-full z-40 flex flex-col border-r border-border-subtle overflow-hidden shrink-0"
      style={{ background: 'linear-gradient(180deg,#17191d 0%,#101216 100%)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/[0.06] shrink-0">
        <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
          <div className="absolute inset-y-1 left-0 w-2 skew-y-[-35deg] bg-[#ef1b2d]" />
          <div className="absolute inset-y-1 right-0 w-2 skew-y-[-35deg] bg-[#ef1b2d]" />
          <Zap size={15} className="relative text-white" />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
              <div className="text-[16px] font-extrabold text-white tracking-[0.08em] leading-none">TRAFFIC<span className="text-[#ef1b2d]">X</span></div>
              <div className="text-[9px] text-white/45 tracking-[0.08em] mt-1">Urban Mobility Intelligence</div>
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="ml-auto p-1 rounded-md hover:bg-bg-elevated text-text-muted hover:text-text-primary shrink-0">
          {sidebarCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* Search */}
      {!sidebarCollapsed && (
        <div className="px-4 pt-4 pb-2">
          <button className="w-full h-10 rounded-lg border border-white/[0.08] bg-white/[0.055] px-3 flex items-center gap-2 text-white/45 text-sm hover:bg-white/[0.08] transition-colors">
            <Search size={15} />
            <span className="flex-1 text-left">Search anything...</span>
            <span className="text-[10px] rounded border border-white/10 px-1.5 py-0.5 text-white/35">Ctrl + K</span>
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {NAV.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <NavLink key={path} to={path} title={sidebarCollapsed ? label : undefined}
              className={`flex items-center gap-3 h-11 px-3 rounded-lg text-[13px] transition-all ${
                active ? 'bg-[#e31b2f] text-white shadow-[0_8px_24px_rgba(227,27,47,.22)]' : 'text-white/55 hover:text-white hover:bg-white/[0.06]'
              }`}>
              <Icon size={18} className="shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{label}</span>}
            </NavLink>
          );
        })}

        <button onClick={() => !sidebarCollapsed && setAnalyticsOpen(!analyticsOpen)}
          title={sidebarCollapsed ? 'Traffic Analytics' : undefined}
          className="w-full flex items-center gap-3 h-11 px-3 rounded-lg text-[13px] text-white/55 hover:text-white hover:bg-white/[0.06] transition-all">
          <BarChart3 size={18} className="shrink-0" />
          {!sidebarCollapsed && (
            <>
              <span className="flex-1 text-left">Traffic Analytics</span>
              <ChevronDown size={14} className={`transition-transform ${analyticsOpen ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>

        <AnimatePresence initial={false}>
          {analyticsOpen && !sidebarCollapsed && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden ml-3 pl-5 border-l border-white/[0.08] space-y-0.5">
              {ANALYTICS.map(({ path, label }) => (
                <NavLink key={label} to={path} className={`block py-2 text-[12px] ${location.pathname === path ? 'text-white' : 'text-white/45 hover:text-white/80'}`}>
                  {label}
                </NavLink>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <NavLink to="/prediction" className={`flex items-center gap-3 h-11 px-3 rounded-lg text-[13px] transition-all ${location.pathname === '/prediction' ? 'bg-[#e31b2f] text-white' : 'text-white/55 hover:text-white hover:bg-white/[0.06]'}`}>
          <Brain size={18} className="shrink-0" />
          {!sidebarCollapsed && <span>AI Prediction</span>}
        </NavLink>

        {OPERATIONS.map(({ path, label, icon: Icon, badge }) => {
          const active = location.pathname === path;
          const incidentCount = incidents?.filter(i => i.status !== 'resolved').length || 0;
          return (
            <NavLink key={label} to={path} title={sidebarCollapsed ? label : undefined}
              className={`flex items-center gap-3 h-11 px-3 rounded-lg text-[13px] transition-all ${active ? 'bg-[#e31b2f] text-white' : 'text-white/55 hover:text-white hover:bg-white/[0.06]'}`}>
              <Icon size={18} className="shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1">{label}</span>
                  {badge && incidentCount > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#e31b2f] text-white text-[10px] flex items-center justify-center">{incidentCount}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-white/[0.06] p-3 shrink-0 bg-black/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-[#252932] border border-white/10 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                <div className="text-xs font-medium text-text-primary truncate">{user?.name}</div>
                <div className={`text-[9px] ${ROLE_COLORS[user?.role] || 'text-text-muted'}`}>{user?.role?.replace(/_/g,' ')}</div>
              </motion.div>
            )}
          </AnimatePresence>
          {!sidebarCollapsed && (
            <button onClick={logout} className="p-1 rounded-md hover:bg-status-critical/10 text-text-muted hover:text-status-critical shrink-0" title="Logout">
              <LogOut size={13} />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
