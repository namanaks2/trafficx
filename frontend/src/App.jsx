import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// App pages
import Dashboard from './pages/dashboard/Dashboard';
import TrafficMap from './pages/map/TrafficMap';
import Prediction from './pages/prediction/Prediction';
import Network from './pages/network/Network';
import Incidents from './pages/incidents/Incidents';
import SmartRoutes from './pages/routes/SmartRoutes';
import Analytics from './pages/analytics/Analytics';
import DataSources from './pages/datasources/DataSources';
import Notifications from './pages/notifications/Notifications';
import Settings from './pages/settings/Settings';

function ProtectedRoute({ children, permission }) {
  const { user, loading, hasPermission } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
        <p className="text-text-muted text-sm">Loading TrafficX...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !hasPermission(permission)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />

      <Route path="/dashboard" element={<ProtectedRoute permission="dashboard"><Dashboard /></ProtectedRoute>} />
      <Route path="/map" element={<ProtectedRoute permission="map"><TrafficMap /></ProtectedRoute>} />
      <Route path="/prediction" element={<ProtectedRoute permission="prediction"><Prediction /></ProtectedRoute>} />
      <Route path="/network" element={<ProtectedRoute permission="network"><Network /></ProtectedRoute>} />
      <Route path="/incidents" element={<ProtectedRoute permission="incidents"><Incidents /></ProtectedRoute>} />
      <Route path="/routes" element={<ProtectedRoute permission="routes"><SmartRoutes /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute permission="analytics"><Analytics /></ProtectedRoute>} />
      <Route path="/datasources" element={<ProtectedRoute permission="datasources"><DataSources /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute permission="notifications"><Notifications /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute permission="settings"><Settings /></ProtectedRoute>} />

      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
