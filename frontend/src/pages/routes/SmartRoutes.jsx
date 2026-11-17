import { useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
import { motion } from 'framer-motion';
import { Navigation, Search, Clock, Zap, Leaf, ChevronRight, Info } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import CongestionBar from '../../components/ui/CongestionBar';
import { demoRoutes } from '../../data/demoData';
import 'leaflet/dist/leaflet.css';

const COLORS = { fastest:'#38BDF8', alternative:'#8B5CF6', eco:'#22C55E' };
const ICONS  = { fastest:Zap, alternative:Navigation, eco:Leaf };

export default function SmartRoutes() {
  const [origin, setOrigin]   = useState('');
  const [dest,   setDest]     = useState('');
  const [routes, setRoutes]   = useState(null);
  const [selId,  setSelId]    = useState(null);
  const [loading,setLoading]  = useState(false);

  const sel = routes?.find(r => r.id === selId) || routes?.[0];

  const search = (useDemo = false) => {
    const o = useDemo ? demoRoutes.origin      : origin;
    const d = useDemo ? demoRoutes.destination : dest;
    if (!o || !d) return;
    if (useDemo) { setOrigin(o); setDest(d); }
    setLoading(true);
    setTimeout(() => { setRoutes(demoRoutes.routes); setSelId(demoRoutes.routes[0].id); setLoading(false); }, 1000);
  };

  return (
    <AppLayout title="Smart Routes" subtitle="AI-powered routing">

      {/* Search inputs */}
      <div className="glass-card p-4 mb-4 space-y-3">
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-status-success" />
          <input className="input-field pl-8 text-sm" placeholder="From…" value={origin} onChange={e=>setOrigin(e.target.value)} />
        </div>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-status-critical" />
          <input className="input-field pl-8 text-sm" placeholder="To…" value={dest} onChange={e=>setDest(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => search(false)} disabled={loading||!origin||!dest}
            className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold">
            {loading ? <span className="w-4 h-4 border-2 border-bg-primary/30 border-t-bg-primary rounded-full animate-spin" />
                     : <><Search size={14} /> Search</>}
          </button>
          <button onClick={() => search(true)}
            className="btn-secondary px-4 rounded-xl text-sm font-semibold">Demo</button>
        </div>
      </div>

      {/* Demo notice */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-status-warning/10 border border-status-warning/25 mb-4 text-[11px] text-status-warning">
        <Info size={12} className="shrink-0" />
        Demo routes shown. Connect OSRM/Mapbox for live routing.
      </div>

      {!routes ? (
        <div className="glass-card p-10 text-center">
          <Navigation size={36} className="text-text-muted mx-auto mb-3" />
          <p className="text-sm font-semibold text-text-primary mb-1">Find your route</p>
          <p className="text-xs text-text-secondary mb-4">AI picks the fastest, least congested path</p>
          <button onClick={() => search(true)} className="btn-primary px-6 py-2.5 rounded-xl font-semibold">Try Demo Route</button>
        </div>
      ) : (
        <>
          {/* Map */}
          <div className="rounded-2xl overflow-hidden mb-4 border border-border-subtle" style={{ height:220 }}>
            <MapContainer center={[40.7128,-74.006]} zoom={10} className="w-full h-full" style={{ background:'#080D17' }} zoomControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {routes.map(r => (
                <Polyline key={r.id} positions={r.coords}
                  pathOptions={{ color:COLORS[r.type], weight:r.id===selId?5:3, opacity:r.id===selId?1:0.4, dashArray:r.id===selId?null:'8 6' }}>
                  <Popup><div style={{fontFamily:'Inter,sans-serif',fontSize:11}}><strong>{r.label}</strong><br/>{r.duration} · {r.distance}</div></Popup>
                </Polyline>
              ))}
              <CircleMarker center={routes[0].coords[0]} radius={7} pathOptions={{ color:'#22C55E',fillColor:'#22C55E',fillOpacity:1 }}><Popup>Origin</Popup></CircleMarker>
              <CircleMarker center={routes[0].coords[routes[0].coords.length-1]} radius={7} pathOptions={{ color:'#EF4444',fillColor:'#EF4444',fillOpacity:1 }}><Popup>Destination</Popup></CircleMarker>
            </MapContainer>
          </div>

          {/* Route options */}
          <div className="space-y-2.5 mb-4">
            {routes.map(r => {
              const Icon = ICONS[r.type];
              const isSel = r.id === selId;
              return (
                <motion.button key={r.id} initial={{ opacity:0, x:-12 }} animate={{ opacity:1, x:0 }}
                  onClick={() => setSelId(r.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${isSel ? 'border-2' : 'border border-border-subtle bg-bg-card'}`}
                  style={isSel ? { borderColor:COLORS[r.type], background:`${COLORS[r.type]}10` } : {}}>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:`${COLORS[r.type]}20` }}>
                        <Icon size={16} style={{ color:COLORS[r.type] }} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-primary">{r.label}</p>
                        <p className="text-[10px] text-text-muted">via {r.via.join(' · ')}</p>
                      </div>
                    </div>
                    {isSel && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color:COLORS[r.type], background:`${COLORS[r.type]}20` }}>Selected</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2.5">
                    {[['⏱',r.duration,'Time'],['📍',r.distance,'Distance'],['🚦',`${r.congestion}%`,'Congestion']].map(([icon,val,lbl]) => (
                      <div key={lbl} className="text-center p-2 rounded-xl bg-bg-secondary">
                        <p className="text-xs font-bold text-text-primary">{val}</p>
                        <p className="text-[9px] text-text-muted">{lbl}</p>
                      </div>
                    ))}
                  </div>
                  <CongestionBar value={r.congestion} size="sm" showLabel={false} />
                </motion.button>
              );
            })}
          </div>

          {/* Road conditions for selected route */}
          {sel && (
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Road Conditions</h3>
              <div className="space-y-2.5">
                {sel.segments.map((seg,i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-text-secondary font-medium">{seg.name}</span>
                      <span className="text-text-muted">{seg.speed} km/h</span>
                    </div>
                    <CongestionBar value={seg.congestion} size="sm" showLabel={false} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
