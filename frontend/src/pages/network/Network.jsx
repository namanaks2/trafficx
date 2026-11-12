import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Network as NetworkIcon, Shield, Activity, Zap, Hash, CheckCircle, XCircle, Clock, ArrowRight } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatusBadge from '../../components/ui/StatusBadge';
import { networkNodes, nodeConnections, ledgerEntries } from '../../data/demoData';
import { formatDistanceToNow } from 'date-fns';

function NodeTopology({ nodes, connections }) {
  const [animatingEdge, setAnimatingEdge] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const online = connections.filter(c => {
        const from = nodes.find(n => n.id === c.from);
        const to = nodes.find(n => n.id === c.to);
        return from?.status !== 'offline' && to?.status !== 'offline';
      });
      if (online.length) {
        setAnimatingEdge(online[Math.floor(Math.random() * online.length)]);
        setTimeout(() => setAnimatingEdge(null), 1200);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [nodes, connections]);

  const getNode = (id) => nodes.find(n => n.id === id);

  return (
    <svg ref={svgRef} viewBox="0 0 800 480" className="w-full h-full">
      {/* Background grid */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E2D45" strokeWidth="0.5" />
        </pattern>
        <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="480" fill="url(#grid)" />

      {/* Connections */}
      {connections.map((conn, i) => {
        const from = getNode(conn.from);
        const to = getNode(conn.to);
        if (!from || !to) return null;
        const isActive = animatingEdge?.from === conn.from && animatingEdge?.to === conn.to;
        const isOnline = from.status !== 'offline' && to.status !== 'offline';

        return (
          <g key={i}>
            <line
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={isActive ? '#38BDF8' : '#1E2D45'}
              strokeWidth={isActive ? 2 : 1}
              strokeOpacity={isOnline ? 0.8 : 0.3}
              strokeDasharray={isOnline ? 'none' : '4 4'}
            />
            {isActive && (
              <circle r="4" fill="#38BDF8">
                <animateMotion dur="1.2s" fill="freeze">
                  <mpath href={`#path-${i}`} />
                </animateMotion>
              </circle>
            )}
            {isActive && (
              <line
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke="#38BDF8" strokeWidth="1.5" strokeOpacity="0.4"
              >
                <animate attributeName="stroke-opacity" values="0.4;0;0.4" dur="1.2s" repeatCount="1" />
              </line>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map(node => {
        const isOnline = node.status !== 'offline';
        const isSyncing = node.status === 'syncing';
        const color = isOnline ? (isSyncing ? '#F59E0B' : '#38BDF8') : '#475569';

        return (
          <g key={node.id}>
            {/* Glow */}
            {isOnline && (
              <circle cx={node.x} cy={node.y} r="28" fill={`${color}22`}>
                <animate attributeName="r" values="22;30;22" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0.3;0.6" dur="3s" repeatCount="indefinite" />
              </circle>
            )}
            {/* Ring */}
            <circle cx={node.x} cy={node.y} r="18" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity={isOnline ? 0.5 : 0.2} strokeDasharray={isSyncing ? '4 2' : 'none'}>
              {isSyncing && <animateTransform attributeName="transform" type="rotate" values={`0 ${node.x} ${node.y};360 ${node.x} ${node.y}`} dur="3s" repeatCount="indefinite" />}
            </circle>
            {/* Core */}
            <circle cx={node.x} cy={node.y} r="12" fill={isOnline ? `${color}33` : '#1E293B'} stroke={color} strokeWidth="2" />
            {/* Icon dot */}
            <circle cx={node.x} cy={node.y} r="4" fill={color} />
            {/* Label */}
            <text x={node.x} y={node.y + 32} textAnchor="middle" fill="#94A3B8" fontSize="10" fontFamily="Inter, sans-serif">{node.name}</text>
            <text x={node.x} y={node.y + 44} textAnchor="middle" fill="#475569" fontSize="8" fontFamily="JetBrains Mono, monospace">{node.id.split('-').pop()}</text>
            {/* Latency */}
            {isOnline && (
              <text x={node.x} y={node.y - 22} textAnchor="middle" fill="#38BDF8" fontSize="9" fontFamily="JetBrains Mono, monospace">{node.latency}ms</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function Network() {
  const [ledger, setLedger] = useState(ledgerEntries);
  const [selectedNode, setSelectedNode] = useState(null);

  // Simulate new ledger entries
  useEffect(() => {
    const interval = setInterval(() => {
      const online = networkNodes.filter(n => n.status !== 'offline');
      const node = online[Math.floor(Math.random() * online.length)];
      const locations = ['Downtown Junction', 'Highway I-95', 'Bridge Crossing', 'Airport Expressway', 'Financial District'];
      const prevHash = ledger[0]?.hash || '000000000000';
      const newHash = [...Array(12)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');

      setLedger(prev => [{
        txId: 'TX-' + [...Array(8)].map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
        nodeId: node.id,
        timestamp: new Date().toISOString(),
        location: locations[Math.floor(Math.random() * locations.length)],
        observation: `Vehicle count: ${Math.floor(Math.random() * 500 + 100)}, Speed: ${Math.floor(Math.random() * 60 + 15)} km/h`,
        prevHash,
        hash: newHash,
        verified: Math.random() > 0.15,
        peers: Math.floor(Math.random() * 4 + 1),
      }, ...prev.slice(0, 19)]);
    }, 4000);
    return () => clearInterval(interval);
  }, [ledger]);

  const onlineNodes = networkNodes.filter(n => n.status !== 'offline');
  const totalRecords = networkNodes.reduce((a, n) => a + n.recordsProcessed, 0);

  return (
    <AppLayout title="Decentralized Network" subtitle="Peer-to-peer traffic intelligence mesh">
      {/* Disclaimer */}
      <div className="mb-4 px-4 py-3 rounded-lg bg-status-warning/10 border border-status-warning/30 flex items-center gap-2 text-sm text-status-warning">
        <Zap size={14} />
        <span><strong>Simulation Mode:</strong> This demonstrates a simulated P2P network architecture with cryptographic hashing. Node communication is simulated for presentation purposes.</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Online Nodes', value: onlineNodes.length, total: networkNodes.length, color: 'text-status-success' },
          { label: 'Network Latency', value: `${Math.round(onlineNodes.reduce((a, n) => a + n.latency, 0) / onlineNodes.length)}ms`, color: 'text-accent-blue' },
          { label: 'Records Verified', value: totalRecords.toLocaleString(), color: 'text-accent-purple' },
          { label: 'Network Health', value: `${Math.round(onlineNodes.length / networkNodes.length * 100)}%`, color: 'text-status-success' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-4">
            <p className="text-xs text-text-muted mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            {s.total && <p className="text-xs text-text-muted mt-0.5">of {s.total} nodes</p>}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Topology */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card p-4 xl:col-span-3 h-96">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="section-title">Network Topology</h3>
              <p className="section-subtitle">Live node connections and data flow</p>
            </div>
            <span className="badge-success flex items-center gap-1"><Activity size={10} className="animate-pulse" /> Live</span>
          </div>
          <div className="h-72">
            <NodeTopology nodes={networkNodes} connections={nodeConnections} />
          </div>
        </motion.div>

        {/* Node list */}
        <div className="xl:col-span-2 glass-card p-4">
          <h3 className="section-title mb-3">Node Registry</h3>
          <div className="space-y-2.5 overflow-y-auto max-h-80">
            {networkNodes.map(node => (
              <div
                key={node.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedNode?.id === node.id ? 'border-accent-blue bg-accent-blue/10' : 'border-border-subtle bg-bg-secondary hover:border-border-accent'}`}
                onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-text-primary">{node.name}</span>
                  <StatusBadge status={node.status} />
                </div>
                <div className="grid grid-cols-2 gap-x-4 text-[10px] text-text-muted">
                  <span>Region: <span className="text-text-secondary">{node.region}</span></span>
                  <span>Peers: <span className="text-text-secondary">{node.peers}</span></span>
                  <span>Latency: <span className="text-accent-blue">{node.latency}ms</span></span>
                  <span>Records: <span className="text-text-secondary">{node.recordsProcessed.toLocaleString()}</span></span>
                </div>
                {node.status !== 'offline' && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[10px] text-text-muted mb-0.5">
                      <span>Uptime</span><span className="text-status-success">{node.uptime}%</span>
                    </div>
                    <div className="h-1 bg-bg-elevated rounded-full">
                      <div className="h-1 bg-status-success rounded-full" style={{ width: `${node.uptime}%` }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Distributed Ledger */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-5 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-title flex items-center gap-2">
              <Shield size={16} className="text-accent-purple" />
              Distributed Ledger
            </h3>
            <p className="section-subtitle">Tamper-evident SHA-256 chained traffic records</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-status-success">
            <Activity size={12} className="animate-pulse" />
            Live recording
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-border-subtle">
                {['TX ID', 'Node', 'Time', 'Location', 'Observation', 'Hash', 'Verified'].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.slice(0, 10).map((entry, i) => (
                <motion.tr
                  key={entry.txId}
                  initial={i === 0 ? { opacity: 0, backgroundColor: 'rgba(56,189,248,0.1)' } : {}}
                  animate={{ opacity: 1, backgroundColor: 'transparent' }}
                  className="table-row"
                >
                  <td className="table-cell font-mono text-accent-blue text-xs">{entry.txId}</td>
                  <td className="table-cell text-xs font-mono">{entry.nodeId.split('-').pop()}</td>
                  <td className="table-cell text-xs">{formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}</td>
                  <td className="table-cell text-xs">{entry.location}</td>
                  <td className="table-cell text-xs text-text-muted max-w-[160px] truncate">{entry.observation}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1 text-xs">
                      <Hash size={10} className="text-text-muted" />
                      <span className="font-mono text-text-muted">{entry.hash}</span>
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
