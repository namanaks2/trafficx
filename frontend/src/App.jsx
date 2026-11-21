import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import MobileFrame from './components/ui/MobileFrame';

const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const TrafficMap = lazy(() => import('./pages/map/TrafficMap'));
const Prediction = lazy(() => import('./pages/prediction/Prediction'));
const Network = lazy(() => import('./pages/network/Network'));
const Incidents = lazy(() => import('./pages/incidents/Incidents'));
const SmartRoutes = lazy(() => import('./pages/routes/SmartRoutes'));
const Analytics = lazy(() => import('./pages/analytics/Analytics'));
const DataSources = lazy(() => import('./pages/datasources/DataSources'));
const Notifications = lazy(() => import('./pages/notifications/Notifications'));
const Settings = lazy(() => import('./pages/settings/Settings'));
const SystemHealth = lazy(() => import('./pages/system/SystemHealth'));

function PageLoading() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
        <p className="text-text-muted text-sm">Loading command center...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, permission }) {
  const { user, loading, hasPermission } = useAuth();
  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !hasPermission(permission)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login"    element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />

        <Route path="/dashboard"    element={<ProtectedRoute permission="dashboard"><Dashboard /></ProtectedRoute>} />
        <Route path="/map"          element={<ProtectedRoute permission="map"><TrafficMap /></ProtectedRoute>} />
        <Route path="/prediction"   element={<ProtectedRoute permission="prediction"><Prediction /></ProtectedRoute>} />
        <Route path="/network"      element={<ProtectedRoute permission="network"><Network /></ProtectedRoute>} />
        <Route path="/incidents"    element={<ProtectedRoute permission="incidents"><Incidents /></ProtectedRoute>} />
        <Route path="/routes"       element={<ProtectedRoute permission="routes"><SmartRoutes /></ProtectedRoute>} />
        <Route path="/analytics"    element={<ProtectedRoute permission="analytics"><Analytics /></ProtectedRoute>} />
        <Route path="/datasources"  element={<ProtectedRoute permission="datasources"><DataSources /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute permission="notifications"><Notifications /></ProtectedRoute>} />
        <Route path="/settings"     element={<ProtectedRoute permission="settings"><Settings /></ProtectedRoute>} />
        <Route path="/system"       element={<ProtectedRoute permission="dashboard"><SystemHealth /></ProtectedRoute>} />

        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
          <AuthProvider>
            <AppProvider>
              <MobileFrame>
                <AppRoutes />
              </MobileFrame>
            </AppProvider>
          </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
