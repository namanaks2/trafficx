import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Zap, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ROLES = [
  { value: 'general_user', label: 'General User', desc: 'View traffic and report incidents' },
  { value: 'traffic_analyst', label: 'Traffic Analyst', desc: 'Access analytics and predictions' },
  { value: 'traffic_authority', label: 'Traffic Authority', desc: 'Manage incidents and responses' },
  { value: 'administrator', label: 'Administrator', desc: 'Full system access' },
];

export default function Register() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '', role: 'general_user', terms: false });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { register } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required';
    if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match';
    if (!form.terms) e.terms = 'Please accept terms and conditions';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    const result = await register(form);
    setLoading(false);
    if (result.success) navigate('/dashboard');
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const passwordStrength = () => {
    const p = form.password;
    if (p.length === 0) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };
  const strength = passwordStrength();
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['', 'bg-status-critical', 'bg-status-warning', 'bg-yellow-400', 'bg-status-success'];

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent-blue/20 border border-accent-blue/40 flex items-center justify-center shadow-glow-blue">
            <Zap size={20} className="text-accent-blue" />
          </div>
          <div>
            <div className="text-lg font-bold text-text-primary tracking-widest">TRAFFICX</div>
            <div className="text-[10px] text-text-muted tracking-widest uppercase">Intelligence Network</div>
          </div>
        </div>

        <div className="glass-card p-7 rounded-2xl">
          <h2 className="text-xl font-bold text-text-primary mb-1">Create account</h2>
          <p className="text-sm text-text-secondary mb-6">Join the TrafficX intelligence network</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Full Name</label>
              <input className="input-field" placeholder="Alex Morgan" value={form.fullName} onChange={e => update('fullName', e.target.value)} />
              {errors.fullName && <p className="text-xs text-status-critical mt-1">{errors.fullName}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Email Address</label>
              <input type="email" className="input-field" placeholder="you@example.com" value={form.email} onChange={e => update('email', e.target.value)} />
              {errors.email && <p className="text-xs text-status-critical mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} className="input-field pr-10" placeholder="Min. 6 characters" value={form.password} onChange={e => update('password', e.target.value)} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`flex-1 h-1 rounded-full ${i <= strength ? strengthColors[strength] : 'bg-bg-elevated'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-text-muted">{strengthLabels[strength]}</p>
                </div>
              )}
              {errors.password && <p className="text-xs text-status-critical mt-1">{errors.password}</p>}
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Confirm Password</label>
              <div className="relative">
                <input type="password" className="input-field pr-10" placeholder="Repeat password" value={form.confirm} onChange={e => update('confirm', e.target.value)} />
                {form.confirm && form.confirm === form.password && (
                  <CheckCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-status-success" />
                )}
              </div>
              {errors.confirm && <p className="text-xs text-status-critical mt-1">{errors.confirm}</p>}
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Account Role</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(role => (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => update('role', role.value)}
                    className={`text-left p-2.5 rounded-lg border transition-all ${
                      form.role === role.value
                        ? 'border-accent-blue bg-accent-blue/10 text-text-primary'
                        : 'border-border-subtle bg-bg-secondary text-text-secondary hover:border-border-default'
                    }`}
                  >
                    <div className="text-xs font-semibold">{role.label}</div>
                    <div className="text-[10px] text-text-muted mt-0.5">{role.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Terms */}
            <div>
              <div className="flex items-start gap-2">
                <input type="checkbox" id="terms" className="mt-0.5 w-4 h-4 rounded border-border-default bg-bg-secondary accent-accent-blue" checked={form.terms} onChange={e => update('terms', e.target.checked)} />
                <label htmlFor="terms" className="text-sm text-text-secondary">
                  I agree to the{' '}
                  <span className="text-accent-blue cursor-pointer hover:underline">Terms of Service</span>
                  {' '}and{' '}
                  <span className="text-accent-blue cursor-pointer hover:underline">Privacy Policy</span>
                </label>
              </div>
              {errors.terms && <p className="text-xs text-status-critical mt-1">{errors.terms}</p>}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <span className="w-4 h-4 border-2 border-bg-primary/30 border-t-bg-primary rounded-full animate-spin" /> : <>Create Account <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="text-sm text-text-muted text-center mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-blue hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
