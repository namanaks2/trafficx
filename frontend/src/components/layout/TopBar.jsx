import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Maximize2, Minimize2, Wifi, WifiOff, ChevronDown, Menu } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';

export default function TopBar({ title, subtitle }) {
  const { unreadCount, notifications, markNotificationRead, presentationMode, setPresentationMode, liveUpdates, setLiveUpdates, setSidebarCollapsed, sidebarCollapsed } = useApp();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const recentNotifs = notifications.slice(0, 5);

  return (
    <header className="h-14 border-b border-border-subtle bg-bg-secondary/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          className="p-2 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-all md:hidden"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          <Menu size={18} />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-text-primary leading-none">{title}</h1>
          {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Live status */}
        <button
          onClick={() => setLiveUpdates(!liveUpdates)}
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            liveUpdates
              ? 'bg-status-success/10 text-status-success border border-status-success/25 hover:bg-status-success/20'
              : 'bg-bg-elevated text-text-muted border border-border-subtle hover:border-border-default'
          }`}
        >
          {liveUpdates ? <Wifi size={12} /> : <WifiOff size={12} />}
          {liveUpdates ? 'Live' : 'Paused'}
        </button>

        {/* Presentation mode */}
        <button
          onClick={() => setPresentationMode(!presentationMode)}
          className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            presentationMode
              ? 'bg-accent-purple/15 text-accent-purple border border-accent-purple/30'
              : 'bg-bg-elevated text-text-muted border border-border-subtle hover:border-border-default'
          }`}
        >
          {presentationMode ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          {presentationMode ? 'Exit Presentation' : 'Present'}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifPanel(!showNotifPanel); setShowUserMenu(false); }}
            className="relative p-2 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-all"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-status-critical rounded-full text-[9px] flex items-center justify-center text-white font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifPanel && (
            <div className="absolute right-0 top-full mt-2 w-80 glass-card rounded-xl shadow-card-hover border border-border-default z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
                <span className="text-sm font-semibold text-text-primary">Notifications</span>
                <button onClick={() => navigate('/notifications')} className="text-xs text-accent-blue hover:underline">View all</button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-border-subtle">
                {recentNotifs.map(n => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 cursor-pointer hover:bg-bg-elevated transition-colors ${!n.read ? 'bg-accent-blue/5' : ''}`}
                    onClick={() => { markNotificationRead(n.id); setShowNotifPanel(false); if (n.link) navigate(n.link); }}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        n.type === 'critical' ? 'bg-status-critical' :
                        n.type === 'warning' ? 'bg-status-warning' :
                        n.type === 'success' ? 'bg-status-success' : 'bg-accent-blue'
                      }`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-text-primary">{n.title}</p>
                        <p className="text-xs text-text-muted truncate mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-text-muted mt-1">
                          {formatDistanceToNow(new Date(n.time), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifPanel(false); }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-bg-elevated transition-all"
          >
            <div className="w-7 h-7 rounded-full bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center text-accent-blue text-xs font-bold">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <span className="hidden sm:block text-sm text-text-secondary">{user?.name?.split(' ')[0]}</span>
            <ChevronDown size={14} className="text-text-muted" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 glass-card rounded-xl shadow-card-hover border border-border-default z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border-subtle">
                <p className="text-sm font-medium text-text-primary">{user?.name}</p>
                <p className="text-xs text-text-muted">{user?.email}</p>
              </div>
              <div className="p-2">
                <button onClick={() => { navigate('/settings'); setShowUserMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated rounded-lg transition-colors">Settings</button>
                <button onClick={() => { logout(); setShowUserMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-status-critical hover:bg-status-critical/10 rounded-lg transition-colors">Sign Out</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close */}
      {(showNotifPanel || showUserMenu) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowNotifPanel(false); setShowUserMenu(false); }} />
      )}
    </header>
  );
}
