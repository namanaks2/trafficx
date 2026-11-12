import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Bell, Shield, Eye, EyeOff, CheckCircle } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';

const ROLE_INFO = {
  administrator: { label: 'Administrator', desc: 'Full system access — manage all users, sources, incidents, and configuration.', color: 'text-status-critical', bg: 'bg-status-critical/10 border-status-critical/20' },
  traffic_authority: { label: 'Traffic Authority', desc: 'Verify and respond to incidents. Access analytics and predictions.', color: 'text-status-warning', bg: 'bg-status-warning/10 border-status-warning/20' },
  traffic_analyst: { label: 'Traffic Analyst', desc: 'View analytics, predictions, and network data. Read-only incidents.', color: 'text-accent-blue', bg: 'bg-accent-blue/10 border-accent-blue/20' },
  general_user: { label: 'General User', desc: 'View dashboard, map, and report incidents.', color: 'text-status-success', bg: 'bg-status-success/10 border-status-success/20' },
};

export default function Settings() {
  const { user, updateProfile } = useAuth();
  const [tab, setTab] = useState('profile');
  const [saved, setSaved] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });
  const [notifPrefs, setNotifPrefs] = useState({
    severeCongest: true, newIncident: true, nodeOffline: true, prediction: true, resolution: false,
  });

  const handleSave = () => {
    updateProfile({ name: profile.name });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const roleInfo = ROLE_INFO[user?.role] || ROLE_INFO.general_user;

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'role', label: 'Role & Access', icon: Shield },
  ];

  return (
    <AppLayout title="Settings" subtitle="Account and application preferences">
      <div className="max-w-2xl">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 glass-card p-1 rounded-xl w-fit">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${tab === t.id ? 'bg-accent-blue/15 text-accent-blue font-medium' : 'text-text-muted hover:text-text-secondary'}`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 rounded-2xl">
          {/* Profile */}
          {tab === 'profile' && (
            <div className="space-y-5">
              <div>
                <h3 className="section-title mb-4">Personal Information</h3>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 rounded-full bg-accent-blue/20 border-2 border-accent-blue/40 flex items-center justify-center text-2xl font-bold text-accent-blue">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{profile.name}</p>
                    <p className="text-xs text-text-muted">{user?.email}</p>
                    <button className="text-xs text-accent-blue hover:underline mt-1">Change avatar</button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Full Name</label>
                <input className="input-field" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Email Address</label>
                <input className="input-field" value={profile.email} disabled />
                <p className="text-xs text-text-muted mt-1">Email cannot be changed in demo mode</p>
              </div>
              <button onClick={handleSave} className="btn-primary flex items-center gap-2">
                {saved ? <><CheckCircle size={15} /> Saved!</> : 'Save Changes'}
              </button>
            </div>
          )}

          {/* Security */}
          {tab === 'security' && (
            <div className="space-y-5">
              <h3 className="section-title">Password & Security</h3>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Current Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} className="input-field pr-10" placeholder="••••••••" />
                  <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">New Password</label>
                <input type="password" className="input-field" placeholder="Min. 8 characters" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Confirm New Password</label>
                <input type="password" className="input-field" placeholder="Repeat new password" />
              </div>
              <button className="btn-primary">Update Password</button>

              <div className="mt-5 pt-5 border-t border-border-subtle">
                <h4 className="text-sm font-semibold text-text-primary mb-3">Account Security</h4>
                <div className="space-y-3">
                  {[
                    { label: 'Two-factor authentication', desc: 'Adds an extra layer of security', enabled: false },
                    { label: 'Login notifications', desc: 'Get notified of new sign-ins', enabled: true },
                    { label: 'Session timeout', desc: 'Auto-logout after 24 hours of inactivity', enabled: true },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-bg-secondary border border-border-subtle">
                      <div>
                        <p className="text-sm text-text-primary">{s.label}</p>
                        <p className="text-xs text-text-muted">{s.desc}</p>
                      </div>
                      <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${s.enabled ? 'bg-accent-blue' : 'bg-bg-elevated'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${s.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Notifications */}
          {tab === 'notifications' && (
            <div>
              <h3 className="section-title mb-4">Notification Preferences</h3>
              <div className="space-y-3">
                {[
                  { key: 'severeCongest', label: 'Severe Congestion Alerts', desc: 'When congestion index exceeds 80%' },
                  { key: 'newIncident', label: 'New Incident Reports', desc: 'When a new incident is submitted' },
                  { key: 'nodeOffline', label: 'Node Disconnections', desc: 'When a monitoring node goes offline' },
                  { key: 'prediction', label: 'High-Risk Predictions', desc: 'AI predicts severe congestion' },
                  { key: 'resolution', label: 'Incident Resolutions', desc: 'When incidents are marked resolved' },
                ].map(pref => (
                  <div key={pref.key} className="flex items-center justify-between p-3 rounded-lg bg-bg-secondary border border-border-subtle">
                    <div>
                      <p className="text-sm text-text-primary">{pref.label}</p>
                      <p className="text-xs text-text-muted">{pref.desc}</p>
                    </div>
                    <button
                      onClick={() => setNotifPrefs(p => ({ ...p, [pref.key]: !p[pref.key] }))}
                      className={`w-10 h-5 rounded-full relative transition-colors ${notifPrefs[pref.key] ? 'bg-accent-blue' : 'bg-bg-elevated'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${notifPrefs[pref.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Role */}
          {tab === 'role' && (
            <div>
              <h3 className="section-title mb-4">Role & Permissions</h3>
              <div className={`p-4 rounded-xl border mb-5 ${roleInfo.bg}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={16} className={roleInfo.color} />
                  <span className={`text-sm font-bold ${roleInfo.color}`}>{roleInfo.label}</span>
                </div>
                <p className="text-sm text-text-secondary">{roleInfo.desc}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-text-secondary mb-3">Your Permissions</p>
                <div className="grid grid-cols-2 gap-2">
                  {user?.permissions?.map(p => (
                    <div key={p} className="flex items-center gap-2 text-xs text-text-secondary">
                      <CheckCircle size={12} className="text-status-success shrink-0" />
                      {p.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
