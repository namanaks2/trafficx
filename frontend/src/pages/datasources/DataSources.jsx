import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Power, RefreshCw, X, Save } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatusBadge from '../../components/ui/StatusBadge';
import { dataSources as initialSources } from '../../data/demoData';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const ICONS  = { sensor:'🔌', camera:'📹', community:'👥', dataset:'📊', gps:'📡', api:'🌐' };
const COLORS = { sensor:'text-accent-blue', camera:'text-accent-purple', community:'text-status-success', dataset:'text-status-warning', gps:'text-status-critical', api:'text-accent-cyan' };
const TYPES  = ['sensor','camera','community','dataset','gps','api'];

function AddSheet({ onClose, onSave }) {
  const [form, setForm] = useState({ name:'', type:'sensor', location:'', status:'active' });
  const [err,  setErr]  = useState({});
  const up = (k,v) => setForm(p=>({...p,[k]:v}));
  const validate = () => {
    const e = {};
    if (!form.name.trim())     e.name = 'Required';
    if (!form.location.trim()) e.location = 'Required';
    return e;
  };
  const save = () => {
    const e = validate();
    if (Object.keys(e).length) { setErr(e); return; }
    onSave({ id:`src-${Date.now()}`, ...form, quality:85, records:0, lastSync:new Date().toISOString() });
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', damping:30, stiffness:300 }}
        className="relative w-full rounded-t-3xl overflow-hidden"
        style={{ background:'linear-gradient(180deg,#131f30 0%,#0D1520 100%)', maxHeight:'85vh', overflowY:'auto' }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-white/20 rounded-full"/></div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
          <h3 className="text-base font-bold text-text-primary">Add Data Source</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-elevated text-text-muted"><X size={16}/></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Name *</label>
            <input className="input-field text-sm" placeholder="e.g. City Center Sensor Array" value={form.name} onChange={e=>up('name',e.target.value)} />
            {err.name && <p className="text-[10px] text-status-critical mt-1">{err.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Type</label>
              <select className="input-field text-sm" value={form.type} onChange={e=>up('type',e.target.value)}>
                {TYPES.map(t=><option key={t} value={t}>{ICONS[t]} {t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Status</label>
              <select className="input-field text-sm" value={form.status} onChange={e=>up('status',e.target.value)}>
                <option value="active">Active</option>
                <option value="warning">Warning</option>
                <option value="disconnected">Disconnected</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Location *</label>
            <input className="input-field text-sm" placeholder="Zone or area" value={form.location} onChange={e=>up('location',e.target.value)} />
            {err.location && <p className="text-[10px] text-status-critical mt-1">{err.location}</p>}
          </div>
          <button onClick={save} className="w-full btn-primary py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2">
            <Save size={14}/> Save Source
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function DataSources() {
  const [sources,    setSources]    = useState(initialSources);
  const [showAdd,    setShowAdd]    = useState(false);
  const [refreshing, setRefreshing] = useState(null);
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_sources');

  const addSource = s => setSources(p=>[s,...p]);
  const toggle    = id => setSources(p=>p.map(s=>s.id===id?{...s,status:s.status==='active'?'disconnected':'active',lastSync:new Date().toISOString()}:s));
  const refresh   = id => { setRefreshing(id); setTimeout(()=>{ setSources(p=>p.map(s=>s.id===id?{...s,lastSync:new Date().toISOString(),status:'active',quality:Math.min(100,s.quality+1)}:s)); setRefreshing(null); },1200); };

  const stats = [
    { label:'Total',   value:sources.length,                                   color:'text-text-primary' },
    { label:'Active',  value:sources.filter(s=>s.status==='active').length,    color:'text-status-success' },
    { label:'Warning', value:sources.filter(s=>s.status==='warning').length,   color:'text-status-warning' },
    { label:'Records', value:(sources.reduce((a,s)=>a+s.records,0)/1000).toFixed(0)+'k', color:'text-accent-blue' },
  ];

  return (
    <AppLayout title="Data Sources" subtitle="Manage traffic data inputs">

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {stats.map(s=>(
          <div key={s.label} className="glass-card p-2.5 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {canManage && (
        <button onClick={()=>setShowAdd(true)}
          className="w-full btn-primary flex items-center justify-center gap-2 py-3 rounded-2xl font-bold mb-4">
          <Plus size={15}/> Add Source
        </button>
      )}

      {/* Source cards */}
      <div className="space-y-3">
        {sources.map((s,i) => (
          <motion.div key={s.id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.05 }}
            className="glass-card p-4 rounded-2xl">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{ICONS[s.type]||'📦'}</span>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-text-primary truncate">{s.name}</h4>
                  <span className={`text-[10px] font-medium capitalize ${COLORS[s.type]||'text-text-muted'}`}>{s.type}</span>
                </div>
              </div>
              <StatusBadge status={s.status} />
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
              <div><span className="text-text-muted">Location</span><p className="text-text-secondary font-medium truncate">{s.location}</p></div>
              <div><span className="text-text-muted">Records</span><p className="text-text-secondary font-medium">{s.records.toLocaleString()}</p></div>
              <div className="col-span-2"><span className="text-text-muted">Last sync </span><span className="text-text-secondary">{formatDistanceToNow(new Date(s.lastSync),{addSuffix:true})}</span></div>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-text-muted">Data Quality</span>
                <span className={`font-bold ${s.quality>=90?'text-status-success':s.quality>=70?'text-status-warning':'text-status-critical'}`}>{s.quality}%</span>
              </div>
              <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${s.quality>=90?'bg-status-success':s.quality>=70?'bg-status-warning':'bg-status-critical'}`} style={{ width:`${s.quality}%` }}/>
              </div>
            </div>

            {canManage && (
              <div className="flex gap-2">
                <button onClick={()=>refresh(s.id)} disabled={refreshing===s.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border-subtle text-xs text-text-muted hover:border-accent-blue hover:text-accent-blue transition-all">
                  <RefreshCw size={12} className={refreshing===s.id?'animate-spin':''}/> {refreshing===s.id?'Syncing…':'Refresh'}
                </button>
                <button onClick={()=>toggle(s.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium transition-all ${
                    s.status==='active'?'bg-status-critical/10 border-status-critical/30 text-status-critical':'bg-status-success/10 border-status-success/30 text-status-success'
                  }`}>
                  <Power size={12}/> {s.status==='active'?'Disable':'Enable'}
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showAdd && <AddSheet onClose={()=>setShowAdd(false)} onSave={addSource}/>}
      </AnimatePresence>
    </AppLayout>
  );
}
