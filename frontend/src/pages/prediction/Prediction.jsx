import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, AlertTriangle, Target, Cpu, Info, BarChart2, ChevronRight } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import { predictions, hourlyTrafficData } from '../../data/demoData';
import CongestionBar from '../../components/ui/CongestionBar';

const getColor = v => v >= 80 ? '#EF4444' : v >= 60 ? '#F59E0B' : v >= 40 ? '#38BDF8' : '#22C55E';
const riskColors = { critical:'#EF4444', high:'#F59E0B', medium:'#38BDF8', low:'#22C55E' };

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-card border border-border-default rounded-xl p-2.5 text-xs shadow-card">
      <p className="text-text-muted mb-1">{label}</p>
      {payload.map((p,i) => <p key={i} style={{ color:p.color }} className="font-medium">{p.name}: {p.value !== null ? p.value : '—'}</p>)}
    </div>
  );
};

const FEATURES = [
  { feature:'Time of Day',   importance:0.28, color:'#38BDF8' },
  { feature:'Historical Avg',importance:0.22, color:'#8B5CF6' },
  { feature:'Vehicle Count', importance:0.19, color:'#22C55E' },
  { feature:'Day of Week',   importance:0.14, color:'#F59E0B' },
  { feature:'Avg Speed',     importance:0.10, color:'#06B6D4' },
  { feature:'Is Weekend',    importance:0.07, color:'#EF4444' },
];

export default function Prediction() {
  const [timeframe, setTimeframe] = useState('30');

  const targetValue = timeframe==='15' ? predictions.next15 : timeframe==='30' ? predictions.next30 : predictions.next60;
  const targetConf  = timeframe==='15' ? 89 : timeframe==='30' ? 84 : 76;

  const chartData = useMemo(() => Array.from({ length:24 }, (_,i) => ({
    hour: `${i.toString().padStart(2,'0')}:00`,
    actual:    i <= 11 ? (hourlyTrafficData[i]?.congestion ?? null) : null,
    predicted: Math.round(30 + Math.sin((i-6)*0.4)*30 + 50),
  })), []);

  return (
    <AppLayout title="AI Prediction" subtitle="ML congestion forecasting">

      {/* Disclaimer banner */}
      <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-accent-blue/10 border border-accent-blue/25 mb-4">
        <Info size={14} className="text-accent-blue mt-0.5 shrink-0" />
        <p className="text-[11px] text-accent-blue leading-snug">
          <strong>Simulation Mode:</strong> Run <code className="bg-accent-blue/15 px-1 rounded font-mono">python -m app.ml.lstm_train</code> to enable the trained LSTM model.
        </p>
      </div>

      {/* 4 prediction cards — 2×2 grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {[
          { label:'Current',    value:predictions.current, sub:'Live reading',  t:null },
          { label:'+15 min',    value:predictions.next15,  sub:'Short-term',    t:'15' },
          { label:'+30 min',    value:predictions.next30,  sub:'Near-term',     t:'30' },
          { label:'+60 min',    value:predictions.next60,  sub:'Long-term',     t:'60' },
        ].map((s,i) => {
          const sel = s.t === timeframe;
          return (
            <motion.button key={i} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.07 }}
              onClick={() => s.t && setTimeframe(s.t)}
              className={`text-left p-3 rounded-2xl border transition-all ${sel ? 'border-accent-blue' : 'border-border-subtle bg-bg-card'}`}
              style={sel ? { background:'rgba(56,189,248,0.08)', borderColor:'#38BDF8' } : {}}>
              <p className="text-[10px] text-text-muted mb-1">{s.label}</p>
              <p className="text-2xl font-bold leading-none" style={{ color: getColor(s.value) }}>{s.value}%</p>
              <p className="text-[10px] text-text-muted mt-1">{s.sub}</p>
              <div className="mt-2 h-1 rounded-full bg-bg-elevated overflow-hidden">
                <div className="h-full rounded-full" style={{ width:`${s.value}%`, background:getColor(s.value) }} />
              </div>
              {sel && <p className="text-[9px] text-accent-blue mt-1.5 font-bold">▲ Selected</p>}
            </motion.button>
          );
        })}
      </div>

      {/* Selected forecast prominent display */}
      <div className="glass-card p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-widest">+{timeframe} min forecast</p>
          <p className="text-4xl font-bold leading-none mt-1" style={{ color: getColor(targetValue) }}>{targetValue}%</p>
          <p className="text-xs text-text-muted mt-1">{targetConf}% confidence · {predictions.model}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          {['15','30','60'].map(t => (
            <button key={t} onClick={() => setTimeframe(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                timeframe===t ? 'bg-accent-blue text-bg-primary border-accent-blue' : 'border-border-subtle text-text-muted'
              }`}>
              +{t}m
            </button>
          ))}
        </div>
      </div>

      {/* Forecast chart */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">24h Forecast</h3>
            <p className="text-[10px] text-text-muted">Actual vs predicted congestion</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-text-muted">
            <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-status-success rounded" />Actual</span>
            <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-accent-blue rounded" style={{ borderTop:'2px dashed #38BDF8' }} />Predicted</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top:2, right:4, left:-28, bottom:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
            <XAxis dataKey="hour" tick={{ fill:'#475569', fontSize:9 }} interval={5} />
            <YAxis tick={{ fill:'#475569', fontSize:9 }} domain={[0,100]} />
            <Tooltip content={<Tip />} />
            <Line type="monotone" dataKey="actual"    stroke="#22C55E" strokeWidth={2} dot={false} name="Actual" />
            <Line type="monotone" dataKey="predicted" stroke="#38BDF8" strokeWidth={2} dot={false} strokeDasharray="5 3" name="Predicted" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Model metrics */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {[
          { label:'Accuracy', value:predictions.metrics.accuracy, icon:Target },
          { label:'R² Score', value:predictions.metrics.r2,       icon:BarChart2 },
          { label:'MAE',      value:`${predictions.metrics.mae}%`,icon:Cpu },
        ].map(({ label, value, icon:Icon }, i) => (
          <div key={i} className="glass-card p-3 text-center">
            <Icon size={16} className="text-accent-purple mx-auto mb-1.5" />
            <p className="text-sm font-bold text-text-primary">{value}</p>
            <p className="text-[9px] text-text-muted">{label}</p>
          </div>
        ))}
      </div>

      {/* High-risk locations */}
      <div className="glass-card p-4 mb-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-status-warning" /> High-Risk Locations
        </h3>
        <div className="space-y-2.5">
          {predictions.riskLocations.map((loc,i) => (
            <div key={i} className="p-3 rounded-xl border border-border-subtle bg-bg-secondary">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-text-primary">{loc.name}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color:riskColors[loc.risk], background:`${riskColors[loc.risk]}20` }}>
                  {loc.risk.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-text-muted mb-1.5">
                <span>Predicted: <strong style={{ color:riskColors[loc.risk] }}>{loc.predictedCongestion}%</strong></span>
                <span>in {loc.timeframe}</span>
              </div>
              <CongestionBar value={loc.predictedCongestion} size="sm" showLabel={false} />
            </div>
          ))}
        </div>
      </div>

      {/* Feature importance */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <TrendingUp size={14} className="text-accent-blue" /> Feature Importance
        </h3>
        <div className="space-y-2.5">
          {FEATURES.map((f,i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1 text-[11px]">
                <span className="text-text-secondary">{f.feature}</span>
                <span className="font-semibold text-text-primary">{(f.importance*100).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                <motion.div initial={{ width:0 }} animate={{ width:`${f.importance*100}%` }}
                  transition={{ delay:0.4+i*0.07, duration:0.6, ease:'easeOut' }}
                  className="h-full rounded-full" style={{ background:f.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
