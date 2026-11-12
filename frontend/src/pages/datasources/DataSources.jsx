import { useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Plus, Edit, Power, RefreshCw, CheckCircle, XCircle, AlertCircle, Wifi } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatusBadge from '../../components/ui/StatusBadge';
import { dataSources as initialSources } from '../../data/demoData';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const SOURCE_TYPE_ICONS = {
  sensor: '🔌', camera: '📹', community: '👥', dataset: '📊', gps: '📡', api: '🌐',
};

const SOURCE_TYPE_COLORS = {
  sensor: 'text-accent-blue', camera: 'text-accent-purple', community: 'text-status-success',
  dataset: 'text-status-warning', gps: 'text-status-critical', api: 'text-accent-cyan',
};

export default function DataSources() {
  const [sources, setSources] = useState(initialSources);
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_sources');

  const toggleSource = (id) => {
    setSources(prev => prev.map(s => s.id === id ? {
      ...s,
      status: s.status === 'active' ? 'disconnected' : 'active',
      lastSync: s.status !== 'active' ? new Date().toISOString() : s.lastSync,
    } : s));
  };

  const refreshSource = (id) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, lastSync: new Date().toISOString(), status: 'active' } : s));
  };

  const stats = {
    total: sources.length,
    active: sources.filter(s => s.status === 'active').length,
    warning: sources.filter(s => s.status === 'warning').length,
    totalRecords: sources.reduce((a, s) => a + s.records, 0),
  };

  return (
    <AppLayout title="Data Sources" subtitle="Manage traffic monitoring data inputs">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Sources', value: stats.total, color: 'text-text-primary' },
          { label: 'Active', value: stats.active, color: 'text-status-success' },
          { label: 'Warning', value: stats.warning, color: 'text-status-warning' },
          { label: 'Total Records', value: stats.totalRecords.toLocaleString(), color: 'text-accent-blue' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-4">
            <p className="text-xs text-text-muted">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">Data Source Registry</h3>
        {canManage && (
          <button className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} />
            Add Source
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sources.map((source, i) => (
          <motion.div
            key={source.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass-card p-5 hover:border-border-accent transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{SOURCE_TYPE_ICONS[source.type] || '📦'}</div>
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">{source.name}</h4>
                  <span className={`text-xs capitalize ${SOURCE_TYPE_COLORS[source.type] || 'text-text-muted'}`}>{source.type}</span>
                </div>
              </div>
              <StatusBadge status={source.status} />
            </div>

            <div className="space-y-2 text-xs mb-4">
              <div className="flex justify-between">
                <span className="text-text-muted">Location</span>
                <span className="text-text-secondary">{source.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Records</span>
                <span className="text-text-primary font-medium">{source.records.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Last Sync</span>
                <span className="text-text-secondary">{formatDistanceToNow(new Date(source.lastSync), { addSuffix: true })}</span>
              </div>
            </div>

            {/* Data quality */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-text-muted">Data Quality</span>
                <span className={`font-semibold ${source.quality >= 90 ? 'text-status-success' : source.quality >= 70 ? 'text-status-warning' : 'text-status-critical'}`}>{source.quality}%</span>
              </div>
              <div className="h-1.5 bg-bg-elevated rounded-full">
                <div
                  className={`h-full rounded-full ${source.quality >= 90 ? 'bg-status-success' : source.quality >= 70 ? 'bg-status-warning' : 'bg-status-critical'}`}
                  style={{ width: `${source.quality}%` }}
                />
              </div>
            </div>

            {canManage && (
              <div className="flex gap-2">
                <button
                  onClick={() => refreshSource(source.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg bg-bg-secondary border border-border-subtle text-text-muted hover:border-accent-blue/50 hover:text-accent-blue transition-all"
                >
                  <RefreshCw size={12} />
                  Refresh
                </button>
                <button
                  onClick={() => toggleSource(source.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg border transition-all ${
                    source.status === 'active'
                      ? 'bg-status-critical/10 border-status-critical/30 text-status-critical hover:bg-status-critical/20'
                      : 'bg-status-success/10 border-status-success/30 text-status-success hover:bg-status-success/20'
                  }`}
                >
                  <Power size={12} />
                  {source.status === 'active' ? 'Disable' : 'Enable'}
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
