import { useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, AlertTriangle, Target, Cpu, Info, BarChart2 } from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import { predictions, hourlyTrafficData, monitoringLocations } from '../../data/demoData';
import CongestionBar from '../../components/ui/CongestionBar';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 border border-border-default rounded-lg shadow-card text-xs">
      <p className="text-text-muted mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

const riskColors = { critical: '#EF4444', high: '#F59E0B', medium: '#38BDF8', low: '#22C55E' };

export default function Prediction() {
  const [timeframe, setTimeframe] = useState('30');

  const getColor = (val) => val >= 80 ? '#EF4444' : val >= 60 ? '#F59E0B' : val >= 40 ? '#38BDF8' : '#22C55E';
  const targetValue = timeframe === '15' ? predictions.next15 : timeframe === '30' ? predictions.next30 : predictions.next60;

  // Extended prediction data
  const extPrediction = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2,'0')}:00`,
    actual: i <= 11 ? hourlyTrafficData[i]?.congestion ?? null : null,
    predicted: 30 + Math.sin((i - 6) * 0.4) * 30 + 50 + (Math.random() * 8 - 4),
    upper: 30 + Math.sin((i - 6) * 0.4) * 30 + 60 + (Math.random() * 6),
    lower: 30 + Math.sin((i - 6) * 0.4) * 30 + 40 - (Math.random() * 6),
  }));

  // Feature importance
  const features = [
    { feature: 'Time of Day', importance: 0.28, color: '#38BDF8' },
    { feature: 'Historical Avg', importance: 0.22, color: '#8B5CF6' },
    { feature: 'Vehicle Count', importance: 0.19, color: '#22C55E' },
    { feature: 'Day of Week', importance: 0.14, color: '#F59E0B' },
    { feature: 'Avg Speed', importance: 0.10, color: '#06B6D4' },
    { feature: 'Is Weekend', importance: 0.07, color: '#EF4444' },
  ];

  return (
    <AppLayout title="AI Traffic Prediction" subtitle="Machine learning congestion forecasting">
      {/* Disclaimer */}
      <div className="mb-4 px-4 py-3 rounded-lg bg-accent-blue/10 border border-accent-blue/30 flex items-start gap-2 text-sm text-accent-blue">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span><strong>Simulation Mode:</strong> Predictions use a rule-based simulation demonstrating the ML pipeline. A trained GradientBoostingRegressor model would replace this with real historical data.</span>
      </div>

      {/* Current + Predictions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Current Congestion', value: predictions.current, suffix: '%', color: getColor(predictions.current), sub: 'Live reading' },
          { label: 'Predicted (+15 min)', value: predictions.next15, suffix: '%', color: getColor(predictions.next15), sub: 'Short-term' },
          { label: 'Predicted (+30 min)', value: predictions.next30, suffix: '%', color: getColor(predictions.next30), sub: 'Near-term' },
          { label: 'Predicted (+60 min)', value: predictions.next60, suffix: '%', color: getColor(predictions.next60), sub: 'Long-term' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-4">
            <p className="text-xs text-text-muted mb-2">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}{s.suffix}</p>
            <p className="text-xs text-text-muted mt-1">{s.sub}</p>
            <div className="mt-2 h-1.5 bg-bg-elevated rounded-full">
              <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${s.value}%`, background: s.color }} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Confidence */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="section-title flex items-center gap-2"><Brain size={16} className="text-accent-purple" />Prediction Confidence</h3>
            <p className="section-subtitle">Model: {predictions.model} — {predictions.confidence}% confidence</p>
          </div>
          <div className="flex gap-2">
            {['15', '30', '60'].map(t => (
              <button key={t} onClick={() => setTimeframe(t)} className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${timeframe === t ? 'border-accent-blue bg-accent-blue/15 text-accent-blue font-semibold' : 'border-border-subtle text-text-muted hover:border-border-default'}`}>+{t}m</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Model Accuracy', value: predictions.metrics.accuracy, icon: Target },
            { label: 'R² Score', value: predictions.metrics.r2, icon: BarChart2 },
            { label: 'MAE', value: `${predictions.metrics.mae}%`, icon: Cpu },
          ].map(({ label, value, icon: Icon }, i) => (
            <div key={i} className="bg-bg-secondary rounded-lg p-3 border border-border-subtle flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent-purple/10 border border-accent-purple/20">
                <Icon size={14} className="text-accent-purple" />
              </div>
              <div>
                <p className="text-xs text-text-muted">{label}</p>
                <p className="text-sm font-bold text-text-primary">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={extPrediction} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
            <XAxis dataKey="hour" tick={{ fill: '#475569', fontSize: 10 }} interval={3} />
            <YAxis tick={{ fill: '#475569', fontSize: 10 }} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x="11:00" stroke="#38BDF844" strokeDasharray="4 4" label={{ value: 'Now', fill: '#38BDF8', fontSize: 10 }} />
            <Area type="monotone" dataKey="upper" stroke="none" fill="#38BDF811" name="Upper bound" />
            <Area type="monotone" dataKey="lower" stroke="none" fill="#38BDF811" name="Lower bound" />
            <Line type="monotone" dataKey="actual" stroke="#22C55E" strokeWidth={2.5} dot={false} name="Actual" />
            <Line type="monotone" dataKey="predicted" stroke="#38BDF8" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Predicted" />
            <Legend iconType="line" formatter={(v) => <span className="text-xs text-text-secondary">{v}</span>} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Risk locations */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-5">
          <h3 className="section-title flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-status-warning" />
            High-Risk Locations
          </h3>
          <div className="space-y-3">
            {predictions.riskLocations.map((loc, i) => (
              <div key={i} className="p-3 rounded-lg bg-bg-secondary border border-border-subtle">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text-primary">{loc.name}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: riskColors[loc.risk], background: `${riskColors[loc.risk]}20` }}>
                    {loc.risk.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
                  <span>Predicted: <span className="font-semibold" style={{ color: riskColors[loc.risk] }}>{loc.predictedCongestion}%</span></span>
                  <span>in {loc.timeframe}</span>
                </div>
                <CongestionBar value={loc.predictedCongestion} size="sm" showLabel={false} />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Feature importance */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="glass-card p-5">
          <h3 className="section-title flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-accent-blue" />
            Feature Importance
          </h3>
          <div className="space-y-3">
            {features.map((f, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span className="text-text-secondary">{f.feature}</span>
                  <span className="font-semibold text-text-primary">{(f.importance * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${f.importance * 100}%` }}
                    transition={{ delay: 0.6 + i * 0.1, duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: f.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border-subtle text-xs text-text-muted">
            <p>Model: GradientBoostingRegressor | RMSE: {predictions.metrics.rmse} | R²: {predictions.metrics.r2}</p>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
