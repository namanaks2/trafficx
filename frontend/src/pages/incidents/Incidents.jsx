import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Plus, Search, X, MapPin, Clock, ChevronDown } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatusBadge from '../../components/ui/StatusBadge';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const TYPES      = ['accident','congestion','construction','closure','breakdown','hazard'];
const SEVERITIES = ['low','medium','high','critical'];
const STATUSES   = ['reported','under_verification','verified','responding','resolved'];
const TRANSITIONS = { reported:['under_verification','verified'], under_verification:['verified','reported'], verified:['responding'], responding:['resolved'], resolved:[] };
const SEV_COLOR  = { critical:'#EF4444', high:'#F59E0B', medium:'#38BDF8', low:'#22C55E' };

function ReportSheet({ onClose, onSubmit }) {
  const [form, setForm] = useState({ title:'', type:'accident', severity:'medium', location:'', description:'' });
  const up = (k,v) => setForm(p => ({...p,[k]:v}));
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', damping:30, stiffness:300 }}
        className="relative w-full rounded-t-3xl overflow-hidden"
        style={{ background:'linear-gradient(180deg,#131f30 0%,#0D1520 100%)', maxHeight:'90vh', overflowY:'auto' }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
          <h3 className="text-base font-bold text-text-primary">Report Incident</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-elevated text-text-muted"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Title *</label>
            <input className="input-field text-sm" placeholder="Brief description…" value={form.title} onChange={e=>up('title',e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Type</label>
              <select className="input-field text-sm" value={form.type} onChange={e=>up('type',e.target.value)}>
                {TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Severity</label>
              <select className="input-field text-sm" value={form.severity} onChange={e=>up('severity',e.target.value)}>
                {SEVERITIES.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Location *</label>
            <input className="input-field text-sm" placeholder="Road name, intersection…" value={form.location} onChange={e=>up('location',e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Description</label>
            <textarea className="input-field text-sm resize-none" rows={3} placeholder="Additional details…" value={form.description} onChange={e=>up('description',e.target.value)} />
          </div>
          <button
            onClick={() => { if (form.title && form.location) { onSubmit(form); onClose(); }}}
            className="w-full btn-primary text-sm py-3 rounded-2xl font-bold">
            Submit Report
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Incidents() {
  const { incidents, addIncident, updateIncident } = useApp();
  const { hasPermission } = useAuth();
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSev,    setFilterSev]    = useState('all');
  const [showForm,     setShowForm]     = useState(false);
  const [expandedId,   setExpandedId]   = useState(null);
  const canManage = hasPermission('manage_incidents');

  const filtered = incidents.filter(inc => {
    const ms = !search || inc.title.toLowerCase().includes(search.toLowerCase()) || inc.location.toLowerCase().includes(search.toLowerCase());
    const st = filterStatus === 'all' || inc.status === filterStatus;
    const sv = filterSev    === 'all' || inc.severity === filterSev;
    return ms && st && sv;
  });

  const stats = [
    { label:'Total',       value: incidents.length,                                             color:'text-text-primary' },
    { label:'Active',      value: incidents.filter(i=>i.status!=='resolved').length,            color:'text-status-warning' },
    { label:'High Priority',value:incidents.filter(i=>i.severity==='critical'||i.severity==='high').length, color:'text-status-critical' },
    { label:'Resolved',    value: incidents.filter(i=>i.status==='resolved').length,            color:'text-status-success' },
  ];

  return (
    <AppLayout title="Incidents" subtitle="Track, verify, resolve">

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {stats.map(s => (
          <div key={s.label} className="glass-card p-2.5 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-text-muted mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input className="input-field pl-9 text-sm" placeholder="Search incidents…" value={search} onChange={e=>setSearch(e.target.value)} />
      </div>

      {/* Filters row */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth:'none' }}>
        <select className="input-field text-xs flex-1 min-w-[120px]" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          {STATUSES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
        </select>
        <select className="input-field text-xs flex-1 min-w-[120px]" value={filterSev} onChange={e=>setFilterSev(e.target.value)}>
          <option value="all">All Severities</option>
          {SEVERITIES.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </select>
      </div>

      {/* Report button */}
      <button onClick={() => setShowForm(true)}
        className="w-full btn-primary flex items-center justify-center gap-2 py-3 rounded-2xl font-bold mb-4">
        <Plus size={16} /> Report Incident
      </button>

      {/* Incident cards */}
      <div className="space-y-2.5">
        {filtered.length === 0 && (
          <div className="glass-card p-10 text-center">
            <AlertTriangle size={28} className="text-text-muted mx-auto mb-2" />
            <p className="text-sm text-text-secondary">No incidents match filters</p>
          </div>
        )}
        {filtered.map(inc => (
          <motion.div key={inc.id} layout initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="rounded-2xl border border-border-subtle overflow-hidden bg-bg-card">
            {/* Card header — always visible */}
            <button className="w-full text-left p-4" onClick={() => setExpandedId(expandedId===inc.id ? null : inc.id)}>
              <div className="flex items-start gap-3">
                <div className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: SEV_COLOR[inc.severity] || '#94A3B8',
                           boxShadow: inc.severity==='critical' ? `0 0 6px ${SEV_COLOR.critical}` : 'none' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary leading-tight">{inc.title}</p>
                  <p className="text-[10px] text-text-muted font-mono mt-0.5">{inc.id}</p>
                  <div className="flex items-center gap-1 text-[10px] text-text-muted mt-1">
                    <MapPin size={9} /><span className="truncate">{inc.location}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-text-muted mt-0.5">
                    <Clock size={9} />{formatDistanceToNow(new Date(inc.reportedAt), { addSuffix:true })}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <StatusBadge status={inc.severity} />
                  <StatusBadge status={inc.status} />
                  <ChevronDown size={13} className={`text-text-muted transition-transform mt-1 ${expandedId===inc.id?'rotate-180':''}`} />
                </div>
              </div>
            </button>

            {/* Expanded details */}
            <AnimatePresence>
              {expandedId === inc.id && (
                <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
                  className="overflow-hidden border-t border-border-subtle">
                  <div className="p-4 space-y-3">
                    {inc.description && <p className="text-xs text-text-secondary">{inc.description}</p>}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        ['Reported By', inc.reportedBy],
                        ['Assigned To', inc.assignedTo || 'Unassigned'],
                        ['Affected Lanes', inc.affectedLanes],
                        ['Est. Clearance', inc.estimatedClearance],
                      ].map(([l,v]) => (
                        <div key={l} className="p-2 rounded-xl bg-bg-secondary">
                          <p className="text-[9px] text-text-muted uppercase tracking-wider">{l}</p>
                          <p className="text-text-secondary font-medium mt-0.5 truncate">{v}</p>
                        </div>
                      ))}
                    </div>
                    {canManage && TRANSITIONS[inc.status]?.length > 0 && (
                      <div>
                        <p className="text-[10px] text-text-muted mb-2 uppercase tracking-wider">Update Status</p>
                        <div className="flex flex-wrap gap-2">
                          {TRANSITIONS[inc.status].map(next => (
                            <button key={next} onClick={() => updateIncident(inc.id, { status:next })}
                              className="px-3 py-1.5 rounded-xl border border-border-default text-xs text-text-secondary hover:border-accent-blue hover:text-accent-blue transition-all">
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

      <AnimatePresence>
        {showForm && <ReportSheet onClose={() => setShowForm(false)} onSubmit={addIncident} />}
      </AnimatePresence>
    </AppLayout>
  );
}
