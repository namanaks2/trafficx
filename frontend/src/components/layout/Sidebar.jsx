import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Map, Brain, Network, AlertTriangle,
  Route, BarChart3, Database, Bell, Settings, ChevronLeft,
  ChevronRight, Zap, Shield, LogOut, Activity
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard, permission: 'dashboard' },
  { path: '/map', label: 'Live Traffic Map', icon: Map, permission: 'map' },
  { path: '/prediction', label: 'AI Prediction', icon: Brain, permission: 'prediction' },
  { path: '/network', label: 'Decentralized Network', icon: Network, permission: 'network' },
  { path: '/incidents', label: 'Incidents', icon: AlertTriangle, permission: 'incidents' },
  { path: '/routes', label: 'Smart Routes', icon: Route, permission: 'routes' },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, permission: 'analytics' },
  { path: '/datasources', label: 'Data Sources', icon: Database, permission: 'datasources' },
  { path: '/notifications', label: 'Notifications', icon: Bell, permission: 'notifications' },
  { path: '/settings', label: 'Settings', icon: Settings, permission: 'settings' },
];

const ROLE_LABELS = {
  administrator: 'Administrator',
  traffic_authority: 'Traffic Authority',
  traffic_analyst: 'Traffic Analyst',
  general_user: 'General User',
};

const ROLE_COLORS = {
  administrator: 'text-status-critical',
  traffic_authority: 'text-status-warning',
  traffic_analyst: 'text-accent-blue',
  general_user: 'text-status-success',
};

export default function Sidebar() {
  const { user, logout, hasPermission } = useAuth();
  const { sidebarCollapsed, setSidebarCollapsed, unreadCount } = useApp();
  const location = useLocation();

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 72 : 256 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-full z-40 flex flex-col border-r border-border-subtle overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #101827 0%, #0D1520 100%)' }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-border-subtle shrink-0">
        <AnimatePresence mode="wait">
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-2.5"
            >
              <div className="w-8 h-8 rounded-lg bg-accent-blue/20 border border-accent-blue/40 flex items-center justify-center">
                <Zap className="w-4.5 h-4.5 text-accent-blue" size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-text-primary tracking-wider">TRAFFICX</div>
                <div className="text-[10px] text-text-muted tracking-widest uppercase">Intelligence Network</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {sidebarCollapsed && (
          <div className="w-8 h-8 rounded-lg bg-accent-blue/20 border border-accent-blue/40 flex items-center justify-center mx-auto">
            <Zap size={16} className="text-accent-blue" />
          </div>
        )}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-all ml-auto"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Live indicator */}
      {!sidebarCollapsed && (
        <div className="px-4 py-2.5 border-b border-border-subtle">
          <div className="flex items-center gap-2 text-xs text-status-success">
            <Activity size={12} className="animate-pulse" />
            <span>Live Monitoring Active</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          if (!hasPermission(item.permission)) return null;
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const Icon = item.icon;
          const showBadge = item.path === '/notifications' && unreadCount > 0;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={isActive ? 'nav-item-active' : 'nav-item'}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <div className="relative shrink-0">
                <Icon size={18} />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-status-critical rounded-full text-[9px] flex items-center justify-center text-white font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <AnimatePresence mode="wait">
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t border-border-subtle p-3 shrink-0">
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-9 h-9 rounded-full bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center shrink-0">
            <Shield size={16} className="text-accent-blue" />
          </div>
          <AnimatePresence mode="wait">
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <div className="text-sm font-medium text-text-primary truncate">{user?.name}</div>
                <div className={`text-xs font-medium ${ROLE_COLORS[user?.role] || 'text-text-muted'}`}>
                  {ROLE_LABELS[user?.role] || user?.role}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!sidebarCollapsed && (
            <button
              onClick={logout}
              className="p-1.5 rounded-lg hover:bg-status-critical/10 text-text-muted hover:text-status-critical transition-all shrink-0"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
