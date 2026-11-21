// TrafficX Demo Data — All realistic synthetic data for presentation mode
// This data powers the application when no live backend is configured.

export const DEMO_MODE = true;

// ─── Monitoring Locations ────────────────────────────────────────────────────
export const monitoringLocations = [
  { id: 'node-001', name: 'Downtown Junction', lat: 40.7128, lng: -74.006, zone: 'Central', status: 'active', vehicleCount: 342, avgSpeed: 18, congestion: 78, lastUpdate: new Date().toISOString(), nodeId: 'TXN-001' },
  { id: 'node-002', name: 'Highway I-95 North', lat: 40.7580, lng: -73.9855, zone: 'North', status: 'active', vehicleCount: 891, avgSpeed: 55, congestion: 32, lastUpdate: new Date().toISOString(), nodeId: 'TXN-002' },
  { id: 'node-003', name: 'Bridge Crossing Alpha', lat: 40.6892, lng: -74.0445, zone: 'South', status: 'active', vehicleCount: 467, avgSpeed: 28, congestion: 65, lastUpdate: new Date().toISOString(), nodeId: 'TXN-003' },
  { id: 'node-004', name: 'Airport Expressway', lat: 40.6413, lng: -73.7781, zone: 'East', status: 'active', vehicleCount: 623, avgSpeed: 42, congestion: 45, lastUpdate: new Date().toISOString(), nodeId: 'TXN-004' },
  { id: 'node-005', name: 'Westside Boulevard', lat: 40.7549, lng: -74.0025, zone: 'West', status: 'warning', vehicleCount: 289, avgSpeed: 12, congestion: 88, lastUpdate: new Date().toISOString(), nodeId: 'TXN-005' },
  { id: 'node-006', name: 'Central Park Loop', lat: 40.7851, lng: -73.9683, zone: 'North', status: 'active', vehicleCount: 156, avgSpeed: 25, congestion: 22, lastUpdate: new Date().toISOString(), nodeId: 'TXN-006' },
  { id: 'node-007', name: 'Financial District', lat: 40.7074, lng: -74.0113, zone: 'Central', status: 'active', vehicleCount: 512, avgSpeed: 15, congestion: 82, lastUpdate: new Date().toISOString(), nodeId: 'TXN-007' },
  { id: 'node-008', name: 'Brooklyn Bridge Rd', lat: 40.7061, lng: -73.9969, zone: 'South', status: 'offline', vehicleCount: 0, avgSpeed: 0, congestion: 0, lastUpdate: new Date(Date.now() - 3600000).toISOString(), nodeId: 'TXN-008' },
  { id: 'node-009', name: 'Midtown Tunnel Approach', lat: 40.7447, lng: -73.9700, zone: 'Central', status: 'active', vehicleCount: 734, avgSpeed: 22, congestion: 71, lastUpdate: new Date().toISOString(), nodeId: 'TXN-009' },
  { id: 'node-010', name: 'Queens Boulevard', lat: 40.7282, lng: -73.7949, zone: 'East', status: 'active', vehicleCount: 398, avgSpeed: 35, congestion: 48, lastUpdate: new Date().toISOString(), nodeId: 'TXN-010' },
];

// ─── Road Segments (for polylines) ───────────────────────────────────────────
export const roadSegments = [
  { id: 'seg-001', name: 'Main St Corridor', coords: [[40.7128, -74.006], [40.7200, -74.002]], congestion: 78, speed: 18 },
  { id: 'seg-002', name: 'Highway I-95', coords: [[40.7580, -73.9855], [40.7650, -73.9800]], congestion: 32, speed: 55 },
  { id: 'seg-003', name: 'Bridge Rd', coords: [[40.6892, -74.0445], [40.6950, -74.040]], congestion: 65, speed: 28 },
  { id: 'seg-004', name: 'West Ave', coords: [[40.7549, -74.0025], [40.7600, -73.998]], congestion: 88, speed: 12 },
  { id: 'seg-005', name: 'Financial Blvd', coords: [[40.7074, -74.0113], [40.7120, -74.008]], congestion: 82, speed: 15 },
];

// ─── Active Incidents ────────────────────────────────────────────────────────
export const incidents = [
  {
    id: 'INC-2024-001',
    type: 'accident',
    title: 'Multi-vehicle collision',
    description: 'Two-vehicle collision blocking left lane. Emergency services on scene.',
    location: 'Downtown Junction, Main St & 5th Ave',
    lat: 40.7128,
    lng: -74.006,
    severity: 'critical',
    status: 'responding',
    reportedBy: 'TXN-001',
    reportedAt: new Date(Date.now() - 25 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60000).toISOString(),
    assignedTo: 'Traffic Authority Unit 7',
    affectedLanes: 2,
    estimatedClearance: '45 minutes',
    verifiedBy: 'Officer Martinez',
  },
  {
    id: 'INC-2024-002',
    type: 'congestion',
    title: 'Severe traffic jam',
    description: 'Unexpected congestion due to lane reduction for utility works.',
    location: 'Westside Boulevard near Exit 12',
    lat: 40.7549,
    lng: -74.0025,
    severity: 'high',
    status: 'verified',
    reportedBy: 'TXN-005',
    reportedAt: new Date(Date.now() - 65 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 60000).toISOString(),
    assignedTo: null,
    affectedLanes: 1,
    estimatedClearance: '2 hours',
    verifiedBy: 'System Auto-Verify',
  },
  {
    id: 'INC-2024-003',
    type: 'construction',
    title: 'Road construction — lane closure',
    description: 'Scheduled maintenance work. Right lane closed for 500m.',
    location: 'Financial District, Broadway',
    lat: 40.7074,
    lng: -74.0113,
    severity: 'medium',
    status: 'verified',
    reportedBy: 'Community Report',
    reportedAt: new Date(Date.now() - 120 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 90 * 60000).toISOString(),
    assignedTo: 'City Works Dept.',
    affectedLanes: 1,
    estimatedClearance: '8 hours',
    verifiedBy: null,
  },
  {
    id: 'INC-2024-004',
    type: 'breakdown',
    title: 'Vehicle breakdown on shoulder',
    description: 'Truck breakdown on highway shoulder causing rubbernecking slowdown.',
    location: 'Highway I-95, Mile Marker 24',
    lat: 40.7580,
    lng: -73.9855,
    severity: 'low',
    status: 'reported',
    reportedBy: 'TXN-002',
    reportedAt: new Date(Date.now() - 8 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 60000).toISOString(),
    assignedTo: null,
    affectedLanes: 0,
    estimatedClearance: '30 minutes',
    verifiedBy: null,
  },
  {
    id: 'INC-2024-005',
    type: 'closure',
    title: 'Full road closure — event',
    description: 'Temporary closure for city marathon. Resumes at 14:00.',
    location: 'Central Park Loop, E 72nd St',
    lat: 40.7851,
    lng: -73.9683,
    severity: 'medium',
    status: 'resolved',
    reportedBy: 'Admin',
    reportedAt: new Date(Date.now() - 240 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60000).toISOString(),
    assignedTo: 'Event Management',
    affectedLanes: 2,
    estimatedClearance: 'Resolved',
    verifiedBy: 'Admin System',
  },
];

// ─── Hourly Traffic Data (last 24h) ──────────────────────────────────────────
export const hourlyTrafficData = Array.from({ length: 24 }, (_, i) => {
  const hour = i;
  const isRush = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  const isNight = hour < 5 || hour > 22;
  const base = isNight ? 120 : isRush ? 780 : 420;
  const noise = Math.floor(Math.random() * 80 - 40);
  return {
    hour: `${hour.toString().padStart(2, '0')}:00`,
    vehicles: Math.max(50, base + noise),
    speed: isNight ? 65 : isRush ? 22 : 45,
    congestion: isNight ? 10 : isRush ? 75 : 40,
    incidents: isRush ? Math.floor(Math.random() * 3) : 0,
  };
});

// ─── Weekly Data ──────────────────────────────────────────────────────────────
export const weeklyData = [
  { day: 'Mon', vehicles: 42350, avgSpeed: 32, incidents: 8, congestionIndex: 68 },
  { day: 'Tue', vehicles: 44120, avgSpeed: 30, incidents: 11, congestionIndex: 72 },
  { day: 'Wed', vehicles: 43800, avgSpeed: 31, incidents: 9, congestionIndex: 70 },
  { day: 'Thu', vehicles: 45200, avgSpeed: 29, incidents: 14, congestionIndex: 75 },
  { day: 'Fri', vehicles: 51800, avgSpeed: 24, incidents: 18, congestionIndex: 84 },
  { day: 'Sat', vehicles: 38900, avgSpeed: 42, incidents: 5, congestionIndex: 42 },
  { day: 'Sun', vehicles: 32100, avgSpeed: 48, incidents: 3, congestionIndex: 28 },
];

// ─── Network Nodes (Decentralized) ───────────────────────────────────────────
export const networkNodes = [
  { id: 'P2P-NODE-001', name: 'Alpha Node', region: 'US-East', status: 'online', peers: 4, latency: 12, recordsProcessed: 15847, uptime: 99.8, lastSync: new Date().toISOString(), x: 200, y: 150 },
  { id: 'P2P-NODE-002', name: 'Beta Node', region: 'US-West', status: 'online', peers: 3, latency: 28, recordsProcessed: 14230, uptime: 99.2, lastSync: new Date().toISOString(), x: 500, y: 100 },
  { id: 'P2P-NODE-003', name: 'Gamma Node', region: 'EU-Central', status: 'online', peers: 5, latency: 45, recordsProcessed: 12980, uptime: 97.5, lastSync: new Date().toISOString(), x: 700, y: 250 },
  { id: 'P2P-NODE-004', name: 'Delta Node', region: 'Asia-East', status: 'syncing', peers: 2, latency: 85, recordsProcessed: 9847, uptime: 94.1, lastSync: new Date(Date.now() - 120000).toISOString(), x: 600, y: 400 },
  { id: 'P2P-NODE-005', name: 'Epsilon Node', region: 'US-South', status: 'online', peers: 4, latency: 18, recordsProcessed: 13420, uptime: 99.5, lastSync: new Date().toISOString(), x: 300, y: 380 },
  { id: 'P2P-NODE-006', name: 'Zeta Node', region: 'EU-West', status: 'offline', peers: 0, latency: 0, recordsProcessed: 8120, uptime: 0, lastSync: new Date(Date.now() - 7200000).toISOString(), x: 100, y: 300 },
];

// Node connections for topology visualization
export const nodeConnections = [
  { from: 'P2P-NODE-001', to: 'P2P-NODE-002' },
  { from: 'P2P-NODE-001', to: 'P2P-NODE-005' },
  { from: 'P2P-NODE-002', to: 'P2P-NODE-003' },
  { from: 'P2P-NODE-003', to: 'P2P-NODE-004' },
  { from: 'P2P-NODE-004', to: 'P2P-NODE-005' },
  { from: 'P2P-NODE-001', to: 'P2P-NODE-003' },
  { from: 'P2P-NODE-002', to: 'P2P-NODE-005' },
];

// ─── Distributed Ledger ───────────────────────────────────────────────────────
export const ledgerEntries = [
  { txId: 'TX-' + generateHash(8), nodeId: 'P2P-NODE-001', timestamp: new Date(Date.now() - 2000).toISOString(), location: 'Downtown Junction', observation: 'Vehicle count: 342, Speed: 18 km/h', prevHash: '000000a1b2c3', hash: 'a4f8e2d1c9b7', verified: true, peers: 4 },
  { txId: 'TX-' + generateHash(8), nodeId: 'P2P-NODE-002', timestamp: new Date(Date.now() - 8000).toISOString(), location: 'Highway I-95 North', observation: 'Vehicle count: 891, Speed: 55 km/h', prevHash: 'a4f8e2d1c9b7', hash: 'b7c9f1e3a2d8', verified: true, peers: 3 },
  { txId: 'TX-' + generateHash(8), nodeId: 'P2P-NODE-003', timestamp: new Date(Date.now() - 15000).toISOString(), location: 'Bridge Crossing Alpha', observation: 'Vehicle count: 467, Speed: 28 km/h', prevHash: 'b7c9f1e3a2d8', hash: 'c2a7d4f9e1b3', verified: true, peers: 5 },
  { txId: 'TX-' + generateHash(8), nodeId: 'P2P-NODE-005', timestamp: new Date(Date.now() - 25000).toISOString(), location: 'Westside Boulevard', observation: 'CONGESTION ALERT: Speed: 12 km/h', prevHash: 'c2a7d4f9e1b3', hash: 'd9e3b1f7c4a2', verified: true, peers: 4 },
  { txId: 'TX-' + generateHash(8), nodeId: 'P2P-NODE-001', timestamp: new Date(Date.now() - 40000).toISOString(), location: 'Financial District', observation: 'Incident reported: Multi-vehicle collision', prevHash: 'd9e3b1f7c4a2', hash: 'e1f4a8c2b9d7', verified: false, peers: 2 },
  { txId: 'TX-' + generateHash(8), nodeId: 'P2P-NODE-004', timestamp: new Date(Date.now() - 60000).toISOString(), location: 'Airport Expressway', observation: 'Vehicle count: 623, Speed: 42 km/h', prevHash: 'e1f4a8c2b9d7', hash: 'f7b2e9d4c1a8', verified: true, peers: 2 },
];

function generateHash(len) {
  const chars = '0123456789abcdef';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── ML Predictions ───────────────────────────────────────────────────────────
export const predictions = {
  current: 71,
  next15: 78,
  next30: 82,
  next60: 68,
  confidence: 84,
  model: 'GradientBoostingRegressor',
  isSimulated: true,
  riskLocations: [
    { name: 'Downtown Junction', risk: 'critical', predictedCongestion: 92, timeframe: '15 min' },
    { name: 'Westside Boulevard', risk: 'high', predictedCongestion: 85, timeframe: '30 min' },
    { name: 'Financial District', risk: 'high', predictedCongestion: 80, timeframe: '15 min' },
    { name: 'Midtown Tunnel', risk: 'medium', predictedCongestion: 68, timeframe: '60 min' },
  ],
  trend: Array.from({ length: 12 }, (_, i) => ({
    time: `${i * 5}m`,
    actual: i < 6 ? 65 + i * 2 + Math.floor(Math.random() * 5) : null,
    predicted: 65 + i * 2.5 + Math.floor(Math.random() * 3),
  })),
  metrics: { mae: 4.2, rmse: 5.8, r2: 0.89, accuracy: '84.3%' },
};

// ─── KPI Summary ─────────────────────────────────────────────────────────────
export const kpiData = {
  activeNodes: { value: 9, total: 10, trend: +2.1 },
  vehiclesMonitored: { value: 4412, trend: +8.4 },
  congestionIndex: { value: 68, trend: +12.3 },
  activeIncidents: { value: 4, trend: -1 },
  avgSpeed: { value: 32, unit: 'km/h', trend: -5.2 },
  networkHealth: { value: 97.3, trend: +0.8 },
};

// ─── Data Sources ─────────────────────────────────────────────────────────────
export const dataSources = [
  { id: 'src-001', name: 'Traffic Sensor Array Alpha', type: 'sensor', status: 'active', lastSync: new Date().toISOString(), quality: 98, records: 1540230, location: 'Downtown Zone' },
  { id: 'src-002', name: 'Highway Camera Network', type: 'camera', status: 'active', lastSync: new Date().toISOString(), quality: 94, records: 820450, location: 'Highway System' },
  { id: 'src-003', name: 'Community Reports API', type: 'community', status: 'active', lastSync: new Date(Date.now() - 5 * 60000).toISOString(), quality: 76, records: 42810, location: 'City-wide' },
  { id: 'src-004', name: 'Historical Dataset v2', type: 'dataset', status: 'active', lastSync: new Date(Date.now() - 86400000).toISOString(), quality: 100, records: 5200000, location: 'Archive' },
  { id: 'src-005', name: 'GPS Fleet Tracker', type: 'gps', status: 'warning', lastSync: new Date(Date.now() - 15 * 60000).toISOString(), quality: 68, records: 342100, location: 'City Fleet' },
  { id: 'src-006', name: 'Weather Integration API', type: 'api', status: 'active', lastSync: new Date().toISOString(), quality: 99, records: 125000, location: 'Regional' },
];

// ─── Notifications ───────────────────────────────────────────────────────────
export const notificationsData = [
  { id: 'ntf-001', type: 'critical', title: 'Severe Congestion Alert', message: 'Westside Boulevard congestion index reached 88%. Immediate action recommended.', time: new Date(Date.now() - 5 * 60000).toISOString(), read: false, link: '/incidents' },
  { id: 'ntf-002', type: 'warning', title: 'New Incident Reported', message: 'Multi-vehicle collision at Downtown Junction. Emergency services dispatched.', time: new Date(Date.now() - 25 * 60000).toISOString(), read: false, link: '/incidents' },
  { id: 'ntf-003', type: 'info', title: 'Node Zeta Offline', message: 'P2P-NODE-006 (Zeta Node) has gone offline. Network integrity at 97.3%.', time: new Date(Date.now() - 120 * 60000).toISOString(), read: false, link: '/network' },
  { id: 'ntf-004', type: 'success', title: 'Incident Resolved', message: 'Central Park Loop road closure has been resolved. Traffic flowing normally.', time: new Date(Date.now() - 30 * 60000).toISOString(), read: true, link: '/incidents' },
  { id: 'ntf-005', type: 'warning', title: 'High Congestion Predicted', message: 'AI model predicts 82% congestion at Financial District in next 30 minutes.', time: new Date(Date.now() - 10 * 60000).toISOString(), read: false, link: '/prediction' },
  { id: 'ntf-006', type: 'info', title: 'Network Sync Complete', message: 'All online nodes synchronized. 15,847 new records verified.', time: new Date(Date.now() - 180 * 60000).toISOString(), read: true, link: '/network' },
];

// ─── Route Options ─────────────────────────────────────────────────────────────
export const demoRoutes = {
  origin: 'Connaught Place, New Delhi',
  destination: 'Indira Gandhi International Airport',
  routes: [
    {
      id: 'route-fastest',
      label: 'Fastest Route',
      type: 'fastest',
      distance: '12.4 km',
      duration: '24 min',
      congestion: 42,
      coords: [[28.6315,77.2167], [28.6100,77.2050], [28.5890,77.1900], [28.5520,77.1450], [28.5562,77.1000]],
      via: ['NH 48', 'Delhi-Gurugram Expressway', 'IGI Airport'],
      segments: [
        { name: 'Sardar Patel Marg', congestion: 55, speed: 25 },
        { name: 'NH 48', congestion: 38, speed: 42 },
        { name: 'Airport Expressway', congestion: 20, speed: 65 },
      ],
    },
    {
      id: 'route-alt',
      label: 'Alternative Route',
      type: 'alternative',
      distance: '14.8 km',
      duration: '31 min',
      congestion: 28,
      coords: [[28.6315,77.2167], [28.6350,77.2300], [28.6020,77.1800], [28.5740,77.1300], [28.5562,77.1000]],
      via: ['Ring Road', 'Rao Tula Ram Marg', 'IGI Airport'],
      segments: [
        { name: 'Ring Road', congestion: 20, speed: 60 },
        { name: 'Rao Tula Ram Marg', congestion: 35, speed: 45 },
        { name: 'Airport Road', congestion: 25, speed: 55 },
      ],
    },
    {
      id: 'route-least-congestion',
      label: 'Least Congestion',
      type: 'eco',
      distance: '16.2 km',
      duration: '35 min',
      congestion: 18,
      coords: [[28.6315,77.2167], [28.6200,77.2050], [28.5900,77.1600], [28.5700,77.1200], [28.5562,77.1000]],
      via: ['Arterial Road', 'Dwarka Expressway', 'IGI Airport'],
      segments: [
        { name: 'Arterial Road', congestion: 22, speed: 40 },
        { name: 'Dwarka Link Road', congestion: 15, speed: 50 },
        { name: 'Airport Link', congestion: 12, speed: 70 },
      ],
    },
  ],
};

// ─── Users (demo) ─────────────────────────────────────────────────────────────
export const demoUsers = [
  { id: 'usr-001', name: 'Alex Morgan', email: 'admin@trafficx.io', role: 'administrator', avatar: null, lastLogin: new Date().toISOString() },
  { id: 'usr-002', name: 'Sarah Chen', email: 'authority@trafficx.io', role: 'traffic_authority', avatar: null, lastLogin: new Date().toISOString() },
  { id: 'usr-003', name: 'James Wilson', email: 'analyst@trafficx.io', role: 'traffic_analyst', avatar: null, lastLogin: new Date().toISOString() },
];

