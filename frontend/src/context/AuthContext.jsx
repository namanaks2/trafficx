import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const DEMO_CREDENTIALS = {
  'admin@trafficx.io': { password: 'admin123', role: 'administrator', name: 'Alex Morgan' },
  'authority@trafficx.io': { password: 'auth123', role: 'traffic_authority', name: 'Sarah Chen' },
  'analyst@trafficx.io': { password: 'analyst123', role: 'traffic_analyst', name: 'James Wilson' },
  'user@trafficx.io': { password: 'user123', role: 'general_user', name: 'Demo User' },
};

const ROLE_PERMISSIONS = {
  administrator: ['dashboard', 'map', 'prediction', 'network', 'incidents', 'routes', 'analytics', 'datasources', 'notifications', 'settings', 'manage_incidents', 'manage_sources'],
  traffic_authority: ['dashboard', 'map', 'prediction', 'network', 'incidents', 'routes', 'analytics', 'notifications', 'settings', 'manage_incidents'],
  traffic_analyst: ['dashboard', 'map', 'prediction', 'network', 'incidents', 'routes', 'analytics', 'notifications', 'settings'],
  general_user: ['dashboard', 'map', 'incidents', 'routes', 'notifications', 'settings'],
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for persisted session
    try {
      const stored = localStorage.getItem('trafficx_user');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      localStorage.removeItem('trafficx_user');
    }
    setLoading(false);
  }, []);

  const login = async (email, password, remember = false) => {
    // Check demo credentials first
    const cred = DEMO_CREDENTIALS[email.toLowerCase()];
    if (cred && cred.password === password) {
      const userData = {
        id: 'usr-' + Math.random().toString(36).substr(2, 9),
        email: email.toLowerCase(),
        name: cred.name,
        role: cred.role,
        permissions: ROLE_PERMISSIONS[cred.role],
        loginTime: new Date().toISOString(),
        isDemo: true,
      };
      setUser(userData);
      if (remember) {
        localStorage.setItem('trafficx_user', JSON.stringify(userData));
      } else {
        sessionStorage.setItem('trafficx_user', JSON.stringify(userData));
      }
      return { success: true, user: userData };
    }
    
    // Reject invalid credentials
    return { success: false, error: 'Invalid email or password. Try admin@trafficx.io / admin123' };
  };

  const register = async (data) => {
    // Demo registration — always succeeds
    const userData = {
      id: 'usr-' + Math.random().toString(36).substr(2, 9),
      email: data.email.toLowerCase(),
      name: data.fullName,
      role: data.role || 'general_user',
      permissions: ROLE_PERMISSIONS[data.role || 'general_user'],
      loginTime: new Date().toISOString(),
      isDemo: true,
    };
    setUser(userData);
    localStorage.setItem('trafficx_user', JSON.stringify(userData));
    return { success: true, user: userData };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('trafficx_user');
    sessionStorage.removeItem('trafficx_user');
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    return user.permissions?.includes(permission) ?? false;
  };

  const updateProfile = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('trafficx_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, hasPermission, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
