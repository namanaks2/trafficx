import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Download, TrendingUp } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import { useApp } from '../../context/AppContext';
import { hourlyTrafficData, weeklyData, monitoringLocations } from '../../data/demoData';
import { downloadCSV } from '../../utils/format';

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-card border border-border-default rounded-xl p-2.5 text-xs shadow-card">
      <p className="text-text-muted mb-1">{label}</p>
      {payload.map((p,i) => <p key={i} style={{ color:p.color }} className="font-medium">{p.name}: {p.value?.toLocaleString()}</p>)}
    </div>
  );
};

const RANGES = ['24h','7d','30d','90d'];
const SCALE  = { '24h':1,'7d':7,'30d':30,'90d':90 };

export default function Analytics() {
  const { nodes: liveNodes } = useApp();
  const [range, setRange]   = useState('7d');
  const [locId, setLocId]   = useState('all');

  const scale = SCALE[range] ?? 7;

  const hourly = useMemo(() => {
    const loc = monitoringLocations.find(n => n.id === locId);
    return hourlyTrafficData.map(r => ({
      ...r,
      vehicles:   loc ? Math.round(r.vehicles   * loc.vehicleCount / 500) : r.vehicles,
      congestion: loc ? Math.min(99,Math.round(r.congestion * loc.congestion / 65)) : r.congestion,
      speed:      loc ? loc.avgSpeed + Math.floor(Math.random()*4-2) : r.speed,
    }));
  }, [locId]);

  const weekly = useMemo(() => weeklyData.map(r => ({
    ...r,
    vehicles:  Math.round(r.vehicles  * scale/7),
    incidents: Math.round(r.incidents * scale/7),
  })), [scale]);

  const topCongested = useMemo(() => {
    const src = liveNodes?.length ? liveNodes : monitoringLocations;
    return [...src].filter(n=>n.status!=='offline').sort((a,b)=>b.congestion-a.congestion).slice(0,5);
  }, [liveNodes]);

  const summary = [
    { label:'Vehicles',       value:(298420*scale/7).toLocaleString(undefined,{maximumFractionDigits:0}), trend:'+8.4%',  color:'text-accent-blue' },
    { label:'Avg Speed',      value:'34 km/h', trend:'-2.1%', color:'text-status-success' },
    { label:'Peak Congestion',value:'84%',     trend:'+5.3%', color:'text-status-warning' },
    { label:'Incidents',      value:String(Math.round(62*scale/7)), trend:'-12%', color:'text-status-critical' },
  ];

  return (
    <AppLayout title="Analytics" subtitle="Traffic intelligence insights">

      {/* Date range pills */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth:'none' }}>
        {RANGES.map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border shrink-0 transition-all ${
              range===r ? 'bg-accent-blue text-bg-primary border-accent-blue' : 'border-border-subtle text-text-muted bg-bg-card'
            }`}>{r}</button>
        ))}
        <select className="ml-auto input-field text-xs rounded-xl min-w-[130px] shrink-0" value={locId} onChange={e=>setLocId(e.target.value)}>
          <option value="all">All Locations</option>
          {monitoringLocations.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
      </div>

      {/* Summary 2×2 */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {summary.map((s,i) => (
          <motion.div key={i} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.07 }}
            className="glass-card p-3">
            <p className="text-[10px] text-text-muted">{s.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            <p className={`text-[9px] mt-0.5 ${s.trend.startsWith('+')?
              (s.label.includes('Congestion')||s.label.includes('Incidents')?'text-status-critical':'text-status-success'):
              'text-status-critical'}`}>{s.trend} vs prev period</p>
          </motion.div>
        ))}
      </div>

      {/* Hourly congestion */}
      <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }} className="glass-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Hourly Congestion</h3>
            <p className="text-[10px] text-text-muted">24h pattern · {range}</p>
          </div>
          <button onClick={() => downloadCSV(hourly.map(r=>({Hour:r.hour,Vehicles:r.vehicles,Speed:r.speed,'Congestion%':r.congestion})),`analytics-${range}.csv`)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border-subtle text-[10px] text-text-muted hover:border-accent-blue hover:text-accent-blue transition-all">
            <Download size={11} /> CSV
          </button>
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={hourly} margin={{ top:2,right:4,left:-28,bottom:0 }}>
            <defs>
              <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
            <XAxis dataKey="hour" tick={{ fill:'#475569', fontSize:9 }} interval={5} />
            <YAxis tick={{ fill:'#475569', fontSize:9 }} />
            <Tooltip content={<Tip />} />
            <Area type="monotone" dataKey="congestion" stroke="#F59E0B" strokeWidth={2} fill="url(#cg)" name="Congestion %" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Weekly + speed side by side */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25 }} className="glass-card p-3">
          <h3 className="text-xs font-semibold text-text-primary mb-2">Weekly</h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={weekly} margin={{ top:2,right:2,left:-28,bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
              <XAxis dataKey="day" tick={{ fill:'#475569', fontSize:8 }} />
              <YAxis tick={{ fill:'#475569', fontSize:8 }} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="vehicles" fill="#38BDF8" radius={[3,3,0,0]} name="Vehicles" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
        <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }} className="glass-card p-3">
          <h3 className="text-xs font-semibold text-text-primary mb-2">Speed Trend</h3>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={hourly.filter((_,i)=>i%2===0)} margin={{ top:2,right:2,left:-28,bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
              <XAxis dataKey="hour" tick={{ fill:'#475569', fontSize:8 }} interval={5} />
              <YAxis tick={{ fill:'#475569', fontSize:8 }} />
              <Tooltip content={<Tip />} />
              <Line type="monotone" dataKey="speed" stroke="#22C55E" strokeWidth={2} dot={false} name="Speed" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Most congested */}
      <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.35 }} className="glass-card p-4 mb-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <TrendingUp size={14} className="text-status-critical" /> Most Congested
        </h3>
        <div className="space-y-2.5">
          {topCongested.map((loc,i) => (
            <div key={loc.id ?? i}>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-text-muted font-mono text-[10px]">{i+1}.</span>
                  <span className="text-text-secondary truncate max-w-[140px]">{loc.name}</span>
                </div>
                <span className={`font-bold ${loc.congestion>70?'text-status-critical':loc.congestion>50?'text-status-warning':'text-accent-blue'}`}>{loc.congestion}%</span>
              </div>
              <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${loc.congestion>70?'bg-status-critical':loc.congestion>50?'bg-status-warning':'bg-accent-blue'}`}
                  style={{ width:`${loc.congestion}%` }} />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Prediction accuracy */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">ML Accuracy</h3>
        {[{ label:'+15 min', acc:89 },{ label:'+30 min', acc:84 },{ label:'+60 min', acc:76 }].map(a => (
          <div key={a.label} className="flex items-center gap-2.5 mb-2.5">
            <span className="text-xs text-text-muted w-12 shrink-0">{a.label}</span>
            <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
              <div className="h-full bg-accent-purple rounded-full" style={{ width:`${a.acc}%` }} />
            </div>
            <span className="text-xs font-bold text-accent-purple w-8 text-right shrink-0">{a.acc}%</span>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
