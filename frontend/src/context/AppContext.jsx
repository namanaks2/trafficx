import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notificationsData, incidents as initialIncidents, monitoringLocations, kpiData } from '../data/demoData';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [notifications, setNotifications] = useState(notificationsData);
  const [incidents, setIncidents] = useState(initialIncidents);
  const [nodes, setNodes] = useState(monitoringLocations);
  const [kpis, setKpis] = useState(kpiData);
  const [presentationMode, setPresentationMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState(true);

  // Simulate live data updates
  useEffect(() => {
    if (!liveUpdates) return;
    const interval = setInterval(() => {
      setNodes(prev => prev.map(node => {
        if (node.status === 'offline') return node;
        const delta = Math.floor(Math.random() * 20 - 10);
        const speedDelta = Math.floor(Math.random() * 4 - 2);
        return {
          ...node,
          vehicleCount: Math.max(10, node.vehicleCount + delta),
          avgSpeed: Math.max(5, Math.min(120, node.avgSpeed + speedDelta)),
          congestion: Math.max(5, Math.min(99, node.congestion + Math.floor(Math.random() * 6 - 3))),
          lastUpdate: new Date().toISOString(),
        };
      }));
      setKpis(prev => ({
        ...prev,
        vehiclesMonitored: { ...prev.vehiclesMonitored, value: prev.vehiclesMonitored.value + Math.floor(Math.random() * 20 - 10) },
        congestionIndex: { ...prev.congestionIndex, value: Math.max(10, Math.min(99, prev.congestionIndex.value + Math.floor(Math.random() * 4 - 2))) },
        avgSpeed: { ...prev.avgSpeed, value: Math.max(5, Math.min(80, prev.avgSpeed.value + Math.floor(Math.random() * 2 - 1))) },
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, [liveUpdates]);

  const addIncident = useCallback((incident) => {
    const newIncident = {
      ...incident,
      id: `INC-${Date.now()}`,
      reportedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'reported',
    };
    setIncidents(prev => [newIncident, ...prev]);
    addNotification({
      type: 'warning',
      title: 'New Incident Reported',
      message: `${incident.title} at ${incident.location}`,
      link: '/incidents',
    });
  }, []);

  const updateIncident = useCallback((id, updates) => {
    setIncidents(prev => prev.map(inc =>
      inc.id === id ? { ...inc, ...updates, updatedAt: new Date().toISOString() } : inc
    ));
  }, []);

  const addNotification = useCallback((notification) => {
    const newNotif = {
      ...notification,
      id: `ntf-${Date.now()}`,
      time: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
  }, []);

  const markNotificationRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppContext.Provider value={{
      notifications, unreadCount, addNotification, markNotificationRead, markAllRead,
      incidents, addIncident, updateIncident,
      nodes, kpis,
      presentationMode, setPresentationMode,
      sidebarCollapsed, setSidebarCollapsed,
      liveUpdates, setLiveUpdates,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
