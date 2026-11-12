import { motion } from 'framer-motion';
import { Bell, CheckCheck, AlertTriangle, Info, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { useApp } from '../../context/AppContext';
import { formatDistanceToNow } from 'date-fns';

const TYPE_CONFIG = {
  critical: { icon: XCircle, color: 'text-status-critical', bg: 'bg-status-critical/10', border: 'border-status-critical/25' },
  warning: { icon: AlertTriangle, color: 'text-status-warning', bg: 'bg-status-warning/10', border: 'border-status-warning/25' },
  success: { icon: CheckCircle, color: 'text-status-success', bg: 'bg-status-success/10', border: 'border-status-success/25' },
  info: { icon: Info, color: 'text-accent-blue', bg: 'bg-accent-blue/10', border: 'border-accent-blue/25' },
};

export default function Notifications() {
  const { notifications, markNotificationRead, markAllRead, unreadCount } = useApp();
  const navigate = useNavigate();

  return (
    <AppLayout title="Notifications" subtitle={`${unreadCount} unread`}>
      <div className="max-w-2xl">
        {/* Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="badge-info">{unreadCount} unread</span>
            <span className="text-sm text-text-muted">{notifications.length} total</span>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-secondary text-sm flex items-center gap-2">
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>

        {/* Notifications */}
        <div className="space-y-2">
          {notifications.length === 0 && (
            <div className="glass-card p-12 text-center">
              <Bell size={32} className="text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary">No notifications</p>
            </div>
          )}
          {notifications.map((n, i) => {
            const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
            const Icon = config.icon;
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`glass-card p-4 cursor-pointer transition-all hover:border-border-accent ${!n.read ? `border ${config.border} ${config.bg}` : ''}`}
                onClick={() => { markNotificationRead(n.id); if (n.link) navigate(n.link); }}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-lg ${config.bg} shrink-0 mt-0.5`}>
                    <Icon size={14} className={config.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-text-primary">{n.title}</span>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-accent-blue shrink-0 mt-1.5" />}
                    </div>
                    <p className="text-sm text-text-secondary mt-0.5">{n.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-text-muted">{formatDistanceToNow(new Date(n.time), { addSuffix: true })}</span>
                      {n.link && <span className="text-xs text-accent-blue flex items-center gap-1">View <ArrowRight size={10} /></span>}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
