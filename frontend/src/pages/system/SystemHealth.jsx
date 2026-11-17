import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Activity, Database, Cpu, Wifi, Server, RefreshCw, Circle, AlertTriangle } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { fetchSystemHealth, fetchKafkaStatus } from '../../hooks/useWebSocket';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function StatusDot({ ok }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-status-success' : 'bg-status-critical'}`} />;
}

function Card({ title, icon: Icon, color, children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className={color} />
        <h3 className="section-title">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

function Row({ label, value, valueClass = 'text-text-secondary' }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0 text-xs">
      <span className="text-text-muted">{label}</span>
      <span className={`font-mono font-medium ${valueClass}`}>{String(value ?? '—')}</span>
    </div>
  );
}

export default function SystemHealth() {
  const [health,  setHealth]  = useState(null);
  const [kafka,   setKafka]   = useState(null);
  const [model,   setModel]   = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [h, k] = await Promise.all([fetchSystemHealth(), fetchKafkaStatus()]);
    setHealth(h);
    setKafka(k);
    try {
      const r = await fetch(`${API}/api/analytics/model-metrics`);
      setModel(await r.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); const id = setInterval(refresh, 10000); return () => clearInterval(id); }, [refresh]);

  const kfk = health?.kafka;
  const css = health?.cassandra;
  const lst = health?.lstm;

  return (
    <AppLayout title="System Health" subtitle="Kafka · Cassandra · LSTM · P2P Nodes">
      <div className="flex justify-end mb-4">
        <button onClick={refresh} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* Kafka */}
        <Card title="Apache Kafka" icon={Activity} color="text-accent-blue">
          <Row label="Broker" value="localhost:9092 (KRaft)" />
          <Row label="Producer" value={kfk?.producer ? '✓ Connected' : '✗ Offline'}
            valueClass={kfk?.producer ? 'text-status-success' : 'text-status-critical'} />
          <Row label="Consumer" value={kfk?.consumer ? '✓ Connected' : '✗ Offline'}
            valueClass={kfk?.consumer ? 'text-status-success' : 'text-status-critical'} />
          {kafka?.topics && Object.entries(kafka.topics).map(([topic, s]) => (
            <div key={topic} className="mt-2 p-2 rounded-lg bg-bg-secondary border border-border-subtle">
              <p className="text-[10px] font-mono text-accent-blue mb-1">{topic}</p>
              <div className="grid grid-cols-2 gap-1 text-[10px] text-text-muted">
                <span>Messages: <strong className="text-text-secondary">{s.messages}</strong></span>
                <span>Offset: <strong className="text-text-secondary">{s.last_offset}</strong></span>
                <span className="col-span-2">Last: {s.last_ts ? new Date(s.last_ts).toLocaleTimeString() : '—'}</span>
              </div>
            </div>
          ))}
          {kafka?.websocket_subscribers && (
            <Row label="WS subscribers" value={JSON.stringify(kafka.websocket_subscribers)} />
          )}
        </Card>

        {/* Cassandra */}
        <Card title="Apache Cassandra" icon={Database} color="text-accent-purple">
          <Row label="Keyspace" value="trafficx" />
          <Row label="Connection" value={css?.connected ? '✓ Connected' : '✗ Offline'}
            valueClass={css?.connected ? 'text-status-success' : 'text-status-critical'} />
          {css?.hosts?.map((h, i) => (
            <Row key={i} label={`Host ${i + 1}`} value={`${h.address} (${h.status ? 'up' : 'down'})`}
              valueClass={h.status ? 'text-status-success' : 'text-status-critical'} />
          ))}
          {!css?.connected && (
            <p className="text-xs text-text-muted mt-2">
              {css?.reason || 'Start Cassandra: docker compose up cassandra'}
            </p>
          )}
          <div className="mt-3 pt-3 border-t border-border-subtle text-[10px] text-text-muted space-y-0.5">
            <p>Tables: traffic_by_road · predictions_by_road</p>
            <p>incidents_by_zone · node_health · kafka_offsets</p>
          </div>
        </Card>

        {/* LSTM */}
        <Card title="TensorFlow LSTM" icon={Cpu} color="text-status-warning">
          <Row label="Status" value={lst?.loaded ? '✓ Model loaded' : '⚠ Fallback (rule-based)'}
            valueClass={lst?.loaded ? 'text-status-success' : 'text-status-warning'} />
          <Row label="Model" value={model?.model_version || '—'} />
          {model?.lstm?.t15 && (
            <>
              <div className="mt-3 text-[10px] text-text-muted font-semibold uppercase tracking-wide mb-1">Test-set metrics (normalised)</div>
              {[
                ['+15 min', model.lstm.t15],
                ['+30 min', model.lstm.t30],
                ['+60 min', model.lstm.t60],
              ].map(([label, m]) => m && (
                <div key={label} className="flex items-center justify-between text-[10px] py-0.5">
                  <span className="text-text-muted">{label}</span>
                  <span className="font-mono text-text-secondary">
                    MAE {m.mae} · RMSE {m.rmse} · MAPE {m.mape}%
                  </span>
                </div>
              ))}
            </>
          )}
          {!lst?.loaded && (
            <div className="mt-3 p-2 rounded-lg bg-status-warning/10 border border-status-warning/30 text-[10px] text-status-warning">
              Train the model:<br />
              <code>docker exec trafficx-backend python -m app.ml.lstm_train</code>
            </div>
          )}
        </Card>

        {/* P2P Nodes */}
        <Card title="P2P Edge Nodes" icon={Server} color="text-status-success" >
          <p className="text-xs text-text-muted mb-3">
            Gossip protocol over HTTP — multi-process, not libp2p DHT.
          </p>
          {[
            { id: 'NODE-A', zone: 'zone-a', port: 7001 },
            { id: 'NODE-B', zone: 'zone-b', port: 7002 },
            { id: 'NODE-C', zone: 'zone-c', port: 7003 },
          ].map(n => (
            <NodeRow key={n.id} node={n} />
          ))}
        </Card>

        {/* WebSockets */}
        <Card title="WebSocket Channels" icon={Wifi} color="text-accent-cyan">
          {['all', 'traffic', 'predictions', 'incidents', 'nodes'].map(ch => (
            <Row key={ch} label={`/ws/${ch}`}
              value={kafka?.websocket_subscribers?.[ch] !== undefined
                ? `${kafka.websocket_subscribers[ch]} connected`
                : 'available'}
              valueClass="text-text-secondary"
            />
          ))}
          <p className="text-[10px] text-text-muted mt-2">
            Connect: <code className="font-mono">ws://localhost:8000/ws/traffic</code>
          </p>
        </Card>

        {/* External APIs */}
        <Card title="External API Adapters" icon={AlertTriangle} color="text-status-warning">
          <p className="text-xs text-text-muted mb-3">
            Adapters return simulated data when API keys are absent.
          </p>
          {[
            { name: 'TomTom Traffic',  env: 'TOMTOM_API_KEY',      url: 'developer.tomtom.com' },
            { name: 'HERE Traffic',    env: 'HERE_API_KEY',        url: 'developer.here.com' },
            { name: 'OpenWeather',     env: 'OPENWEATHER_API_KEY', url: 'openweathermap.org/api' },
            { name: 'OSRM Routing',    env: '(none required)',     url: 'router.project-osrm.org' },
          ].map(a => (
            <Row key={a.name} label={a.name}
              value={a.env === '(none required)' ? 'Public API' : `${a.env} → .env`}
              valueClass="text-text-muted"
            />
          ))}
        </Card>
      </div>
    </AppLayout>
  );
}

function NodeRow({ node }) {
  const [status, setStatus] = useState('checking');
  const [summary, setSummary] = useState(null);

  const ping = useCallback(async () => {
    try {
      const r = await fetch(`http://localhost:${node.port}/heartbeat`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) {
        const d = await r.json();
        setStatus('online');
        const s = await fetch(`http://localhost:${node.port}/summary`);
        setSummary(await s.json());
      } else {
        setStatus('offline');
      }
    } catch {
      setStatus('offline');
    }
  }, [node.port]);

  useEffect(() => { ping(); const id = setInterval(ping, 8000); return () => clearInterval(id); }, [ping]);

  return (
    <div className="p-2.5 rounded-lg bg-bg-secondary border border-border-subtle mb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-text-primary">{node.id}</span>
        <div className="flex items-center gap-1.5 text-[10px]">
          <StatusDot ok={status === 'online'} />
          <span className={status === 'online' ? 'text-status-success' : 'text-status-critical'}>{status}</span>
        </div>
      </div>
      <div className="text-[10px] text-text-muted">Zone: {node.zone} · Port: {node.port}</div>
      {summary && (
        <div className="text-[10px] text-text-secondary mt-0.5">
          Speed: {summary.avg_speed} km/h · Vehicles: {summary.vehicle_count} · Congestion: {summary.congestion_pct}%
        </div>
      )}
    </div>
  );
}
