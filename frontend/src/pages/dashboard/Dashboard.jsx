import { motion } from 'framer-motion';
import { Activity, Cpu, AlertTriangle, Zap, Gauge, Network, TrendingUp } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import KpiCard from '../../components/ui/KpiCard';
import { useApp } from '../../context/AppContext';
import { hourlyTrafficData, weeklyData, predictions, incidents } from '../../data/demoData';
import StatusBadge from '../../components/ui/StatusBadge';
import { formatDistanceToNow } from 'date-fns';

const COLORS = ['#EF4444', '#F59E0B', '#38BDF8', '#22C55E'];
const congestionDist = [
  { name: 'Severe', value: 2, fill: '#EF4444' },
  { name: 'Heavy', value: 3, fill: '#F59E0B' },
  { name: 'Moderate', value: 3, fill: '#38BDF8' },
  { name: 'Free Flow', value: 2, fill: '#22C55E' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 border border-border-default rounded-lg shadow-card text-xs">
      <p className="text-text-muted mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: {p.value?.toLocaleString()}</p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { kpis, nodes, incidents: liveIncidents } = useApp();
  const recentIncidents = liveIncidents.slice(0, 4);

  const kpiCards = [
    { title: 'Active Monitoring Nodes', value: kpis.activeNodes.value, subtitle: `${kpis.activeNodes.total} total nodes`, trend: kpis.activeNodes.trend, icon: Network, color: 'blue' },
    { title: 'Vehicles Monitored', value: kpis.vehiclesMonitored.value, subtitle: 'Real-time count', trend: kpis.vehiclesMonitored.trend, icon: Activity, color: 'purple' },
    { title: 'Congestion Index', value: kpis.congestionIndex.value, unit: '%', subtitle: 'City-wide average', trend: kpis.congestionIndex.trend, icon: Gauge, color: 'warning' },
    { title: 'Active Incidents', value: kpis.activeIncidents.value, subtitle: 'Requiring attention', trend: kpis.activeIncidents.trend, icon: AlertTriangle, color: 'critical' },
    { title: 'Average Speed', value: kpis.avgSpeed.value, unit: 'km/h', subtitle: 'All monitored roads', trend: kpis.avgSpeed.trend, icon: Zap, color: 'green' },
    { title: 'Network Health', value: kpis.networkHealth.value, unit: '%', subtitle: 'P2P node uptime', trend: kpis.networkHealth.trend, icon: Cpu, color: 'green' },
  ];

  return (
    <AppLayout title="Overview" subtitle="Real-time city traffic intelligence">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {kpiCards.map((card, i) => <KpiCard key={card.title} {...card} index={i} />)}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        {/* Live traffic density */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="section-title">Live Traffic Density</h3>
              <p className="section-subtitle">Vehicle count over last 24 hours</p>
            </div>
            <span className="badge-info">24h</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hourlyTrafficData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
              <XAxis dataKey="hour" tick={{ fill: '#475569', fontSize: 10 }} interval={3} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="vehicles" stroke="#38BDF8" strokeWidth={2} fill="url(#trafficGrad)" name="Vehicles" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Congestion distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-5">
          <div className="mb-4">
            <h3 className="section-title">Congestion Distribution</h3>
            <p className="section-subtitle">Current road status across zones</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={congestionDist} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {congestionDist.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {congestionDist.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-text-muted">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }} />
                <span>{d.name}</span>
                <span className="text-text-secondary font-medium ml-auto">{d.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        {/* Weekly patterns */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-5">
          <div className="mb-4">
            <h3 className="section-title">Weekly Traffic Patterns</h3>
            <p className="section-subtitle">Vehicles per day</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
              <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 10 }} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="vehicles" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Vehicles" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Prediction trend */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="section-title">Congestion Forecast</h3>
              <p className="section-subtitle">AI prediction vs actual</p>
            </div>
            <span className="text-xs text-text-muted font-mono bg-bg-elevated px-2 py-1 rounded">{predictions.confidence}% conf.</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={predictions.trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
              <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 10 }} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} domain={[50, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="actual" stroke="#22C55E" strokeWidth={2} dot={false} name="Actual" />
              <Line type="monotone" dataKey="predicted" stroke="#38BDF8" strokeWidth={2} dot={false} strokeDasharray="5 5" name="Predicted" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Incidents */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Recent Incidents</h3>
            <a href="/incidents" className="text-xs text-accent-blue hover:underline">View all</a>
          </div>
          <div className="space-y-3">
            {recentIncidents.map(inc => (
              <div key={inc.id} className="flex items-start gap-3 p-3 rounded-lg bg-bg-secondary border border-border-subtle hover:border-border-accent transition-all">
                <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                  inc.severity === 'critical' ? 'bg-status-critical animate-pulse' :
                  inc.severity === 'high' ? 'bg-status-critical' :
                  inc.severity === 'medium' ? 'bg-status-warning' : 'bg-status-success'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{inc.title}</p>
                  <p className="text-[10px] text-text-muted truncate">{inc.location}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{formatDistanceToNow(new Date(inc.reportedAt), { addSuffix: true })}</p>
                </div>
                <StatusBadge status={inc.status} />
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Node activity */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-title">Monitoring Node Activity</h3>
            <p className="section-subtitle">Real-time sensor readings across all zones</p>
          </div>
          <span className="badge-success">Live</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-border-subtle">
                {['Node', 'Zone', 'Vehicles', 'Avg Speed', 'Congestion', 'Status', 'Last Updated'].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nodes.slice(0, 7).map(node => (
                <tr key={node.id} className="table-row">
                  <td className="table-cell">
                    <div className="font-medium text-text-primary text-sm">{node.name}</div>
                    <div className="text-[10px] text-text-muted font-mono">{node.nodeId}</div>
                  </td>
                  <td className="table-cell">{node.zone}</td>
                  <td className="table-cell font-medium text-text-primary">{node.vehicleCount.toLocaleString()}</td>
                  <td className="table-cell">{node.avgSpeed} km/h</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-bg-elevated rounded-full h-1.5 max-w-[80px]">
                        <div
                          className={`h-1.5 rounded-full ${node.congestion < 30 ? 'bg-status-success' : node.congestion < 60 ? 'bg-status-warning' : 'bg-status-critical'}`}
                          style={{ width: `${node.congestion}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-secondary">{node.congestion}%</span>
                    </div>
                  </td>
                  <td className="table-cell"><StatusBadge status={node.status} /></td>
                  <td className="table-cell text-text-muted text-xs">{formatDistanceToNow(new Date(node.lastUpdate), { addSuffix: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </AppLayout>
  );
}
