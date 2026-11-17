import { motion } from 'framer-motion';
import { Bell, CheckCheck, AlertTriangle, Info, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { useApp } from '../../context/AppContext';
import { formatDistanceToNow } from 'date-fns';

const CFG = {
  critical:{ icon:XCircle,     color:'text-status-critical', bg:'bg-status-critical/10', dot:'bg-status-critical' },
  warning: { icon:AlertTriangle,color:'text-status-warning',  bg:'bg-status-warning/10',  dot:'bg-status-warning' },
  success: { icon:CheckCircle,  color:'text-status-success',  bg:'bg-status-success/10',  dot:'bg-status-success' },
  info:    { icon:Info,         color:'text-accent-blue',      bg:'bg-accent-blue/10',     dot:'bg-accent-blue' },
};

export default function Notifications() {
  const { notifications, markNotificationRead, markAllRead, unreadCount } = useApp();
  const navigate = useNavigate();

  return (
    <AppLayout title="Alerts" subtitle={`${unreadCount} unread`}>

      {/* Header actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="badge-info text-[10px]">{unreadCount} unread</span>
          <span className="text-xs text-text-muted">{notifications.length} total</span>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-subtle text-xs text-text-muted hover:border-accent-blue hover:text-accent-blue transition-all">
            <CheckCheck size={13} /> Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {notifications.length === 0 && (
          <div className="glass-card p-10 text-center">
            <Bell size={28} className="text-text-muted mx-auto mb-2" />
            <p className="text-sm text-text-secondary">No notifications yet</p>
          </div>
        )}
        {notifications.map((n, i) => {
          const cfg = CFG[n.type] || CFG.info;
          const Icon = cfg.icon;
          return (
            <motion.button key={n.id} initial={{ opacity:0, x:-12 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.04 }}
              className={`w-full text-left p-4 rounded-2xl border transition-all ${
                !n.read ? `border ${n.type==='critical'?'border-status-critical/30':n.type==='warning'?'border-status-warning/30':'border-border-default'} ${cfg.bg}` : 'border-border-subtle bg-bg-card'
              }`}
              onClick={() => { markNotificationRead(n.id); if (n.link) navigate(n.link); }}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                  <Icon size={15} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-text-primary leading-tight">{n.title}</p>
                    {!n.read && <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${cfg.dot}`} />}
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 leading-snug">{n.message}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-text-muted">{formatDistanceToNow(new Date(n.time), { addSuffix:true })}</span>
                    {n.link && <span className="flex items-center gap-0.5 text-[10px] text-accent-blue font-medium">View <ChevronRight size={10} /></span>}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </AppLayout>
  );
}
