import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Bell, Shield, Eye, EyeOff, CheckCircle, AlertCircle, Palette, Sun, Moon, BarChart3, Database, Network, ServerCog, ArrowUpRight } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';

const ROLE_INFO = {
  administrator:    { label:'Administrator',    color:'text-status-critical', border:'border-status-critical/20', bg:'bg-status-critical/10',  desc:'Full system access — manage all users, sources and configuration.' },
  traffic_authority:{ label:'Traffic Authority',color:'text-status-warning',  border:'border-status-warning/20',  bg:'bg-status-warning/10',   desc:'Verify and respond to incidents. Access analytics and predictions.' },
  traffic_analyst:  { label:'Traffic Analyst',  color:'text-accent-blue',     border:'border-accent-blue/20',     bg:'bg-accent-blue/10',      desc:'View analytics, predictions and network data.' },
  general_user:     { label:'General User',     color:'text-status-success',  border:'border-status-success/20',  bg:'bg-status-success/10',   desc:'View dashboard, map and report incidents.' },
};

function Toggle({ active, onToggle }) {
  return (
    <button onClick={onToggle} role="switch" aria-checked={active}
      className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${active ? 'bg-accent-blue' : 'bg-bg-elevated'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function Settings() {
  const { user, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [tab, setTab] = useState('profile');
  const [name,    setName]    = useState(user?.name || '');
  const [saved,   setSaved]   = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [curPwd,  setCurPwd]  = useState('');
  const [newPwd,  setNewPwd]  = useState('');
  const [confPwd, setConfPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdMsg,  setPwdMsg]  = useState(null);
  const [secToggles, setSecToggles] = useLocalStorage('trafficx_sec', { twoFactor:false, loginNotif:true, sessionTimeout:true });
  const [notifPrefs, setNotifPrefs] = useLocalStorage('trafficx_notif', { severeCongest:true, newIncident:true, nodeOffline:true, prediction:true, resolution:false });

  const ri = ROLE_INFO[user?.role] || ROLE_INFO.general_user;

  const handleSave = () => {
    if (!name.trim()) { setSaveErr('Name cannot be empty'); return; }
    setSaveErr('');
    updateProfile({ name: name.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handlePwd = () => {
    if (!curPwd)           { setPwdMsg({ type:'error', text:'Enter current password' }); return; }
    if (newPwd.length < 6) { setPwdMsg({ type:'error', text:'Min 6 characters' });       return; }
    if (newPwd !== confPwd){ setPwdMsg({ type:'error', text:'Passwords do not match' }); return; }
    setPwdMsg({ type:'success', text:'Password updated (demo — no real change)' });
    setCurPwd(''); setNewPwd(''); setConfPwd('');
    setTimeout(() => setPwdMsg(null), 3000);
  };

  const TABS = [
    { id:'profile',       label:'Profile', icon:User },
    { id:'security',      label:'Security',icon:Lock },
    { id:'notifications', label:'Alerts',  icon:Bell },
    { id:'appearance',    label:'Appearance', icon:Palette },
    { id:'role',          label:'Role',    icon:Shield },
  ];

  return (
    <AppLayout title="Settings" subtitle="Account preferences">

      {/* Tab scroll row */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth:'none' }}>
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border shrink-0 transition-all ${
                tab===t.id ? 'bg-accent-blue text-bg-primary border-accent-blue' : 'bg-bg-card border-border-subtle text-text-muted'
              }`}>
              <Icon size={12} /> {t.label}
            </button>
          );
        })}
      </div>

      <motion.div key={tab} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.18 }}
        className="glass-card p-5 rounded-2xl">

        {/* Profile */}
        {tab === 'profile' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-text-primary">Personal Information</h3>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-accent-blue/20 border-2 border-accent-blue/40 flex items-center justify-center text-2xl font-bold text-accent-blue select-none">
                {name.charAt(0).toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{name || '—'}</p>
                <p className="text-xs text-text-muted">{user?.email}</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Full Name</label>
              <input className="input-field text-sm" value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Email</label>
              <input className="input-field text-sm opacity-60 cursor-not-allowed" value={user?.email || ''} disabled />
              <p className="text-[10px] text-text-muted mt-1">Cannot change in demo mode</p>
            </div>
            {saveErr && <div className="flex items-center gap-2 text-xs text-status-critical"><AlertCircle size={13} />{saveErr}</div>}
            <button onClick={handleSave} className="w-full btn-primary py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2">
              {saved ? <><CheckCircle size={15} /> Saved!</> : 'Save Changes'}
            </button>
          </div>
        )}

        {/* Security */}
        {tab === 'security' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-text-primary">Change Password</h3>
            {[
              ['Current Password', curPwd, setCurPwd, 'Current password'],
              ['New Password',     newPwd, setNewPwd, 'Min 6 characters'],
              ['Confirm New',      confPwd,setConfPwd,'Repeat new password'],
            ].map(([label,val,setter,ph],i) => (
              <div key={i}>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">{label}</label>
                <div className="relative">
                  <input type={showPwd?'text':'password'} className="input-field text-sm pr-10"
                    placeholder={ph} value={val} onChange={e=>setter(e.target.value)} />
                  {i===0 && (
                    <button onClick={()=>setShowPwd(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                      {showPwd?<EyeOff size={15}/>:<Eye size={15}/>}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {pwdMsg && (
              <div className={`flex items-center gap-2 text-xs ${pwdMsg.type==='success'?'text-status-success':'text-status-critical'}`}>
                {pwdMsg.type==='success'?<CheckCircle size={13}/>:<AlertCircle size={13}/>} {pwdMsg.text}
              </div>
            )}
            <button onClick={handlePwd} className="w-full btn-primary py-3 rounded-2xl font-bold text-sm">Update Password</button>
            <div className="pt-2 border-t border-border-subtle space-y-3">
              <h4 className="text-xs font-bold text-text-primary">Account Security</h4>
              {[
                { key:'twoFactor',     label:'Two-factor auth',     desc:'Extra layer of security' },
                { key:'loginNotif',    label:'Login notifications',  desc:'Alert on new sign-ins' },
                { key:'sessionTimeout',label:'Session timeout',      desc:'Auto-logout after 24h' },
              ].map(s => (
                <div key={s.key} className="flex items-center justify-between p-3 rounded-xl bg-bg-secondary border border-border-subtle">
                  <div><p className="text-sm text-text-primary">{s.label}</p><p className="text-[10px] text-text-muted">{s.desc}</p></div>
                  <Toggle active={secToggles[s.key]} onToggle={() => setSecToggles(p=>({...p,[s.key]:!p[s.key]}))} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Appearance */}
        {tab === 'appearance' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-1">Appearance</h3>
            </div>

            <div>
              <p className="text-xs font-semibold text-text-secondary mb-2">Theme</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id:'dark', label:'Dark', icon:Moon },
                  { id:'light', label:'Light', icon:Sun },
                ].map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setTheme(id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      theme === id
                        ? 'border-accent-blue bg-accent-blue/10'
                        : 'border-border-subtle bg-bg-secondary hover:border-border-default'
                    }`}>
                    <div className="flex items-center justify-between mb-3">
                      <Icon size={16} className={theme === id ? 'text-accent-blue' : 'text-text-secondary'} />
                      {theme === id && <CheckCircle size={14} className="text-accent-blue" />}
                    </div>
                    <p className="text-xs font-semibold text-text-primary">{label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-border-subtle">
              <p className="text-xs font-semibold text-text-secondary mb-2">Operations</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label:'Analytics', icon:BarChart3, path:'/analytics' },
                  { label:'Data Sources', icon:Database, path:'/datasources' },
                  { label:'Network', icon:Network, path:'/network' },
                  { label:'System Health', icon:ServerCog, path:'/system' },
                ].map(({ label, icon: Icon, path }) => (
                  <button key={path} onClick={() => navigate(path)}
                    className="flex items-center gap-2 p-3 rounded-xl border border-border-subtle bg-bg-secondary text-left hover:border-border-accent transition-colors">
                    <Icon size={14} className="text-accent-blue" />
                    <span className="flex-1 text-xs font-medium text-text-primary">{label}</span>
                    <ArrowUpRight size={12} className="text-text-muted" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Notifications */}
        {tab === 'notifications' && (
          <div>
            <h3 className="text-sm font-bold text-text-primary mb-1">Notification Preferences</h3>
            <p className="text-xs text-text-muted mb-4">Saved to your browser.</p>
            <div className="space-y-3">
              {[
                { key:'severeCongest', label:'Severe Congestion',  desc:'When index exceeds 80%' },
                { key:'newIncident',   label:'New Incidents',      desc:'When submitted' },
                { key:'nodeOffline',   label:'Node Disconnections',desc:'When a node goes offline' },
                { key:'prediction',    label:'High-Risk Predictions',desc:'AI predicts severe congestion' },
                { key:'resolution',    label:'Incident Resolved',  desc:'When marked resolved' },
              ].map(p => (
                <div key={p.key} className="flex items-center justify-between p-3 rounded-xl bg-bg-secondary border border-border-subtle">
                  <div><p className="text-sm text-text-primary">{p.label}</p><p className="text-[10px] text-text-muted">{p.desc}</p></div>
                  <Toggle active={notifPrefs[p.key]} onToggle={() => setNotifPrefs(prev=>({...prev,[p.key]:!prev[p.key]}))} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Role */}
        {tab === 'role' && (
          <div>
            <h3 className="text-sm font-bold text-text-primary mb-4">Role & Permissions</h3>
            <div className={`p-4 rounded-2xl border mb-4 ${ri.bg} ${ri.border}`}>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={16} className={ri.color} />
                <span className={`text-sm font-bold ${ri.color}`}>{ri.label}</span>
              </div>
              <p className="text-xs text-text-secondary">{ri.desc}</p>
            </div>
            <p className="text-xs font-semibold text-text-secondary mb-3">Your Permissions</p>
            <div className="grid grid-cols-1 gap-1.5">
              {user?.permissions?.map(p => (
                <div key={p} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-secondary text-xs text-text-secondary">
                  <CheckCircle size={12} className="text-status-success shrink-0" />
                  {p.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
}
