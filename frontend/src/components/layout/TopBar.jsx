import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Bell, ChevronDown, MoreHorizontal, Activity,
  Settings, AlertTriangle, Brain, Database,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import ThemeToggle from '../ui/ThemeToggle';

const PRIMARY_NAV = [
  { path: '/dashboard', label: 'Overview' },
  { path: '/analytics', label: 'Analytics' },
  { path: '/routes', label: 'Smart Routes' },
  { path: '/network', label: 'Network' },
];

const MORE_NAV = [
  { path: '/analytics', label: 'Congestion', icon: Activity },
  { path: '/datasources', label: 'Traffic Density', icon: Database },
  { path: '/prediction', label: 'AI Prediction', icon: Brain },
  { path: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { path: '/settings', label: 'Settings', icon: Settings },
];

function MobilityMark() {
  return (
    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center" aria-label="Mobility command mark">
      <span className="absolute h-[30px] w-[9px] -translate-x-[5px] rotate-[32deg] rounded-[3px] border border-[#412D15] bg-[#412D15]" />
      <span className="absolute h-[30px] w-[9px] translate-x-[5px] rotate-[32deg] rounded-[3px] border border-[#EF4444] bg-[#EF4444]" />
      <span className="h-2 w-2 rounded-full bg-[#E1DCC9] ring-2 ring-bg-secondary" />
    </div>
  );
}

export default function TopBar({ dataStatus }) {
  const { unreadCount, notifications, markNotificationRead } = useApp();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showUser, setShowUser] = useState(false);

  const closeMenus = () => {
    setShowMore(false);
    setShowNotif(false);
    setShowUser(false);
  };

  const status = dataStatus === 'live'
    ? { label: 'Live', dot: 'bg-green-500', tone: 'text-green-700 border-green-200 bg-green-50' }
    : dataStatus === 'offline'
      ? { label: 'Offline', dot: 'bg-red-500', tone: 'text-red-700 border-red-200 bg-red-50' }
      : { label: 'Monitoring', dot: 'bg-amber-500', tone: 'text-amber-800 border-amber-200 bg-amber-50' };

  return (
    <header className="sticky top-0 z-40 h-16 shrink-0 border-b border-border-subtle bg-bg-secondary/95 backdrop-blur-md">
      <div className="mx-auto flex h-full w-full max-w-[1600px] items-center px-3 md:px-5">
        <button type="button" onClick={() => navigate('/dashboard')} className="flex shrink-0 items-center gap-2.5" title="Overview">
          <MobilityMark />
          <span className="hidden leading-none sm:block">
            <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-text-muted">Mobility</span>
            <span className="mt-1 block font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-text-secondary">Command</span>
          </span>
        </button>

        <nav className="mx-auto hidden items-center gap-1 rounded-xl border border-border-subtle bg-bg-card p-1 md:flex" aria-label="Primary navigation">
          {PRIMARY_NAV.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                isActive
                  ? 'bg-[#412D15] text-white shadow-sm'
                  : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
              }`}
            >
              {item.label}
            </NavLink>
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowMore(!showMore); setShowNotif(false); setShowUser(false); }}
              className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                showMore ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
              }`}
              aria-expanded={showMore}
            >
              More <ChevronDown size={13} className={`transition-transform ${showMore ? 'rotate-180' : ''}`} />
            </button>
            {showMore && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border-subtle bg-bg-card p-1.5 shadow-card-hover">
                {MORE_NAV.map(({ path, label, icon: Icon }) => (
                  <NavLink
                    key={path}
                    to={path}
                    onClick={() => setShowMore(false)}
                    className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold ${
                      isActive ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                    }`}
                  >
                    <Icon size={15} className="text-[#EF4444]" />
                    {label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 md:ml-2">
          <div className={`hidden h-8 items-center gap-2 rounded-lg border px-2.5 text-[10px] font-bold lg:flex ${status.tone}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </div>
          <div className="relative md:hidden">
            <button
              type="button"
              onClick={() => { setShowMore(!showMore); setShowNotif(false); setShowUser(false); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-bg-elevated hover:text-text-primary"
              aria-label="More navigation"
              aria-expanded={showMore}
            >
              <MoreHorizontal size={17} />
            </button>
            {showMore && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border-subtle bg-bg-card p-1.5 shadow-card-hover">
                {MORE_NAV.map(item => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setShowMore(false)}
                      className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold ${
                        isActive ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                      }`}
                    >
                      {Icon ? <Icon size={15} className="text-[#EF4444]" /> : <Activity size={15} className="text-[#EF4444]" />}
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>
          <ThemeToggle compact />

          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowNotif(!showNotif); setShowMore(false); setShowUser(false); }}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
              aria-label="Notifications"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF4444] px-1 text-[8px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotif && (
              <div className="absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-xl border border-border-subtle bg-bg-card shadow-card-hover">
                <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5">
                  <span className="text-xs font-bold text-text-primary">Notifications</span>
                  <button onClick={() => { navigate('/notifications'); closeMenus(); }} className="text-[10px] font-bold text-[#EF4444]">View all</button>
                </div>
                <div className="max-h-64 divide-y divide-border-subtle overflow-y-auto">
                  {notifications.slice(0, 5).map(notification => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => { markNotificationRead(notification.id); closeMenus(); if (notification.link) navigate(notification.link); }}
                      className="w-full px-3 py-3 text-left hover:bg-bg-elevated"
                    >
                      <p className="truncate text-xs font-semibold text-text-primary">{notification.title}</p>
                      <p className="mt-1 text-[10px] text-text-muted">{formatDistanceToNow(new Date(notification.time), { addSuffix: true })}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowUser(!showUser); setShowMore(false); setShowNotif(false); }}
              className="flex h-9 items-center gap-1.5 rounded-lg px-1.5 hover:bg-bg-elevated"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#412D15]/30 bg-[#412D15]/10 text-[11px] font-bold text-[#412D15]">
                {user?.name?.charAt(0) || 'U'}
              </span>
              <ChevronDown size={12} className="hidden text-text-muted sm:block" />
            </button>
            {showUser && (
              <div className="absolute right-0 top-full mt-2 w-44 overflow-hidden rounded-xl border border-border-subtle bg-bg-card shadow-card-hover">
                <div className="border-b border-border-subtle px-3 py-2.5">
                  <p className="truncate text-xs font-bold text-text-primary">{user?.name}</p>
                  <p className="mt-0.5 truncate text-[10px] text-text-muted">{user?.email}</p>
                </div>
                <div className="p-1.5">
                  <button onClick={() => { navigate('/settings'); closeMenus(); }} className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-text-secondary hover:bg-bg-elevated">Settings</button>
                  <button onClick={logout} className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-red-600 hover:bg-red-50/10">Sign out</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {(showMore || showNotif || showUser) && (
        <button type="button" className="fixed inset-0 -z-10 cursor-default" onClick={closeMenus} aria-label="Close navigation menus" />
      )}
    </header>
  );
}
