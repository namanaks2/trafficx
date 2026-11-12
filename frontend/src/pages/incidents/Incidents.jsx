import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Plus, Filter, Search, X, MapPin, Clock, User, ChevronDown } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatusBadge from '../../components/ui/StatusBadge';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const INCIDENT_TYPES = ['accident', 'congestion', 'construction', 'closure', 'breakdown', 'hazard'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['reported', 'under_verification', 'verified', 'responding', 'resolved'];
const STATUS_TRANSITIONS = {
  reported: ['under_verification', 'verified'],
  under_verification: ['verified', 'reported'],
  verified: ['responding'],
  responding: ['resolved'],
  resolved: [],
};

function IncidentForm({ onClose, onSubmit }) {
  const [form, setForm] = useState({ title: '', type: 'accident', severity: 'medium', location: '', description: '', lat: 40.7128, lng: -74.006 });
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-bg-primary/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card rounded-2xl p-6 w-full max-w-lg border border-border-default">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-text-primary">Report Incident</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Incident Title *</label>
            <input className="input-field" placeholder="Brief description" value={form.title} onChange={e => update('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Type</label>
              <select className="input-field" value={form.type} onChange={e => update('type', e.target.value)}>
                {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Severity</label>
              <select className="input-field" value={form.severity} onChange={e => update('severity', e.target.value)}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Location *</label>
            <input className="input-field" placeholder="Road name, intersection..." value={form.location} onChange={e => update('location', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Description</label>
            <textarea className="input-field resize-none" rows={3} placeholder="Additional details..." value={form.description} onChange={e => update('description', e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => { if (form.title && form.location) { onSubmit(form); onClose(); } }}
              className="btn-primary flex-1"
            >
              Submit Report
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function Incidents() {
  const { incidents, addIncident, updateIncident } = useApp();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const canManage = hasPermission('manage_incidents');

  const filtered = incidents.filter(inc => {
    const matchSearch = !search || inc.title.toLowerCase().includes(search.toLowerCase()) || inc.location.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || inc.status === filterStatus;
    const matchSeverity = filterSeverity === 'all' || inc.severity === filterSeverity;
    return matchSearch && matchStatus && matchSeverity;
  });

  const stats = {
    total: incidents.length,
    active: incidents.filter(i => !['resolved'].includes(i.status)).length,
    critical: incidents.filter(i => i.severity === 'critical' || i.severity === 'high').length,
    resolved: incidents.filter(i => i.status === 'resolved').length,
  };

  return (
    <AppLayout title="Incident Management" subtitle="Track, verify, and resolve traffic incidents">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Incidents', value: stats.total, color: 'text-text-primary' },
          { label: 'Active', value: stats.active, color: 'text-status-warning' },
          { label: 'High Priority', value: stats.critical, color: 'text-status-critical' },
          { label: 'Resolved', value: stats.resolved, color: 'text-status-success' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-4">
            <p className="text-xs text-text-muted">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input className="input-field pl-9 text-sm" placeholder="Search incidents..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-auto text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
        </select>
        <select className="input-field w-auto text-sm" value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
          <option value="all">All Severities</option>
          {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </select>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 shrink-0">
          <Plus size={15} /> Report Incident
        </button>
      </div>

      {/* Incidents list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="glass-card p-12 text-center">
            <AlertTriangle size={32} className="text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary">No incidents match your filters</p>
          </div>
        )}
        {filtered.map(inc => (
          <motion.div key={inc.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
            <div
              className="p-4 cursor-pointer"
              onClick={() => setExpandedId(expandedId === inc.id ? null : inc.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                    inc.severity === 'critical' ? 'bg-status-critical animate-pulse' :
                    inc.severity === 'high' ? 'bg-status-critical' :
                    inc.severity === 'medium' ? 'bg-status-warning' : 'bg-status-success'
                  }`} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-text-primary">{inc.title}</span>
                      <span className="text-xs text-text-muted font-mono">{inc.id}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-text-muted">
                      <MapPin size={10} />
                      {inc.location}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
                      <Clock size={10} />
                      {formatDistanceToNow(new Date(inc.reportedAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={inc.severity} />
                  <StatusBadge status={inc.status} />
                  <ChevronDown size={14} className={`text-text-muted transition-transform ${expandedId === inc.id ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>

            <AnimatePresence>
              {expandedId === inc.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-border-subtle px-4 pb-4 overflow-hidden"
                >
                  <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-text-muted mb-1">Description</p>
                        <p className="text-sm text-text-secondary">{inc.description || 'No description provided.'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-text-muted">Reported By</p>
                          <p className="text-text-secondary font-medium">{inc.reportedBy}</p>
                        </div>
                        <div>
                          <p className="text-text-muted">Assigned To</p>
                          <p className="text-text-secondary font-medium">{inc.assignedTo || 'Unassigned'}</p>
                        </div>
                        <div>
                          <p className="text-text-muted">Affected Lanes</p>
                          <p className="text-text-secondary font-medium">{inc.affectedLanes}</p>
                        </div>
                        <div>
                          <p className="text-text-muted">Est. Clearance</p>
                          <p className="text-text-secondary font-medium">{inc.estimatedClearance}</p>
                        </div>
                      </div>
                    </div>

                    {canManage && STATUS_TRANSITIONS[inc.status]?.length > 0 && (
                      <div>
                        <p className="text-xs text-text-muted mb-2">Update Status</p>
                        <div className="flex flex-wrap gap-2">
                          {STATUS_TRANSITIONS[inc.status].map(next => (
                            <button
                              key={next}
                              onClick={() => updateIncident(inc.id, { status: next })}
                              className="btn-secondary text-xs px-3 py-1.5"
                            >
                              → {next.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {showForm && <IncidentForm onClose={() => setShowForm(false)} onSubmit={addIncident} />}
    </AppLayout>
  );
}
