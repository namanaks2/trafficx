import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Map, Brain, Network, AlertTriangle,
  Route, BarChart3, Database, Bell, Settings,
  Zap, LogOut, Activity, ServerCog, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

const NAV = [
  { path: '/dashboard',    label: 'Overview',       icon: LayoutDashboard },
  { path: '/map',          label: 'Live Map',        icon: Map },
  { path: '/prediction',   label: 'AI Prediction',  icon: Brain },
  { path: '/network',      label: 'P2P Network',    icon: Network },
  { path: '/incidents',    label: 'Incidents',      icon: AlertTriangle },
  { path: '/routes',       label: 'Smart Routes',   icon: Route },
  { path: '/analytics',    label: 'Analytics',      icon: BarChart3 },
  { path: '/datasources',  label: 'Data Sources',   icon: Database },
  { path: '/system',       label: 'System Health',  icon: ServerCog },
  { path: '/notifications',label: 'Alerts',         icon: Bell },
  { path: '/settings',     label: 'Settings',       icon: Settings },
];

const ROLE_COLORS = {
  administrator:'text-status-critical', traffic_authority:'text-status-warning',
  traffic_analyst:'text-accent-blue',   general_user:'text-status-success',
};

export default function DesktopSidebar() {
  const { user, logout } = useAuth();
  const { sidebarCollapsed, setSidebarCollapsed, unreadCount } = useApp();
  const location = useLocation();
  const w = sidebarCollapsed ? 68 : 240;

  return (
    <motion.aside
      animate={{ width: w }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-full z-40 flex flex-col border-r border-border-subtle overflow-hidden shrink-0"
      style={{ background: 'linear-gradient(180deg,#101827 0%,#0D1520 100%)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-4 border-b border-border-subtle shrink-0">
        <div className="w-7 h-7 rounded-lg bg-accent-blue/20 border border-accent-blue/40 flex items-center justify-center shrink-0">
          <Zap size={15} className="text-accent-blue" />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
              <div className="text-xs font-bold text-text-primary tracking-widest leading-none">TRAFFICX</div>
              <div className="text-[9px] text-text-muted tracking-wider mt-0.5">Intelligence Network</div>
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="ml-auto p-1 rounded-md hover:bg-bg-elevated text-text-muted hover:text-text-primary shrink-0">
          {sidebarCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {NAV.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path;
          const badge  = path === '/notifications' && unreadCount > 0;
          return (
            <NavLink key={path} to={path} title={sidebarCollapsed ? label : undefined}
              className={active ? 'nav-item-active' : 'nav-item'}>
              <div className="relative shrink-0">
                <Icon size={16} />
                {badge && <span className="absolute -top-1 -right-1 w-3 h-3 bg-status-critical rounded-full text-[7px] flex items-center justify-center text-white font-bold">{unreadCount}</span>}
              </div>
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm truncate">
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-border-subtle p-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center text-accent-blue text-[10px] font-bold shrink-0">
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
