import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, Marker, Circle, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, X, AlertTriangle, Activity, LocateFixed, Wifi, WifiOff, ChevronDown, ChevronUp } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatusBadge from '../../components/ui/StatusBadge';
import CongestionBar from '../../components/ui/CongestionBar';
import { useApp } from '../../context/AppContext';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const congestionColor = c => c < 30 ? '#22C55E' : c < 55 ? '#EAB308' : c < 75 ? '#F59E0B' : '#EF4444';

const userIcon = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#38BDF8;border:3px solid #fff;box-shadow:0 0 12px rgba(56,189,248,0.8);"></div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
});

function FlyTo({ pos, zoom }) {
  const map = useMap();
  useEffect(() => { if (pos) map.flyTo(pos, zoom || map.getZoom(), { duration: 1.2 }); }, [pos]);
  return null;
}

function NodePopup({ node }) {
  return (
    <div style={{ minWidth: 180, fontFamily: 'Inter,sans-serif' }}>
      <strong style={{ color: '#F8FAFC', fontSize: 13 }}>{node.name}</strong>
      <div style={{ marginTop: 8, fontSize: 11, color: '#94A3B8' }}>
        <div>Vehicles: <strong style={{ color: '#F8FAFC' }}>{node.vehicleCount}</strong></div>
        <div>Speed: <strong style={{ color: '#F8FAFC' }}>{node.avgSpeed} km/h</strong></div>
        <div style={{ marginTop: 6 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
            <span>Congestion</span>
            <strong style={{ color: congestionColor(node.congestion) }}>{node.congestion}%</strong>
          </div>
          <div style={{ background:'#1E293B', borderRadius:999, height:5 }}>
            <div style={{ width:`${node.congestion}%`, height:5, borderRadius:999, background: congestionColor(node.congestion) }} />
          </div>
        </div>
      </div>
    </div>
  );
}

const off = (lat, lng, dLat, dLng) => [lat + dLat, lng + dLng];
function buildNodes(lat, lng) {
  return [
    { id:'n1', name:'Junction Alpha',   nodeId:'TXN-001', zone:'Central', status:'active',  vehicleCount:342, avgSpeed:18, congestion:78, lat:off(lat,lng,0.003,0.004)[0], lng:off(lat,lng,0.003,0.004)[1] },
    { id:'n2', name:'Highway North',    nodeId:'TXN-002', zone:'North',   status:'active',  vehicleCount:891, avgSpeed:55, congestion:32, lat:off(lat,lng,0.012,-0.002)[0],lng:off(lat,lng,0.012,-0.002)[1] },
    { id:'n3', name:'Bridge Crossing',  nodeId:'TXN-003', zone:'South',   status:'active',  vehicleCount:467, avgSpeed:28, congestion:65, lat:off(lat,lng,-0.009,0.006)[0],lng:off(lat,lng,-0.009,0.006)[1] },
    { id:'n4', name:'Airport Express',  nodeId:'TXN-004', zone:'East',    status:'active',  vehicleCount:623, avgSpeed:42, congestion:45, lat:off(lat,lng,-0.004,-0.014)[0],lng:off(lat,lng,-0.004,-0.014)[1] },
    { id:'n5', name:'West Boulevard',   nodeId:'TXN-005', zone:'West',    status:'warning', vehicleCount:289, avgSpeed:12, congestion:88, lat:off(lat,lng,0.006,-0.011)[0], lng:off(lat,lng,0.006,-0.011)[1] },
    { id:'n6', name:'Financial Dist',   nodeId:'TXN-006', zone:'Central', status:'active',  vehicleCount:512, avgSpeed:15, congestion:82, lat:off(lat,lng,0.001,-0.005)[0], lng:off(lat,lng,0.001,-0.005)[1] },
  ];
}
function buildSegs(lat, lng) {
  return [
    { id:'s1', name:'Main St',    congestion:78, speed:18, coords:[off(lat,lng,0.001,0.001),off(lat,lng,0.003,0.004)] },
    { id:'s2', name:'Highway N',  congestion:32, speed:55, coords:[off(lat,lng,0.006,0.000),off(lat,lng,0.012,-0.002)] },
    { id:'s3', name:'Bridge Rd',  congestion:65, speed:28, coords:[off(lat,lng,-0.004,0.003),off(lat,lng,-0.009,0.006)] },
    { id:'s4', name:'West Ave',   congestion:88, speed:12, coords:[off(lat,lng,0.003,-0.005),off(lat,lng,0.006,-0.011)] },
  ];
}

export default function TrafficMap() {
  const { incidents: liveInc } = useApp();
  const [userPos,   setUserPos]   = useState(null);
  const [geoStatus, setGeoStatus] = useState('idle');
  const [geoError,  setGeoError]  = useState('');
  const [tracking,  setTracking]  = useState(false);
  const [flyTarget, setFlyTarget] = useState(null);
  const [filters,   setFilters]   = useState({ nodes:true, segments:true, incidents:true });
  const [showPanel, setShowPanel] = useState(false);
  const watchRef = useRef(null);

  const DEFAULT = [20.5937, 78.9629];
  const center  = userPos ? [userPos.lat, userPos.lng] : DEFAULT;
  const nodes   = buildNodes(center[0], center[1]);
  const segs    = buildSegs(center[0],  center[1]);

  // Live node updates
  const [liveNodes, setLiveNodes] = useState(nodes);
  useEffect(() => { setLiveNodes(buildNodes(center[0], center[1])); }, [userPos]);
  useEffect(() => {
    const id = setInterval(() => setLiveNodes(p => p.map(n =>
      n.status === 'offline' ? n : { ...n,
        vehicleCount: Math.max(10, n.vehicleCount + Math.floor(Math.random()*20-10)),
        avgSpeed: Math.max(5, Math.min(100, n.avgSpeed + Math.floor(Math.random()*4-2))),
        congestion: Math.max(5, Math.min(99, n.congestion + Math.floor(Math.random()*6-3))),
      })), 5000);
    return () => clearInterval(id);
  }, []);

  const stopTracking = useCallback(() => {
    if (watchRef.current) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; }
    setTracking(false);
  }, []);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) { setGeoError('Geolocation not supported'); return; }
    setGeoStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
        setGeoStatus('active');
        setFlyTarget({ pos:[pos.coords.latitude,pos.coords.longitude], zoom:15, ts:Date.now() });
      },
      err => { setGeoStatus('error'); setGeoError(err.message); },
      { enableHighAccuracy:true, timeout:12000 }
    );
  }, []);

  const startTracking = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    stopTracking();
    setTracking(true);
    setGeoStatus('requesting');
    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        setUserPos({ lat:pos.coords.latitude, lng:pos.coords.longitude, acc:pos.coords.accuracy });
        setGeoStatus('active');
        setFlyTarget({ pos:[pos.coords.latitude,pos.coords.longitude], zoom:15, ts:Date.now() });
      },
      err => { setGeoStatus('error'); stopTracking(); },
      { enableHighAccuracy:true }
    );
  }, [stopTracking]);

  useEffect(() => () => stopTracking(), []);

  const activeInc = liveInc.filter(i => i.status !== 'resolved').slice(0, 5);
  const online    = liveNodes.filter(n => n.status !== 'offline');
  const avgCong   = online.length ? Math.round(online.reduce((a,b) => a+b.congestion,0)/online.length) : 0;

  return (
    <AppLayout title="Live Traffic Map" subtitle="Real-time monitoring">
      <div className="relative -mx-3 -mt-3" style={{ height: 'calc(100vh - 120px)', minHeight: 400 }}>

        {/* Map fills full area */}
        <MapContainer center={center} zoom={userPos ? 14 : 5} className="w-full h-full"
          style={{ background:'#080D17' }} zoomControl={false}>
          <ZoomControl position="bottomright" />
          {flyTarget && <FlyTo key={flyTarget.ts} pos={flyTarget.pos} zoom={flyTarget.zoom} />}
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' maxZoom={19} />

          {/* User location */}
          {userPos && (
            <>
              <Circle center={[userPos.lat,userPos.lng]} radius={userPos.acc}
                pathOptions={{ color:'#38BDF8', fillColor:'#38BDF8', fillOpacity:0.08, weight:1, dashArray:'4 4' }} />
              <Marker position={[userPos.lat,userPos.lng]} icon={userIcon}>
                <Popup><div style={{fontFamily:'Inter,sans-serif',fontSize:11,color:'#94A3B8'}}>
                  <strong style={{color:'#F8FAFC'}}>📍 Your Location</strong><br/>
                  {userPos.lat.toFixed(5)}, {userPos.lng.toFixed(5)}<br/>
                  ±{Math.round(userPos.acc)}m accuracy
                </div></Popup>
              </Marker>
            </>
          )}

          {/* Road segments */}
          {filters.segments && segs.map(s => (
            <Polyline key={s.id} positions={s.coords}
              pathOptions={{ color:congestionColor(s.congestion), weight:5, opacity:0.85 }}>
              <Popup><div style={{fontFamily:'Inter,sans-serif',fontSize:11}}>
                <strong style={{color:'#F8FAFC'}}>{s.name}</strong><br/>
                <span style={{color:congestionColor(s.congestion)}}>{s.congestion}% congestion</span>
              </div></Popup>
            </Polyline>
          ))}

          {/* Nodes */}
          {filters.nodes && liveNodes.map(n => (
            <CircleMarker key={n.id} center={[n.lat,n.lng]}
              radius={n.status==='offline'?5:10}
              pathOptions={{ color:n.status==='offline'?'#475569':congestionColor(n.congestion), fillColor:n.status==='offline'?'#1E293B':congestionColor(n.congestion), fillOpacity:0.9, weight:2 }}>
              <Popup><NodePopup node={n} /></Popup>
            </CircleMarker>
          ))}

          {/* Incidents */}
          {filters.incidents && activeInc.map(inc => (
            <CircleMarker key={inc.id} center={[inc.lat,inc.lng]} radius={9}
              pathOptions={{ color:'#EF4444', fillColor:'#EF4444', fillOpacity:0.9, weight:2 }}>
              <Popup><div style={{fontFamily:'Inter,sans-serif',fontSize:11}}>
                <strong style={{color:'#EF4444'}}>⚠ {inc.title}</strong><br/>
                <span style={{color:'#94A3B8'}}>{inc.location}</span>
              </div></Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* ── Top overlay: locate button ── */}
        <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
          <button onClick={locate} disabled={geoStatus==='requesting'}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${
              geoStatus==='active' ? 'bg-status-success/90 text-white' :
              geoStatus==='requesting' ? 'bg-status-warning/90 text-white' :
              'bg-bg-card/95 text-accent-blue border border-accent-blue/40'
            }`}
            style={{ backdropFilter:'blur(8px)' }}>
            {geoStatus==='requesting'
              ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <LocateFixed size={14} />}
            {geoStatus==='active' ? 'Located' : geoStatus==='requesting' ? 'Locating…' : 'Locate Me'}
          </button>
          {geoStatus==='active' && (
            <button onClick={tracking ? stopTracking : startTracking}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-lg ${
                tracking ? 'bg-accent-blue/90 text-white' : 'bg-bg-card/95 text-text-secondary border border-border-default'
              }`} style={{ backdropFilter:'blur(8px)' }}>
              {tracking ? <Wifi size={12} className="animate-pulse" /> : <WifiOff size={12} />}
              {tracking ? 'Tracking' : 'Track'}
            </button>
          )}
          {geoError && <div className="bg-status-critical/90 text-white px-3 py-2 rounded-xl text-[10px] max-w-[160px]" style={{ backdropFilter:'blur(8px)' }}>{geoError}</div>}
        </div>

        {/* ── Top overlay: layer filters ── */}
        <div className="absolute top-3 right-3 z-[1000] flex gap-1.5">
          {[['nodes','Nodes'],['segments','Roads'],['incidents','Alerts']].map(([k,l]) => (
            <button key={k} onClick={() => setFilters(p => ({...p,[k]:!p[k]}))}
              className={`px-2.5 py-1.5 rounded-xl text-[10px] font-semibold shadow-lg transition-all ${
                filters[k] ? 'bg-accent-blue text-bg-primary' : 'bg-bg-card/90 text-text-muted border border-border-subtle'
              }`} style={{ backdropFilter:'blur(8px)' }}>
              {l}
            </button>
          ))}
        </div>

        {/* ── Legend ── */}
        <div className="absolute bottom-4 left-3 z-[1000] rounded-xl px-3 py-2 shadow-lg"
          style={{ background:'rgba(14,21,36,0.95)', backdropFilter:'blur(8px)', border:'1px solid rgba(30,45,69,0.6)' }}>
          <div className="text-[9px] text-text-muted font-bold uppercase tracking-widest mb-1.5">Traffic Level</div>
          {[['#22C55E','Free'],['#EAB308','Moderate'],['#F59E0B','Heavy'],['#EF4444','Severe']].map(([c,l]) => (
            <div key={l} className="flex items-center gap-1.5 text-[10px] text-text-secondary">
              <div className="w-2.5 h-1.5 rounded-full" style={{ background:c }} />{l}
            </div>
          ))}
        </div>

        {/* ── Bottom pull-up panel ── */}
        <div className="absolute bottom-0 left-0 right-0 z-[1000]">
          {/* Peek bar */}
          <button onClick={() => setShowPanel(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-t-2xl"
            style={{ background:'rgba(14,21,36,0.97)', backdropFilter:'blur(16px)', borderTop:'1px solid rgba(30,45,69,0.6)' }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                <Activity size={13} className="text-status-success" />
                {liveNodes.filter(n=>n.status!=='offline').length}/{liveNodes.length} nodes online
              </div>
              <div className="text-xs font-bold" style={{ color: avgCong>70?'#EF4444':avgCong>45?'#F59E0B':'#22C55E' }}>
                {avgCong}% avg congestion
              </div>
            </div>
            {showPanel ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronUp size={16} className="text-text-muted" />}
          </button>

          {/* Expanded panel */}
          <AnimatePresence>
            {showPanel && (
              <motion.div initial={{ height:0 }} animate={{ height:'auto' }} exit={{ height:0 }}
                className="overflow-hidden"
                style={{ background:'rgba(14,21,36,0.97)', backdropFilter:'blur(16px)' }}>
                <div className="px-4 pb-4 pt-2 space-y-2 max-h-56 overflow-y-auto">
                  {liveNodes.map(n => (
                    <div key={n.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border-subtle bg-bg-card">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: congestionColor(n.congestion) }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-text-primary truncate">{n.name}</div>
                        <div className="text-[10px] text-text-muted">{n.vehicleCount} vehicles · {n.avgSpeed} km/h</div>
                      </div>
                      <div className="text-xs font-bold shrink-0" style={{ color: congestionColor(n.congestion) }}>{n.congestion}%</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User coordinates chip */}
        {userPos && (
          <div className="absolute bottom-16 left-3 z-[1000] rounded-xl px-2.5 py-1.5 text-[10px]"
            style={{ background:'rgba(14,21,36,0.9)', backdropFilter:'blur(8px)', border:'1px solid rgba(34,197,94,0.3)' }}>
            <div className="flex items-center gap-1 text-status-success font-semibold">
              <div className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
              {tracking ? 'Live Tracking' : 'Located'}
            </div>
            <div className="font-mono text-text-muted">{userPos.lat.toFixed(4)}, {userPos.lng.toFixed(4)}</div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
