import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, MapPin } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import ThemeToggle from '../ui/ThemeToggle';

export default function TopBar({ title, subtitle, dataStatus }) {
  const { unreadCount, notifications, markNotificationRead } = useApp();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotif, setShowNotif] = useState(false);
  const [showUser,  setShowUser]  = useState(false);

  return (
    <header className="h-[72px] border-b border-[#e9edf2] bg-white/95 backdrop-blur-sm
                       flex items-center justify-between px-3 sticky top-0 z-30 shrink-0 gap-2">
      {/* Title */}
      <div className="min-w-0 flex-1 px-2 md:px-4">
        <h1 className="text-xl md:text-2xl font-extrabold text-[#171923] truncate leading-tight">
          {title === 'Overview' ? `Good Evening, ${user?.name?.split(' ')[0] || 'Alex'} 👋` : title}
        </h1>
        {subtitle && <p className="text-xs text-[#697586] truncate leading-tight mt-1 hidden sm:block">
          {title === 'Overview' ? "Here's what's happening on Delhi NCR roads today." : subtitle}
        </p>}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1 shrink-0">

        <button className="hidden md:flex items-center gap-2 h-10 px-4 rounded-xl border border-[#dde3ea] bg-white text-sm font-semibold text-[#242832] shadow-sm">
          <MapPin size={16} className="text-[#5d6675]" />
          Delhi NCR
          <ChevronDown size={14} className="text-[#9aa3af]" />
        </button>

        {dataStatus && (
          <div className={`hidden sm:flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold ${
            dataStatus === 'live' ? 'border-green-200 bg-green-50 text-green-700' :
            dataStatus === 'offline' ? 'border-red-200 bg-red-50 text-red-700' :
            'border-amber-200 bg-amber-50 text-amber-800'
          }`}>
            <div className={`h-1.5 w-1.5 rounded-full ${dataStatus === 'live' ? 'bg-green-500 animate-pulse' : dataStatus === 'offline' ? 'bg-red-500' : 'bg-amber-500'}`} />
            {dataStatus === 'live' ? 'TomTom Live' : dataStatus === 'mixed' ? 'Mixed Feed' : dataStatus === 'offline' ? 'API Offline' : dataStatus === 'connecting' ? 'Connecting' : 'Simulated'}
          </div>
        )}

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
