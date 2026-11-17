import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Activity, Cpu, AlertTriangle, Zap, Gauge, Network } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import KpiCard from '../../components/ui/KpiCard';
import { useApp } from '../../context/AppContext';
import { hourlyTrafficData, weeklyData, predictions } from '../../data/demoData';
import StatusBadge from '../../components/ui/StatusBadge';
import CongestionBar from '../../components/ui/CongestionBar';
import { formatDistanceToNow } from 'date-fns';
import { useWebSocket } from '../../hooks/useWebSocket';

const congestionDist = [
  { name: 'Severe',    value: 2, fill: '#EF4444' },
  { name: 'Heavy',     value: 3, fill: '#F59E0B' },
  { name: 'Moderate',  value: 3, fill: '#38BDF8' },
  { name: 'Free Flow', value: 2, fill: '#22C55E' },
];

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-card border border-border-default rounded-xl p-2.5 shadow-card text-xs">
      <p className="text-text-muted mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: {p.value?.toLocaleString()}</p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { kpis, nodes, incidents: liveIncidents } = useApp();
  const [liveEvents, setLiveEvents] = useState([]);

  const handleWsMsg = useCallback((msg) => {
    if (msg.type === 'traffic') setLiveEvents(prev => [msg.data, ...prev].slice(0, 4));
  }, []);
  useWebSocket('all', handleWsMsg);

  const recentIncidents = liveIncidents.slice(0, 3);
  const kpiCards = [
    { title: 'Active Nodes',   value: kpis.activeNodes.value,       subtitle: `of ${kpis.activeNodes.total}`,  trend: kpis.activeNodes.trend,        icon: Network,       color: 'blue' },
    { title: 'Vehicles',       value: kpis.vehiclesMonitored.value,  subtitle: 'monitored now',                 trend: kpis.vehiclesMonitored.trend,   icon: Activity,      color: 'purple' },
    { title: 'Congestion',     value: kpis.congestionIndex.value,    unit: '%', subtitle: 'city average',       trend: kpis.congestionIndex.trend,     icon: Gauge,         color: 'warning' },
    { title: 'Incidents',      value: kpis.activeIncidents.value,    subtitle: 'active alerts',                 trend: kpis.activeIncidents.trend,     icon: AlertTriangle, color: 'critical' },
    { title: 'Avg Speed',      value: kpis.avgSpeed.value,           unit: 'km/h', subtitle: 'all roads',       trend: kpis.avgSpeed.trend,            icon: Zap,           color: 'green' },
    { title: 'Network Health', value: kpis.networkHealth.value,      unit: '%', subtitle: 'P2P uptime',         trend: kpis.networkHealth.trend,       icon: Cpu,           color: 'green' },
  ];

  return (
    <AppLayout title="Overview" subtitle="Real-time traffic intelligence">

      {/* Live Kafka strip */}
      {liveEvents.length > 0 && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl border border-accent-blue/25 bg-accent-blue/5 overflow-x-auto">
          <span className="flex items-center gap-1 text-[9px] font-bold text-accent-blue uppercase tracking-widest shrink-0">
            <Activity size={9} className="animate-pulse" /> Live
          </span>
          {liveEvents.map((e, i) => (
            <span key={i} className="text-[9px] font-mono text-text-muted whitespace-nowrap shrink-0">
              {e.road_name || e.road_id} · {e.speed}km/h
            </span>
          ))}
        </div>
      )}

      {/* KPI grid — 2 cols always, never overflow */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {kpiCards.map((card, i) => (
          <KpiCard key={card.title} {...card} index={i} compact />
        ))}
      </div>

      {/* Traffic density chart */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass-card p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Traffic Density</h3>
            <p className="text-[10px] text-text-muted">Vehicles · last 24 hours</p>
          </div>
          <span className="badge-info text-[9px]">24h</span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={hourlyTrafficData} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#38BDF8" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
            <XAxis dataKey="hour" tick={{ fill: '#475569', fontSize: 9 }} interval={5} />
            <YAxis tick={{ fill: '#475569', fontSize: 9 }} />
            <Tooltip content={<Tip />} />
            <Area type="monotone" dataKey="vehicles" stroke="#38BDF8" strokeWidth={2} fill="url(#tg)" name="Vehicles" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Congestion donut + weekly bar — side by side */}
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-card p-3">
          <h3 className="text-xs font-semibold text-text-primary mb-2">Congestion</h3>
          <ResponsiveContainer width="100%" height={110}>
            <PieChart>
              <Pie data={congestionDist} cx="50%" cy="50%" innerRadius={30} outerRadius={48} paddingAngle={2} dataKey="value">
                {congestionDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip content={<Tip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-1">
            {congestionDist.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-[9px] text-text-muted">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: d.fill }} />
                <span className="truncate flex-1">{d.name}</span>
                <span className="text-text-secondary font-semibold">{d.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="glass-card p-3">
          <h3 className="text-xs font-semibold text-text-primary mb-2">Weekly</h3>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={weeklyData} margin={{ top: 2, right: 2, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
              <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 8 }} />
              <YAxis tick={{ fill: '#475569', fontSize: 8 }} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="vehicles" fill="#8B5CF6" radius={[3, 3, 0, 0]} name="Vehicles" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {weeklyData.slice(0, 3).map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[9px] text-text-muted">
                <span className="w-6 shrink-0">{d.day}</span>
                <div className="flex-1 h-1 bg-bg-elevated rounded-full overflow-hidden">
                  <div className="h-full bg-accent-purple rounded-full" style={{ width: `${d.vehicles / 600}%` }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* AI forecast */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="glass-card p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">AI Forecast</h3>
            <p className="text-[10px] text-text-muted">Congestion prediction vs actual</p>
          </div>
          <span className="text-[9px] text-text-muted font-mono bg-bg-elevated px-2 py-0.5 rounded-full">{predictions.confidence}% conf</span>
        </div>
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={predictions.trend} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
            <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} />
            <YAxis tick={{ fill: '#475569', fontSize: 9 }} domain={[50, 100]} />
            <Tooltip content={<Tip />} />
            <Line type="monotone" dataKey="actual"    stroke="#22C55E" strokeWidth={2} dot={false} name="Actual" />
            <Line type="monotone" dataKey="predicted" stroke="#38BDF8" strokeWidth={2} dot={false} strokeDasharray="5 4" name="Predicted" />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Recent incidents */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="glass-card p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Recent Incidents</h3>
          <Link to="/incidents" className="text-[10px] text-accent-blue hover:underline">View all</Link>
        </div>
        <div className="space-y-2">
          {recentIncidents.map(inc => (
            <div key={inc.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-bg-secondary border border-border-subtle">
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                inc.severity === 'critical' ? 'bg-status-critical animate-pulse' :
                inc.severity === 'high'     ? 'bg-status-critical' :
                inc.severity === 'medium'   ? 'bg-status-warning'  : 'bg-status-success'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{inc.title}</p>
                <p className="text-[10px] text-text-muted truncate">{inc.location}</p>
              </div>
              <StatusBadge status={inc.status} />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Node list — card grid instead of table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Monitoring Nodes</h3>
          <span className="badge-success text-[9px]">Live</span>
        </div>
        <div className="space-y-2">
          {nodes.slice(0, 5).map(node => (
            <div key={node.id} className="p-2.5 rounded-xl bg-bg-secondary border border-border-subtle">
              <div className="flex items-center justify-between mb-1.5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{node.name}</p>
                  <p className="text-[9px] text-text-muted font-mono">{node.nodeId}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] text-text-muted">{node.avgSpeed} km/h</span>
                  <StatusBadge status={node.status} dot={false} />
                </div>
              </div>
              {node.status !== 'offline' && (
                <CongestionBar value={node.congestion} size="sm" showLabel={false} />
              )}
              <div className="flex justify-between mt-1 text-[9px] text-text-muted">
                <span>{node.vehicleCount.toLocaleString()} vehicles</span>
                <span>{node.congestion}% congested</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

    </AppLayout>
  );
}
