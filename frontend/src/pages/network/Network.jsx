import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Activity, Zap, Hash, CheckCircle, Clock,
  X, Server, Wifi, Globe, TrendingUp,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatusBadge from '../../components/ui/StatusBadge';
import { networkNodes, nodeConnections, ledgerEntries } from '../../data/demoData';
import { formatDistanceToNow } from 'date-fns';

// ─── Topology SVG ─────────────────────────────────────────────────────────────

function NodeTopology({ nodes, connections, onSelectNode, selectedId }) {
  // Animate a moving dot along a random online edge every 1.5 s
  const [activePkt, setActivePkt] = useState(null); // { from, to, progress, id }
  const rafRef = useRef(null);
  const pktsRef = useRef([]);

  const spawnPacket = useCallback(() => {
    const online = connections.filter(c => {
      const a = nodes.find(n => n.id === c.from);
      const b = nodes.find(n => n.id === c.to);
      return a?.status !== 'offline' && b?.status !== 'offline';
    });
    if (!online.length) return;
    const conn = online[Math.floor(Math.random() * online.length)];
    const id = Date.now();
    pktsRef.current = [{ ...conn, progress: 0, id }];
  }, [connections, nodes]);

  // Animate packets with rAF
  useEffect(() => {
    let last = 0;
    const step = (ts) => {
      if (ts - last > 16) {
        pktsRef.current = pktsRef.current
          .map(p => ({ ...p, progress: p.progress + 0.018 }))
          .filter(p => p.progress <= 1);
        setActivePkt(pktsRef.current[0] || null);
        last = ts;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    const id = setInterval(spawnPacket, 1600);
    return () => clearInterval(id);
  }, [spawnPacket]);

  const getNode = (id) => nodes.find(n => n.id === id);

  const interpolate = (conn, t) => {
    const from = getNode(conn.from);
    const to   = getNode(conn.to);
    if (!from || !to) return null;
    return {
      cx: from.x + (to.x - from.x) * t,
      cy: from.y + (to.y - from.y) * t,
    };
  };

  return (
    <svg viewBox="0 0 800 480" className="w-full h-full select-none">
      <defs>
        <pattern id="netgrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E2D45" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="800" height="480" fill="url(#netgrid)" />

      {/* Edges */}
      {connections.map((conn, i) => {
        const from = getNode(conn.from);
        const to   = getNode(conn.to);
        if (!from || !to) return null;
        const isOnline = from.status !== 'offline' && to.status !== 'offline';
        const isActive = activePkt?.from === conn.from && activePkt?.to === conn.to;
        return (
          <line
            key={i}
            x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke={isActive ? '#38BDF8' : '#1E2D45'}
            strokeWidth={isActive ? 2 : 1}
            strokeOpacity={isOnline ? 0.9 : 0.25}
            strokeDasharray={isOnline ? undefined : '4 4'}
          />
        );
      })}

      {/* Moving packet dot */}
      {activePkt && (() => {
        const pt = interpolate(activePkt, activePkt.progress);
        return pt ? (
          <circle cx={pt.cx} cy={pt.cy} r="5" fill="#38BDF8" opacity="0.9">
            <animate attributeName="r" values="4;6;4" dur="0.6s" repeatCount="indefinite" />
          </circle>
        ) : null;
      })()}

      {/* Nodes */}
      {nodes.map(node => {
        const isOnline  = node.status !== 'offline';
        const isSyncing = node.status === 'syncing';
        const isSelected = node.id === selectedId;
        const color = isOnline ? (isSyncing ? '#F59E0B' : '#38BDF8') : '#475569';

        return (
          <g
            key={node.id}
            onClick={() => onSelectNode(node)}
            style={{ cursor: 'pointer' }}
          >
            {/* Selection ring */}
            {isSelected && (
              <circle
                cx={node.x} cy={node.y} r="26"
                fill="none" stroke="#38BDF8" strokeWidth="2" strokeOpacity="0.8"
              />
            )}
            {/* Pulse glow */}
            {isOnline && (
              <circle cx={node.x} cy={node.y} r="22" fill={`${color}18`}>
                <animate attributeName="r" values="18;26;18" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0.2;0.5" dur="3s" repeatCount="indefinite" />
              </circle>
            )}
            {/* Outer ring (spinning when syncing) */}
            <circle
              cx={node.x} cy={node.y} r="16"
              fill="none" stroke={color} strokeWidth="1.5"
              strokeOpacity={isOnline ? 0.5 : 0.2}
              strokeDasharray={isSyncing ? '5 3' : undefined}
            >
              {isSyncing && (
                <animateTransform
                  attributeName="transform" type="rotate"
                  values={`0 ${node.x} ${node.y};360 ${node.x} ${node.y}`}
                  dur="2s" repeatCount="indefinite"
                />
              )}
            </circle>
            {/* Core fill */}
            <circle
              cx={node.x} cy={node.y} r="11"
              fill={isOnline ? `${color}28` : '#1E293B'}
              stroke={color} strokeWidth="2"
            />
            {/* Centre dot */}
            <circle cx={node.x} cy={node.y} r="3.5" fill={color} />

            {/* Labels */}
            <text x={node.x} y={node.y + 30} textAnchor="middle" fill="#94A3B8" fontSize="10" fontFamily="Inter,sans-serif">
              {node.name}
            </text>
            <text x={node.x} y={node.y + 42} textAnchor="middle" fill="#475569" fontSize="8" fontFamily="JetBrains Mono,monospace">
              {node.id}
            </text>
            {isOnline && (
              <text x={node.x} y={node.y - 20} textAnchor="middle" fill="#38BDF8" fontSize="9" fontFamily="JetBrains Mono,monospace">
                {node.latency}ms
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Node Detail Slide-in Panel ───────────────────────────────────────────────

function NodeDetailPanel({ node, onClose }) {
  if (!node) return null;
  const isOnline = node.status !== 'offline';

  return (
    <AnimatePresence>
      <motion.div
        key={node.id}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ duration: 0.25 }}
        className="glass-card p-4 border border-border-default rounded-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-status-success animate-pulse' : 'bg-text-muted'}`} />
            <span className="text-sm font-bold text-text-primary">{node.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={node.status} />
            <button onClick={onClose} className="p-1 rounded hover:bg-bg-elevated text-text-muted">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          {[
            { icon: Server, label: 'Node ID',   value: node.id,       color: 'text-accent-blue font-mono' },
            { icon: Globe,  label: 'Region',    value: node.region,   color: 'text-text-secondary' },
            { icon: Wifi,   label: 'Peers',     value: `${node.peers} connected`, color: 'text-text-secondary' },
            { icon: Zap,    label: 'Latency',   value: isOnline ? `${node.latency} ms` : 'N/A', color: isOnline ? 'text-accent-blue' : 'text-text-muted' },
            { icon: Hash,   label: 'Records',   value: node.recordsProcessed.toLocaleString(), color: 'text-accent-purple' },
            { icon: Clock,  label: 'Last Sync', value: formatDistanceToNow(new Date(node.lastSync), { addSuffix: true }), color: 'text-text-muted' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Icon size={11} />
                <span>{label}</span>
              </div>
              <span className={color}>{value}</span>
            </div>
          ))}

          {isOnline && (
            <div className="pt-2 border-t border-border-subtle">
              <div className="flex items-center justify-between mb-1 text-text-muted">
                <div className="flex items-center gap-1.5"><TrendingUp size={11} /> Uptime</div>
                <span className="text-status-success font-semibold">{node.uptime}%</span>
              </div>
              <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-status-success rounded-full"
                  style={{ width: `${node.uptime}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Network() {
  const [ledger, setLedger] = useState(ledgerEntries);
  const [selectedNode, setSelectedNode] = useState(null);
  // Use a ref to hold latest hash so the interval doesn't depend on `ledger` state
  const latestHashRef = useRef(ledgerEntries[0]?.hash || '000000000000');

  const handleSelectNode = (node) => {
    setSelectedNode(prev => prev?.id === node.id ? null : node);
  };

  // Live ledger simulation — interval does NOT depend on `ledger` state (no infinite loop)
  useEffect(() => {
    const online = networkNodes.filter(n => n.status !== 'offline');
    const locs = ['Downtown Junction', 'Highway I-95', 'Bridge Crossing', 'Airport Expressway', 'Financial District'];

    const interval = setInterval(() => {
      const node = online[Math.floor(Math.random() * online.length)];
      const prevHash = latestHashRef.current;
      const newHash  = Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      latestHashRef.current = newHash;

      setLedger(prev => [{
        txId:        'TX-' + Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase(),
        nodeId:      node.id,
        timestamp:   new Date().toISOString(),
        location:    locs[Math.floor(Math.random() * locs.length)],
        observation: `Vehicle count: ${Math.floor(Math.random() * 500 + 100)}, Speed: ${Math.floor(Math.random() * 60 + 15)} km/h`,
        prevHash,
        hash:        newHash,
        verified:    Math.random() > 0.15,
        peers:       Math.floor(Math.random() * 4 + 1),
      }, ...prev.slice(0, 19)]);
    }, 4000);

    return () => clearInterval(interval);
  }, []); // ← empty deps — no loop

  const onlineNodes  = networkNodes.filter(n => n.status !== 'offline');
  const totalRecords = networkNodes.reduce((a, n) => a + n.recordsProcessed, 0);

  return (
    <AppLayout title="Decentralized Network" subtitle="Peer-to-peer traffic intelligence mesh">
      {/* Notice */}
      <div className="mb-4 px-4 py-3 rounded-lg bg-status-warning/10 border border-status-warning/30 flex items-start gap-2 text-sm text-status-warning">
        <Zap size={14} className="mt-0.5 shrink-0" />
        <span>
          <strong>Simulation Mode:</strong> Demonstrates a P2P network architecture with SHA-256
          chained records. Node communication and hash generation are simulated for presentation.
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Online Nodes',    value: `${onlineNodes.length}/${networkNodes.length}`, color: 'text-status-success' },
          { label: 'Avg Latency',     value: `${Math.round(onlineNodes.reduce((a, n) => a + n.latency, 0) / onlineNodes.length)}ms`, color: 'text-accent-blue' },
          { label: 'Records Logged',  value: totalRecords.toLocaleString(), color: 'text-accent-purple' },
          { label: 'Network Health',  value: `${Math.round(onlineNodes.length / networkNodes.length * 100)}%`, color: 'text-status-success' },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass-card p-4"
          >
            <p className="text-xs text-text-muted mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Topology + Node panel */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-4">
        {/* Topology canvas */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-4 xl:col-span-3"
          style={{ height: 420 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="section-title">Network Topology</h3>
              <p className="section-subtitle">Click a node for details · live data flow</p>
            </div>
            <span className="badge-success flex items-center gap-1">
              <Activity size={10} className="animate-pulse" /> Live
            </span>
          </div>
          <div style={{ height: 348 }}>
            <NodeTopology
              nodes={networkNodes}
              connections={nodeConnections}
              onSelectNode={handleSelectNode}
              selectedId={selectedNode?.id}
            />
          </div>
        </motion.div>

        {/* Right column: Node registry + detail */}
        <div className="xl:col-span-2 flex flex-col gap-3">
          {/* Selected node detail panel */}
          <AnimatePresence>
            {selectedNode && (
              <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
            )}
          </AnimatePresence>

          {/* Node list */}
          <div className="glass-card p-4 flex-1">
            <h3 className="section-title mb-3">Node Registry</h3>
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: selectedNode ? 220 : 340 }}>
              {networkNodes.map(node => (
                <div
                  key={node.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedNode?.id === node.id
                      ? 'border-accent-blue bg-accent-blue/10'
                      : 'border-border-subtle bg-bg-secondary hover:border-border-accent'
                  }`}
                  onClick={() => handleSelectNode(node)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-text-primary">{node.name}</span>
                    <StatusBadge status={node.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 text-[10px] text-text-muted">
                    <span>Region: <span className="text-text-secondary">{node.region}</span></span>
                    <span>Peers: <span className="text-text-secondary">{node.peers}</span></span>
                    <span>Latency: <span className="text-accent-blue">{node.latency}ms</span></span>
                    <span>Records: <span className="text-text-secondary">{node.recordsProcessed.toLocaleString()}</span></span>
                  </div>
                  {node.status !== 'offline' && (
                    <div className="mt-1.5">
                      <div className="flex justify-between text-[10px] text-text-muted mb-0.5">
                        <span>Uptime</span>
                        <span className="text-status-success">{node.uptime}%</span>
                      </div>
                      <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
                        <div className="h-full bg-status-success rounded-full" style={{ width: `${node.uptime}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Distributed Ledger */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-card p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-title flex items-center gap-2">
              <Shield size={16} className="text-accent-purple" />
              Distributed Ledger
            </h3>
            <p className="section-subtitle">Tamper-evident SHA-256 chained traffic records</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted font-mono">{ledger.length} entries</span>
            <div className="flex items-center gap-1.5 text-xs text-status-success">
              <Activity size={12} className="animate-pulse" />
              Live recording
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-border-subtle">
                {['TX ID', 'Node', 'Time', 'Location', 'Observation', 'Prev → Hash', 'Verified'].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.slice(0, 12).map((entry, i) => (
                <motion.tr
                  key={entry.txId}
                  initial={i === 0 ? { opacity: 0, backgroundColor: 'rgba(56,189,248,0.12)' } : false}
                  animate={{ opacity: 1, backgroundColor: 'transparent' }}
                  transition={{ duration: 0.8 }}
                  className="table-row"
                >
                  <td className="table-cell font-mono text-accent-blue text-xs">{entry.txId}</td>
                  <td className="table-cell text-xs font-mono text-text-secondary">
                    {entry.nodeId.replace('P2P-', '')}
                  </td>
                  <td className="table-cell text-xs text-text-muted whitespace-nowrap">
                    {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                  </td>
                  <td className="table-cell text-xs">{entry.location}</td>
                  <td className="table-cell text-xs text-text-muted max-w-[160px] truncate">
                    {entry.observation}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1 text-[10px] font-mono text-text-muted">
                      <span className="text-text-muted/50">{entry.prevHash.slice(0, 6)}…</span>
                      <span className="text-text-muted">→</span>
                      <span className="text-accent-blue">{entry.hash}</span>
                    </div>
                  </td>
                  <td className="table-cell">
                    {entry.verified
                      ? <span className="flex items-center gap-1 text-status-success text-xs"><CheckCircle size={12} /> {entry.peers} nodes</span>
                      : <span className="flex items-center gap-1 text-status-warning text-xs"><Clock size={12} /> Pending</span>
                    }
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </AppLayout>
  );
}
