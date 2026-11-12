import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart2, Download, Calendar, MapPin } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import { hourlyTrafficData, weeklyData, monitoringLocations } from '../../data/demoData';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 border border-border-default rounded-lg shadow-card text-xs">
      <p className="text-text-muted mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: {p.value?.toLocaleString()}</p>)}
    </div>
  );
};

const congestionHeatmap = Array.from({ length: 7 }, (_, day) =>
  Array.from({ length: 24 }, (_, hour) => ({
    day, hour,
    value: Math.max(5, 20 + Math.sin((hour - 8) * 0.5) * 40 + Math.sin((hour - 17) * 0.4) * 35 + (Math.random() * 10))
  }))
).flat();

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Analytics() {
  const [dateRange, setDateRange] = useState('7d');
  const [location, setLocation] = useState('all');

  const topCongested = [...monitoringLocations]
    .filter(n => n.status !== 'offline')
    .sort((a, b) => b.congestion - a.congestion)
    .slice(0, 5);

  return (
    <AppLayout title="Analytics & Reports" subtitle="Traffic intelligence insights and trends">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          {['24h', '7d', '30d', '90d'].map(r => (
            <button key={r} onClick={() => setDateRange(r)} className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${dateRange === r ? 'border-accent-blue bg-accent-blue/15 text-accent-blue font-semibold' : 'border-border-subtle text-text-muted hover:border-border-default'}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select className="input-field w-auto text-sm" value={location} onChange={e => setLocation(e.target.value)}>
            <option value="all">All Locations</option>
            {monitoringLocations.slice(0, 5).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
          <button className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Vehicles', value: '298,420', trend: '+8.4%', color: 'text-accent-blue' },
          { label: 'Avg Daily Speed', value: '34 km/h', trend: '-2.1%', color: 'text-status-success' },
          { label: 'Peak Congestion', value: '84%', trend: '+5.3%', color: 'text-status-warning' },
          { label: 'Incidents', value: '62', trend: '-12%', color: 'text-status-critical' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-4">
            <p className="text-xs text-text-muted">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            <p className={`text-xs mt-0.5 ${s.trend.startsWith('+') ? (s.label.includes('Congestion') || s.label.includes('Incidents') ? 'text-status-critical' : 'text-status-success') : 'text-status-critical'}`}>{s.trend} vs prev period</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {/* Hourly congestion */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5">
          <h3 className="section-title mb-1">Hourly Congestion Pattern</h3>
          <p className="section-subtitle mb-4">Average across all monitoring nodes</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hourlyTrafficData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="congGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
              <XAxis dataKey="hour" tick={{ fill: '#475569', fontSize: 10 }} interval={3} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="congestion" stroke="#F59E0B" strokeWidth={2} fill="url(#congGrad)" name="Congestion %" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Weekly comparison */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-5">
          <h3 className="section-title mb-1">Weekly Comparison</h3>
          <p className="section-subtitle mb-4">Vehicles and incidents by day</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
              <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fill: '#475569', fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#475569', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="rect" formatter={(v) => <span className="text-xs text-text-secondary">{v}</span>} />
              <Bar yAxisId="left" dataKey="vehicles" fill="#38BDF8" radius={[4, 4, 0, 0]} name="Vehicles" opacity={0.8} />
              <Bar yAxisId="right" dataKey="incidents" fill="#EF4444" radius={[4, 4, 0, 0]} name="Incidents" opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        {/* Speed trend */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5 xl:col-span-2">
          <h3 className="section-title mb-1">Average Speed Trend</h3>
          <p className="section-subtitle mb-4">km/h over 24-hour period</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={hourlyTrafficData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
              <XAxis dataKey="hour" tick={{ fill: '#475569', fontSize: 10 }} interval={3} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="speed" stroke="#22C55E" strokeWidth={2.5} dot={false} name="Avg Speed (km/h)" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Top congested locations */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-5">
          <h3 className="section-title mb-4">Most Congested Locations</h3>
          <div className="space-y-3">
            {topCongested.map((loc, i) => (
              <div key={loc.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted font-mono">{i+1}.</span>
                    <span className="text-text-secondary truncate max-w-[120px]">{loc.name}</span>
                  </div>
                  <span className={`font-semibold ${loc.congestion > 70 ? 'text-status-critical' : loc.congestion > 50 ? 'text-status-warning' : 'text-accent-blue'}`}>{loc.congestion}%</span>
                </div>
                <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${loc.congestion > 70 ? 'bg-status-critical' : loc.congestion > 50 ? 'bg-status-warning' : 'bg-accent-blue'}`}
                    style={{ width: `${loc.congestion}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-border-subtle">
            <h4 className="text-xs font-semibold text-text-secondary mb-2">Prediction Accuracy</h4>
            {[
              { label: '15-min', accuracy: 89 },
              { label: '30-min', accuracy: 84 },
              { label: '60-min', accuracy: 76 },
            ].map(a => (
              <div key={a.label} className="flex items-center gap-2 mb-1.5">
                <span className="text-xs text-text-muted w-10">{a.label}</span>
                <div className="flex-1 h-1.5 bg-bg-elevated rounded-full">
                  <div className="h-full bg-accent-purple rounded-full" style={{ width: `${a.accuracy}%` }} />
                </div>
                <span className="text-xs font-medium text-accent-purple">{a.accuracy}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
