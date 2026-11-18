import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Activity, Zap, Gauge, Wifi, Brain,
  Map, Route, CalendarDays, TrendingUp, TrendingDown,
  ChevronDown, ArrowRight
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import { weeklyData } from '../../data/demoData';
import { api } from '../../services/api';

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#e5e9ef] bg-white px-3 py-2 shadow-lg text-xs">
      <p className="mb-1 text-[#7b8593]">{label}</p>
      {payload.map((item, index) => (
        <p key={index} className="font-bold" style={{ color: item.color }}>{item.name}: {item.value?.toLocaleString()}</p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [locations, setLocations] = useState([]);
  const [health, setHealth] = useState(null);
  const [history, setHistory] = useState([]);
  const [dataStatus, setDataStatus] = useState('connecting');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState('');
  const [densityRange, setDensityRange] = useState(24);

  useEffect(() => {
    let active = true;
    let timer;

    const refresh = async () => {
      if (!api.configured) {
        setDataStatus('offline');
        setError('Set VITE_API_URL to the deployed TrafficX backend URL and rebuild the frontend.');
        return;
      }

      try {
        const [roads, backendHealth] = await Promise.all([
          api.traffic.locations(),
          api.health.status(),
        ]);
        if (!Array.isArray(roads)) throw new Error('Backend did not return traffic readings.');
        if (!active) return;

        const now = new Date();
        const avg = (key) => roads.length
          ? roads.reduce((sum, road) => sum + Number(road[key] || 0), 0) / roads.length
          : 0;
        const liveRoads = roads.filter(road => road.source === 'tomtom').length;
        setLocations(roads);
        setHealth(backendHealth);
        setHistory(previous => [...previous, {
          label: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          congestion: Number(avg('congestion').toFixed(1)),
          speed: Number(avg('avg_speed').toFixed(1)),
        }].slice(-24));
        setLastUpdated(now);
        setDataStatus(liveRoads === roads.length && roads.length ? 'live' : liveRoads ? 'mixed' : 'simulated');
        setError('');
      } catch (requestError) {
        if (!active) return;
        setDataStatus('offline');
        setError(requestError.message || 'Could not load traffic data from the backend.');
      } finally {
        if (active) timer = setTimeout(refresh, 60_000);
      }
    };

    refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const average = (key) => locations.length
    ? locations.reduce((sum, road) => sum + Number(road[key] || 0), 0) / locations.length
    : null;
  const liveRoads = locations.filter(road => road.source === 'tomtom').length;
  const congestion = average('congestion');
  const congestionData = [
    { name: 'High', value: locations.filter(road => road.congestion >= 70).length, fill: '#ef4444' },
    { name: 'Moderate', value: locations.filter(road => road.congestion >= 40 && road.congestion < 70).length, fill: '#f59e0b' },
    { name: 'Low', value: locations.filter(road => road.congestion < 40).length, fill: '#22c55e' },
  ].map(item => ({ ...item, value: locations.length ? Math.round(item.value / locations.length * 100) : 0 }));
  const kpiCards = [
    { title: 'Road Segments', value: locations.length || '--', icon: Activity, accent: 'text-[#ef4444]', bg: 'bg-[#fff1f1]' },
    { title: 'Average Speed', value: average('avg_speed')?.toFixed(1) ?? '--', unit: 'km/h', icon: Gauge, accent: 'text-[#f97316]', bg: 'bg-[#fff6e9]' },
    { title: 'Average Congestion', value: congestion?.toFixed(1) ?? '--', unit: '%', icon: Zap, accent: 'text-[#7c3aed]', bg: 'bg-[#f5f1ff]' },
    { title: 'TomTom Coverage', value: locations.length ? `${liveRoads}/${locations.length}` : '--', icon: Wifi, accent: 'text-[#16a34a]', bg: 'bg-[#edf9f0]' },
    { title: 'Kafka', value: health?.kafka?.consumer ? 'Connected' : 'Offline', icon: Activity, accent: health?.kafka?.consumer ? 'text-[#16a34a]' : 'text-[#f97316]', bg: 'bg-[#fff6e9]' },
    { title: 'Forecast Model', value: health?.lstm?.loaded ? 'LSTM' : 'Rule-based', icon: Brain, accent: 'text-[#2563eb]', bg: 'bg-[#eef5ff]' },
  ];
  const densityData = history.slice(-densityRange);
  const statusLabel = {
    live: 'TomTom live',
    mixed: 'Mixed sources',
    simulated: 'Simulated feed',
    offline: 'Backend unavailable',
    connecting: 'Connecting',
  }[dataStatus];
  const statusStyle = dataStatus === 'live'
    ? 'border-green-200 bg-green-50 text-green-700'
    : dataStatus === 'offline'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-amber-200 bg-amber-50 text-amber-800';

  return (
    <AppLayout title="Overview" subtitle="Real-time traffic intelligence" dataStatus={dataStatus}>
      <div className="space-y-5">
        <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-xs ${statusStyle}`}>
          <div className="flex items-center gap-2 font-bold">
            <span className={`h-2 w-2 rounded-full ${dataStatus === 'live' ? 'bg-green-500 animate-pulse' : dataStatus === 'offline' ? 'bg-red-500' : 'bg-amber-500'}`} />
            {statusLabel}
          </div>
          <span className="text-current/75">
            {dataStatus === 'simulated' && !health?.traffic_provider?.configured
              ? 'Add TOMTOM_API_KEY to Render to enable real traffic readings'
              : dataStatus === 'simulated' && locations.some(road => road.source_note)
                ? 'TomTom lookup failed; simulated fallback is active'
                : lastUpdated ? `Last checked ${lastUpdated.toLocaleTimeString()}` : 'Waiting for first backend reading'}
          </span>
        </div>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative min-h-[190px] overflow-hidden rounded-[18px] border border-[#26292d] bg-[#15171a] shadow-[0_12px_35px_rgba(23,30,40,.12)]"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(12,15,19,.96) 0%, rgba(12,15,19,.84) 38%, rgba(12,15,19,.18) 72%, rgba(12,15,19,.05) 100%), url('https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1800&q=88')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
          <div className="relative z-10 flex min-h-[190px] flex-col justify-center px-6 py-7 md:px-8">
            <div className="mb-3 h-1 w-12 rounded-full bg-[#e31b2f]" />
            <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-[38px]">
              City Traffic <span className="text-[#ff3046]">Control</span> Center
            </h2>
            <p className="mt-1 text-sm text-white/70 md:text-base">Monitor · Predict · Optimize Urban Mobility</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/map" className="flex h-12 items-center gap-2 rounded-lg bg-[#e31b2f] px-5 text-sm font-bold text-white shadow-[0_8px_22px_rgba(227,27,47,.28)] hover:bg-[#c91a2a] transition-colors">
                <Map size={17} /> Open Live Map <ArrowRight size={15} />
              </Link>
              <Link to="/prediction" className="flex h-12 items-center gap-2 rounded-lg border border-white/55 bg-black/20 px-5 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/10 transition-colors">
                <Brain size={17} /> Open Forecast
              </Link>
            </div>
          </div>
        </motion.section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {kpiCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="min-h-[118px] rounded-xl border border-[#edf0f3] bg-white px-4 py-4 shadow-[0_5px_18px_rgba(25,35,48,.045)]"
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.bg}`}>
                  <card.icon size={19} className={card.accent} />
                </div>
                {card.trend !== undefined && (
                  <div className={`flex items-center gap-1 text-xs font-bold ${card.trend >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                    {card.trend >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {card.trend >= 0 ? '+' : ''}{card.trend}%
                  </div>
                )}
              </div>
              <div className="mt-3">
                <div className="text-[22px] font-extrabold leading-none text-[#171923]">
                  {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                  {card.unit && <span className="ml-1 text-sm font-bold">{card.unit}</span>}
                </div>
                <p className="mt-1 text-xs font-semibold text-[#697586]">{card.title}</p>
              </div>
            </motion.div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="rounded-xl border border-[#edf0f3] bg-white p-5 shadow-[0_5px_18px_rgba(25,35,48,.045)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[17px] font-extrabold text-[#171923]">Live Congestion Trend</h3>
                <p className="mt-1 text-xs text-[#858f9d]">Average across monitored roads · sampled this session</p>
              </div>
              <button onClick={() => setDensityRange(densityRange === 24 ? 12 : 24)} className="flex h-9 items-center gap-2 rounded-lg border border-[#edf0f3] px-3 text-xs font-semibold text-[#3d4654]">
                Last {densityRange} readings <ChevronDown size={14} />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={215}>
              <AreaChart data={densityData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="trafficDensity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#edf0f3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#8792a1', fontSize: 10 }} interval={Math.max(0, Math.floor(densityData.length / 6))} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#8792a1', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="congestion" stroke="#ef4444" strokeWidth={2.5} fill="url(#trafficDensity)" name="Congestion %" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-xl border border-[#edf0f3] bg-white p-5 shadow-[0_5px_18px_rgba(25,35,48,.045)]">
            <h3 className="text-[17px] font-extrabold text-[#171923]">Congestion Breakdown</h3>
            <p className="mt-1 text-xs text-[#858f9d]">Current road distribution</p>
            <div className="mt-2 flex items-center">
              <div className="relative h-[155px] w-[58%]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={congestionData} cx="50%" cy="50%" innerRadius={48} outerRadius={68} paddingAngle={2} dataKey="value" stroke="none">
                      {congestionData.map((item) => <Cell key={item.name} fill={item.fill} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-extrabold text-[#171923]">{congestion?.toFixed(0) ?? '--'}%</span>
                  <span className="text-[10px] text-[#858f9d]">Overall</span>
                </div>
              </div>
              <div className="w-[42%] space-y-3">
                {congestionData.map((item) => (
                  <div key={item.name} className="flex items-center text-xs">
                    <span className="mr-2 h-2.5 w-2.5 rounded-full" style={{ background: item.fill }} />
                    <span className="flex-1 text-[#697586]">{item.name}</span>
                    <span className="font-bold text-[#171923]">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="rounded-xl border border-[#edf0f3] bg-white p-5 shadow-[0_5px_18px_rgba(25,35,48,.045)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[17px] font-extrabold text-[#171923]">Weekly Trend</h3>
                <p className="mt-1 text-xs text-[#858f9d]">Illustrative sample history · not live readings</p>
              </div>
              <CalendarDays size={18} className="text-[#ef4444]" />
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#edf0f3" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#8792a1', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8792a1', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="congestionIndex" fill="#ef4444" radius={[5, 5, 0, 0]} name="Sample congestion %" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="rounded-xl border border-[#edf0f3] bg-white p-5 shadow-[0_5px_18px_rgba(25,35,48,.045)]">
            <div className="mb-4">
              <h3 className="text-[17px] font-extrabold text-[#171923]">Quick Actions</h3>
              <p className="mt-1 text-xs text-[#858f9d]">Common traffic management tasks</p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Live Map', icon: Map, to: '/map', color: 'text-[#ef4444]', bg: 'bg-[#fff1f1]' },
                { label: 'Open Forecast', icon: Brain, to: '/prediction', color: 'text-[#2563eb]', bg: 'bg-[#eef5ff]' },
                { label: 'Smart Route', icon: Route, to: '/routes', color: 'text-[#16a34a]', bg: 'bg-[#edf9f0]' },
                { label: 'Report Incident', icon: AlertTriangle, to: '/incidents', color: 'text-[#9333ea]', bg: 'bg-[#f7efff]' },
              ].map((action) => (
                <Link key={action.label} to={action.to} className="group flex min-h-[92px] flex-col items-center justify-center rounded-xl border border-[#edf0f3] bg-[#fbfcfd] px-2 text-center transition-all hover:-translate-y-0.5 hover:border-[#dfe4ea] hover:shadow-md">
                  <span className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${action.bg}`}><action.icon size={18} className={action.color} /></span>
                  <span className="text-xs font-bold text-[#343b47]">{action.label}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        </section>
      </div>
    </AppLayout>
  );
}
