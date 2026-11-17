import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Maximize2, Minimize2, Wifi, WifiOff, ChevronDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import ThemeToggle from '../ui/ThemeToggle';

export default function TopBar({ title, subtitle }) {
  const { unreadCount, notifications, markNotificationRead,
          presentationMode, setPresentationMode,
          liveUpdates, setLiveUpdates } = useApp();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotif, setShowNotif] = useState(false);
  const [showUser,  setShowUser]  = useState(false);

  return (
    <header className="h-12 border-b border-border-subtle bg-bg-secondary/95 backdrop-blur-sm
                       flex items-center justify-between px-3 sticky top-0 z-30 shrink-0 gap-2">
      {/* Title */}
      <div className="min-w-0 flex-1">
        <h1 className="text-sm font-semibold text-text-primary truncate leading-tight">{title}</h1>
        {subtitle && <p className="text-[10px] text-text-muted truncate leading-tight hidden sm:block">{subtitle}</p>}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1 shrink-0">

        {/* Live dot */}
        <button onClick={() => setLiveUpdates(!liveUpdates)}
          className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border transition-all ${
            liveUpdates
              ? 'bg-status-success/10 text-status-success border-status-success/30'
              : 'bg-bg-elevated text-text-muted border-border-subtle'
          }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${liveUpdates ? 'bg-status-success animate-pulse' : 'bg-text-muted'}`} />
          {liveUpdates ? 'Live' : 'Off'}
        </button>

        {/* Theme */}
        <ThemeToggle compact />

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => { setShowNotif(!showNotif); setShowUser(false); }}
            className="relative p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary">
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-status-critical rounded-full text-[8px] flex items-center justify-center text-white font-bold leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {showNotif && (
            <div className="absolute right-0 top-full mt-1 w-72 glass-card rounded-xl border border-border-default shadow-card-hover z-50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
                <span className="text-xs font-semibold">Notifications</span>
                <button onClick={() => { navigate('/notifications'); setShowNotif(false); }} className="text-[10px] text-accent-blue">All</button>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-border-subtle">
                {notifications.slice(0, 5).map(n => (
                  <div key={n.id}
                    className={`px-3 py-2.5 cursor-pointer hover:bg-bg-elevated ${!n.read ? 'bg-accent-blue/5' : ''}`}
                    onClick={() => { markNotificationRead(n.id); setShowNotif(false); if (n.link) navigate(n.link); }}>
                    <div className="flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                        n.type==='critical'?'bg-status-critical':n.type==='warning'?'bg-status-warning':n.type==='success'?'bg-status-success':'bg-accent-blue'}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-text-primary truncate">{n.title}</p>
                        <p className="text-[10px] text-text-muted mt-0.5">{formatDistanceToNow(new Date(n.time), { addSuffix: true })}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="relative">
          <button onClick={() => { setShowUser(!showUser); setShowNotif(false); }}
            className="flex items-center gap-1 px-1.5 py-1 rounded-lg hover:bg-bg-elevated">
            <div className="w-6 h-6 rounded-full bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center text-accent-blue text-[10px] font-bold">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <ChevronDown size={11} className="text-text-muted hidden sm:block" />
          </button>
          {showUser && (
            <div className="absolute right-0 top-full mt-1 w-40 glass-card rounded-xl border border-border-default shadow-card-hover z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-border-subtle">
                <p className="text-xs font-medium text-text-primary truncate">{user?.name}</p>
                <p className="text-[10px] text-text-muted truncate">{user?.email}</p>
              </div>
              <div className="p-1.5 space-y-0.5">
                <button onClick={() => { navigate('/settings'); setShowUser(false); }} className="w-full text-left px-2 py-1.5 text-xs text-text-secondary hover:bg-bg-elevated rounded-lg">Settings</button>
                <button onClick={logout} className="w-full text-left px-2 py-1.5 text-xs text-status-critical hover:bg-status-critical/10 rounded-lg">Sign Out</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {(showNotif || showUser) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowNotif(false); setShowUser(false); }} />
      )}
    </header>
  );
}
