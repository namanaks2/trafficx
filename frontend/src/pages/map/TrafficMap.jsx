import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Filter, X, AlertTriangle, Activity, Radio, Navigation } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatusBadge from '../../components/ui/StatusBadge';
import CongestionBar from '../../components/ui/CongestionBar';
import { useApp } from '../../context/AppContext';
import { roadSegments, incidents } from '../../data/demoData';
import 'leaflet/dist/leaflet.css';

const getCongestionColor = (c) => {
  if (c < 30) return '#22C55E';
  if (c < 55) return '#EAB308';
  if (c < 75) return '#F59E0B';
  return '#EF4444';
};

function MapController({ center }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom()); }, [center]);
  return null;
}

function NodePopup({ node }) {
  return (
    <div className="min-w-[220px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-text-primary text-sm">{node.name}</h3>
        <StatusBadge status={node.status} />
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex justify-between"><span className="text-text-muted">Node ID</span><span className="font-mono text-accent-blue">{node.nodeId}</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Vehicles</span><span className="text-text-primary font-medium">{node.vehicleCount.toLocaleString()}</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Avg Speed</span><span className="text-text-primary font-medium">{node.avgSpeed} km/h</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Zone</span><span className="text-text-secondary">{node.zone}</span></div>
        <div className="mt-2">
          <CongestionBar value={node.congestion} />
        </div>
        <div className="pt-2 border-t border-border-subtle">
          <div className="text-text-muted">Prediction (30 min)</div>
          <div className={`font-semibold mt-0.5 ${node.congestion > 70 ? 'text-status-critical' : node.congestion > 45 ? 'text-status-warning' : 'text-status-success'}`}>
            ~{Math.min(99, node.congestion + Math.floor(Math.random() * 10 + 2))}% congestion
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TrafficMap() {
  const { nodes, incidents: liveIncidents } = useApp();
  const [filters, setFilters] = useState({ nodes: true, incidents: true, congestion: true, predictions: false });
  const [selectedNode, setSelectedNode] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [mapCenter] = useState([40.7128, -74.006]);

  const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  const activeIncidents = liveIncidents.filter(i => i.status !== 'resolved');

  return (
    <AppLayout title="Live Traffic Map" subtitle="Real-time monitoring across all zones">
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-9rem)]">
        {/* Map */}
        <div className="flex-1 relative rounded-xl overflow-hidden border border-border-subtle">
          <MapContainer
            center={mapCenter}
            zoom={12}
            className="w-full h-full"
            style={{ minHeight: 400, background: '#080D17' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />

            {/* Road segments */}
            {filters.congestion && roadSegments.map(seg => (
              <Polyline
                key={seg.id}
                positions={seg.coords}
                pathOptions={{ color: getCongestionColor(seg.congestion), weight: 5, opacity: 0.8 }}
              >
                <Popup>
                  <div className="text-xs">
                    <div className="font-bold text-text-primary mb-1">{seg.name}</div>
                    <div>Speed: {seg.speed} km/h</div>
                    <div>Congestion: {seg.congestion}%</div>
                  </div>
                </Popup>
              </Polyline>
            ))}

            {/* Monitoring nodes */}
            {filters.nodes && nodes.map(node => (
              <CircleMarker
                key={node.id}
                center={[node.lat, node.lng]}
                radius={node.status === 'offline' ? 6 : 10}
                pathOptions={{
                  color: node.status === 'offline' ? '#475569' : getCongestionColor(node.congestion),
                  fillColor: node.status === 'offline' ? '#1E293B' : getCongestionColor(node.congestion),
                  fillOpacity: 0.85,
                  weight: 2,
                }}
                eventHandlers={{ click: () => setSelectedNode(node) }}
              >
                <Popup>
                  <NodePopup node={node} />
                </Popup>
              </CircleMarker>
            ))}

            {/* Incidents */}
            {filters.incidents && activeIncidents.map(inc => (
              <CircleMarker
                key={inc.id}
                center={[inc.lat, inc.lng]}
                radius={8}
                pathOptions={{
                  color: '#EF4444',
                  fillColor: '#EF4444',
                  fillOpacity: 0.9,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="min-w-[200px] text-xs">
                    <div className="font-bold text-text-primary mb-2">{inc.title}</div>
                    <div className="text-text-muted mb-1">{inc.location}</div>
                    <StatusBadge status={inc.severity} />
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>

          {/* Map overlay controls */}
          <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="glass-card px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-medium text-text-secondary hover:text-text-primary border border-border-default hover:border-border-accent transition-all"
            >
              <Layers size={14} />
              Layers
            </button>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="glass-card p-3 rounded-xl border border-border-default w-44"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-text-primary">Map Layers</span>
                    <button onClick={() => setShowFilters(false)}><X size={12} className="text-text-muted" /></button>
                  </div>
                  {[
                    { key: 'nodes', label: 'Monitoring Nodes', icon: Radio },
                    { key: 'incidents', label: 'Incidents', icon: AlertTriangle },
                    { key: 'congestion', label: 'Road Congestion', icon: Activity },
                  ].map(({ key, label, icon: Icon }) => (
                    <label key={key} className="flex items-center gap-2 py-1.5 cursor-pointer">
                      <input type="checkbox" checked={filters[key]} onChange={() => toggleFilter(key)} className="accent-accent-blue" />
                      <Icon size={12} className="text-text-muted" />
                      <span className="text-xs text-text-secondary">{label}</span>
                    </label>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 z-[1000] glass-card px-3 py-2 rounded-lg border border-border-subtle">
            <div className="text-[10px] text-text-muted font-semibold mb-1.5 uppercase tracking-wider">Traffic Level</div>
            {[
              { color: '#22C55E', label: 'Free Flow' },
              { color: '#EAB308', label: 'Moderate' },
              { color: '#F59E0B', label: 'Heavy' },
              { color: '#EF4444', label: 'Severe' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2 text-[11px] text-text-secondary">
                <div className="w-3 h-1.5 rounded-full" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className="lg:w-72 xl:w-80 flex flex-col gap-3 overflow-y-auto">
          {/* Stats */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Network Overview</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Nodes', value: nodes.length, color: 'text-accent-blue' },
                { label: 'Online', value: nodes.filter(n => n.status === 'active').length, color: 'text-status-success' },
                { label: 'Active Incidents', value: activeIncidents.length, color: 'text-status-critical' },
                { label: 'Avg Congestion', value: `${Math.round(nodes.filter(n => n.status !== 'offline').reduce((a, b) => a + b.congestion, 0) / nodes.filter(n => n.status !== 'offline').length)}%`, color: 'text-status-warning' },
              ].map(s => (
                <div key={s.label} className="bg-bg-secondary rounded-lg p-3 border border-border-subtle">
                  <p className="text-[10px] text-text-muted uppercase tracking-wide">{s.label}</p>
                  <p className={`text-lg font-bold mt-1 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Node list */}
          <div className="glass-card p-4 flex-1">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Monitoring Nodes</h3>
            <div className="space-y-2">
              {nodes.map(node => (
                <div
                  key={node.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedNode?.id === node.id
                      ? 'border-accent-blue bg-accent-blue/10'
                      : 'border-border-subtle bg-bg-secondary hover:border-border-accent'
                  }`}
                  onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-text-primary truncate">{node.name}</span>
                    <StatusBadge status={node.status} dot={false} />
                  </div>
                  {node.status !== 'offline' && (
                    <CongestionBar value={node.congestion} size="sm" />
                  )}
                  <div className="flex justify-between mt-1.5 text-[10px] text-text-muted">
                    <span>{node.vehicleCount} vehicles</span>
                    <span>{node.avgSpeed} km/h</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active incidents */}
          {activeIncidents.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-status-critical" />
                Active Incidents
              </h3>
              <div className="space-y-2">
                {activeIncidents.map(inc => (
                  <div key={inc.id} className="p-2.5 rounded-lg bg-bg-secondary border border-border-subtle">
                    <div className="flex items-start gap-2">
                      <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${inc.severity === 'critical' || inc.severity === 'high' ? 'bg-status-critical animate-pulse' : 'bg-status-warning'}`} />
                      <div>
                        <p className="text-xs font-medium text-text-primary">{inc.title}</p>
                        <p className="text-[10px] text-text-muted">{inc.location}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
