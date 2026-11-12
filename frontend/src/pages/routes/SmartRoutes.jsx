import { useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
import { motion } from 'framer-motion';
import { Route, Search, Navigation, Clock, Gauge, ArrowRight, Info, Zap, Leaf, Shield } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import CongestionBar from '../../components/ui/CongestionBar';
import { demoRoutes } from '../../data/demoData';
import 'leaflet/dist/leaflet.css';

const ROUTE_COLORS = { fastest: '#38BDF8', alternative: '#8B5CF6', eco: '#22C55E' };
const ROUTE_ICONS = { fastest: Zap, alternative: Navigation, eco: Leaf };

export default function SmartRoutes() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [routes, setRoutes] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = () => {
    if (!origin || !destination) return;
    setLoading(true);
    setTimeout(() => {
      setRoutes(demoRoutes.routes);
      setSelectedRoute(demoRoutes.routes[0]);
      setLoading(false);
    }, 1200);
  };

  const handleDemo = () => {
    setOrigin(demoRoutes.origin);
    setDestination(demoRoutes.destination);
    setLoading(true);
    setTimeout(() => {
      setRoutes(demoRoutes.routes);
      setSelectedRoute(demoRoutes.routes[0]);
      setLoading(false);
    }, 1000);
  };

  return (
    <AppLayout title="Smart Routes" subtitle="AI-powered route recommendations">
      {/* Demo notice */}
      <div className="mb-4 px-4 py-3 rounded-lg bg-status-warning/10 border border-status-warning/30 flex items-center gap-2 text-sm text-status-warning">
        <Info size={14} />
        <span><strong>Demo Mode:</strong> Route search uses pre-configured demo routes. Connect a routing API (OSRM, Mapbox) for live routing.</span>
      </div>

      {/* Search */}
      <div className="glass-card p-5 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Origin</label>
            <div className="relative">
              <Navigation size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-status-success" />
              <input className="input-field pl-9" placeholder="Starting location..." value={origin} onChange={e => setOrigin(e.target.value)} />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Destination</label>
            <div className="relative">
              <Navigation size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-status-critical" />
              <input className="input-field pl-9" placeholder="Destination..." value={destination} onChange={e => setDestination(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSearch} disabled={loading || !origin || !destination} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading ? <span className="w-4 h-4 border-2 border-bg-primary/30 border-t-bg-primary rounded-full animate-spin" /> : <><Search size={14} />Find</>}
            </button>
            <button onClick={handleDemo} className="btn-secondary text-xs px-3">Demo</button>
          </div>
        </div>
      </div>

      {routes ? (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          {/* Route options */}
          <div className="xl:col-span-2 space-y-3">
            {routes.map(route => {
              const Icon = ROUTE_ICONS[route.type];
              const color = ROUTE_COLORS[route.type];
              const isSelected = selectedRoute?.id === route.id;
              return (
                <motion.div
                  key={route.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setSelectedRoute(route)}
                  className={`glass-card p-4 cursor-pointer transition-all ${isSelected ? 'border-2' : 'border border-border-subtle hover:border-border-accent'}`}
                  style={isSelected ? { borderColor: color } : {}}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg" style={{ background: `${color}20` }}>
                        <Icon size={14} style={{ color }} />
                      </div>
                      <span className="text-sm font-semibold text-text-primary">{route.label}</span>
                    </div>
                    {isSelected && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color, background: `${color}20` }}>Selected</span>}
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <p className="text-[10px] text-text-muted uppercase tracking-wide">Duration</p>
                      <p className="text-sm font-bold text-text-primary flex items-center gap-1"><Clock size={10} />{route.duration}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-muted uppercase tracking-wide">Distance</p>
                      <p className="text-sm font-bold text-text-primary">{route.distance}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-muted uppercase tracking-wide">Congestion</p>
                      <p className="text-sm font-bold" style={{ color: route.congestion > 60 ? '#EF4444' : route.congestion > 35 ? '#F59E0B' : '#22C55E' }}>{route.congestion}%</p>
                    </div>
                  </div>

                  <CongestionBar value={route.congestion} size="sm" showLabel={false} />

                  <div className="mt-3">
                    <p className="text-[10px] text-text-muted mb-1">Via</p>
                    <div className="flex flex-wrap gap-1">
                      {route.via.map((v, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-bg-elevated border border-border-subtle text-text-muted">{v}</span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Road segments */}
            {selectedRoute && (
              <div className="glass-card p-4">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Road Conditions</h3>
                <div className="space-y-2.5">
                  {selectedRoute.segments.map((seg, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-text-secondary">{seg.name}</span>
                        <span className="text-text-muted">{seg.speed} km/h</span>
                      </div>
                      <CongestionBar value={seg.congestion} size="sm" showLabel={false} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Map */}
          <div className="xl:col-span-3 glass-card overflow-hidden" style={{ minHeight: 400 }}>
            <MapContainer center={[40.7128, -74.006]} zoom={11} className="w-full h-full" style={{ minHeight: 400, background: '#080D17' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
              {routes.map(route => (
                <Polyline
                  key={route.id}
                  positions={route.coords}
                  pathOptions={{
                    color: ROUTE_COLORS[route.type],
                    weight: selectedRoute?.id === route.id ? 5 : 3,
                    opacity: selectedRoute?.id === route.id ? 1 : 0.4,
                    dashArray: selectedRoute?.id === route.id ? null : '8 6',
                  }}
                >
                  <Popup>
                    <div className="text-xs">
                      <div className="font-bold">{route.label}</div>
                      <div>{route.duration} · {route.distance}</div>
                    </div>
                  </Popup>
                </Polyline>
              ))}
              {/* Origin */}
              <CircleMarker center={routes[0].coords[0]} radius={8} pathOptions={{ color: '#22C55E', fillColor: '#22C55E', fillOpacity: 1 }}>
                <Popup>Origin</Popup>
              </CircleMarker>
              {/* Destination */}
              <CircleMarker center={routes[0].coords[routes[0].coords.length - 1]} radius={8} pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 1 }}>
                <Popup>Destination</Popup>
              </CircleMarker>
            </MapContainer>
          </div>
        </div>
      ) : (
        <div className="glass-card p-16 text-center">
          <Route size={48} className="text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">Find the optimal route</h3>
          <p className="text-sm text-text-secondary mb-4">Enter your origin and destination to get AI-powered route recommendations with real-time traffic conditions.</p>
          <button onClick={handleDemo} className="btn-primary">Try Demo Route</button>
        </div>
      )}
    </AppLayout>
  );
}
