import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Zap, AlertCircle, ArrowRight, Activity, Network, Shield, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

function TrafficAnimation() {
  return (
    <div className="relative w-full h-full overflow-hidden select-none pointer-events-none">
      {/* Grid */}
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'linear-gradient(rgba(56,189,248,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.3) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
      />

      {/* Floating KPI cards */}
      {[
        { label: 'Active Nodes', value: '9/10', color: 'text-accent-blue', x: '15%', y: '20%', delay: 0 },
        { label: 'Vehicles Now', value: '4,412', color: 'text-status-success', x: '60%', y: '15%', delay: 0.3 },
        { label: 'Congestion', value: '68%', color: 'text-status-warning', x: '10%', y: '65%', delay: 0.6 },
        { label: 'Network Health', value: '97.3%', color: 'text-accent-purple', x: '62%', y: '72%', delay: 0.9 },
        { label: 'Incidents', value: '4 Active', color: 'text-status-critical', x: '35%', y: '45%', delay: 1.2 },
      ].map((card, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 0.85, y: 0 }}
          transition={{ delay: card.delay + 0.5, duration: 0.6 }}
          style={{ position: 'absolute', left: card.x, top: card.y }}
          className="glass-card px-3 py-2 rounded-lg border border-border-subtle"
        >
          <p className="text-[10px] text-text-muted">{card.label}</p>
          <p className={`text-sm font-bold ${card.color}`}>{card.value}</p>
        </motion.div>
      ))}

      {/* Center visualization */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1], rotate: [0, 5, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="relative"
        >
          {/* Outer rings */}
          {[160, 120, 80].map((size, i) => (
            <motion.div
              key={i}
              animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
              transition={{ duration: 20 + i * 8, repeat: Infinity, ease: 'linear' }}
              className="absolute rounded-full border border-accent-blue/20"
              style={{ width: size, height: size, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
            />
          ))}

          {/* Core */}
          <div className="w-16 h-16 rounded-full bg-accent-blue/20 border-2 border-accent-blue/50 flex items-center justify-center shadow-glow-blue">
            <Zap size={28} className="text-accent-blue" />
          </div>

          {/* Orbiting dots */}
          {[0, 60, 120, 180, 240, 300].map((deg, i) => (
            <motion.div
              key={i}
              animate={{ rotate: 360 }}
              transition={{ duration: 15, repeat: Infinity, ease: 'linear', delay: (deg / 360) * -15 }}
              className="absolute"
              style={{ width: 120, height: 120, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
            >
              <div
                className={`absolute w-2 h-2 rounded-full ${i % 3 === 0 ? 'bg-accent-blue' : i % 3 === 1 ? 'bg-accent-purple' : 'bg-status-success'}`}
                style={{ top: 0, left: '50%', transform: `translateX(-50%) rotate(${deg}deg) translateY(-50px)` }}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Stats bottom */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-6">
        {[
          { icon: Activity, label: 'Live Monitoring', color: 'text-status-success' },
          { icon: Network, label: 'P2P Network', color: 'text-accent-blue' },
          { icon: Shield, label: 'Verified Data', color: 'text-accent-purple' },
        ].map(({ icon: Icon, label, color }, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ delay: 1.5 + i * 0.2 }}
            className="flex items-center gap-2 text-xs text-text-muted"
          >
            <Icon size={12} className={color} />
            {label}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter both email and password.'); return; }
    setLoading(true);
    setError('');
    const result = await login(email, password, remember);
    setLoading(false);
    if (result.success) navigate('/dashboard');
    else setError(result.error);
  };

  const demoLogin = async (cred) => {
    setEmail(cred.email);
    setPassword(cred.password);
    setLoading(true);
    setError('');
    const result = await login(cred.email, cred.password, false);
    setLoading(false);
    if (result.success) navigate('/dashboard');
  };

  const handleForgotPassword = () => {
    if (!forgotEmail || !/\S+@\S+\.\S+/.test(forgotEmail)) return;
    setForgotSent(true);
    setTimeout(() => { setShowForgotModal(false); setForgotSent(false); setForgotEmail(''); }, 2000);
  };

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Left — Form */}
      <div className="w-full lg:w-[44%] flex flex-col justify-center px-5 sm:px-10 lg:px-16 py-8 sm:py-12">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
          {/* Logo */}
          <div className="flex items-center justify-between gap-3 mb-8">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-2xl border border-[#412D15]/30 bg-[#412D15] flex items-center justify-center overflow-hidden shadow-[0_12px_30px_rgba(65,45,21,.22)]">
                <span className="absolute h-8 w-2.5 -translate-x-1.5 rotate-[32deg] rounded-sm bg-[#E1DCC9]" />
                <span className="absolute h-8 w-2.5 translate-x-1.5 rotate-[32deg] rounded-sm bg-[#EF4444]" />
                <span className="h-2 w-2 rounded-full bg-white ring-2 ring-[#412D15]" />
              </div>
              <div>
                <div className="text-lg font-bold text-text-primary tracking-widest">TRAFFICX</div>
                <div className="text-[10px] text-text-muted tracking-widest uppercase">Intelligence Network</div>
              </div>
            </div>
          </div>

          <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Secure operations access</p>
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-2">Welcome back.</h2>
          <p className="text-sm md:text-base text-text-secondary mb-8">Sign in to the TrafficX command center.</p>

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-4 py-3 rounded-lg bg-status-critical/10 border border-status-critical/30 text-status-critical text-sm mb-6">
              <AlertCircle size={16} />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Email address</label>
              <input
                type="email"
                className="input-field"
                placeholder="you@trafficx.io"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-text-secondary">Password</label>
                <button type="button" onClick={() => setShowForgotModal(true)} className="text-xs text-accent-blue hover:underline">Forgot password?</button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="remember" className="w-4 h-4 rounded border-border-default bg-bg-secondary accent-accent-blue" checked={remember} onChange={e => setRemember(e.target.checked)} />
              <label htmlFor="remember" className="text-sm text-text-secondary">Remember me</label>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? (
                <span className="w-4 h-4 border-2 border-bg-primary/30 border-t-bg-primary rounded-full animate-spin" />
              ) : (
                <>Sign In <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          {/* Demo quick access */}
          <div className="mt-6 pt-6 border-t border-border-subtle">
            <p className="text-xs text-text-muted text-center mb-3">Quick demo access</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Admin', email: 'admin@trafficx.io', password: 'admin123', color: 'border-status-critical/30 text-status-critical hover:bg-status-critical/10' },
                { label: 'Authority', email: 'authority@trafficx.io', password: 'auth123', color: 'border-status-warning/30 text-status-warning hover:bg-status-warning/10' },
                { label: 'Analyst', email: 'analyst@trafficx.io', password: 'analyst123', color: 'border-accent-blue/30 text-accent-blue hover:bg-accent-blue/10' },
                { label: 'User', email: 'user@trafficx.io', password: 'user123', color: 'border-status-success/30 text-status-success hover:bg-status-success/10' },
              ].map(cred => (
                <button key={cred.label} onClick={() => demoLogin(cred)} className={`text-xs font-medium px-3 py-2 rounded-lg border transition-all ${cred.color}`}>
                  {cred.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-text-muted text-center mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-accent-blue hover:underline font-medium">Create account</Link>
          </p>
        </motion.div>
      </div>

      {/* Right — Visualization */}
      <div className="hidden lg:flex lg:w-[56%] relative overflow-hidden border-l border-border-subtle">
        <div className="absolute inset-0 bg-[#000000]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(225,220,201,.16),transparent_38%),radial-gradient(circle_at_20%_80%,rgba(65,45,21,.38),transparent_34%)]" />
        <TrafficAnimation />

        <div className="absolute top-8 left-8 right-8">
          <h3 className="text-2xl font-bold text-white leading-tight">
            Decentralized Real-Time<br />
            <span className="text-[#E1DCC9]">Traffic Intelligence</span>
          </h3>
          <p className="text-sm text-white/65 mt-3 max-w-sm">
            Monitor, predict, and respond to traffic events across your entire city network.
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 bg-bg-primary/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card rounded-2xl p-6 w-full max-w-sm border border-border-default">
              <h3 className="text-base font-bold text-text-primary mb-1">Reset Password</h3>
              <p className="text-xs text-text-muted mb-4">Enter your email and we'll send reset instructions.</p>
              {!forgotSent ? (
                <>
                  <div className="relative mb-3">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input type="email" className="input-field pl-9" placeholder="you@trafficx.io"
                      value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowForgotModal(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
                    <button onClick={handleForgotPassword} className="btn-primary flex-1 text-sm">Send Reset Link</button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="text-status-success text-sm font-medium">✓ Reset link sent (demo)</div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
