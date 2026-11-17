import { createContext, useContext, useState, useEffect } from 'react';

const ViewModeContext = createContext(null);

export function ViewModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('trafficx_view_mode') || 'desktop';
  });

  const toggle = () => {
    const next = mode === 'mobile' ? 'desktop' : 'mobile';
    setMode(next);
    localStorage.setItem('trafficx_view_mode', next);
  };

  const setMobile  = () => { setMode('mobile');  localStorage.setItem('trafficx_view_mode', 'mobile'); };
  const setDesktop = () => { setMode('desktop'); localStorage.setItem('trafficx_view_mode', 'desktop'); };

  return (
    <ViewModeContext.Provider value={{ mode, toggle, setMobile, setDesktop, isMobile: mode === 'mobile' }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error('useViewMode must be inside ViewModeProvider');
  return ctx;
}
