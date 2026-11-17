import { useViewMode } from '../../context/ViewModeContext';
import ViewToggle from './ViewToggle';

/**
 * MOBILE MODE (default):
 *   • Real phone/small screen → full screen, no frame
 *   • Laptop/desktop → centred 390px phone frame, app content inside
 *
 * DESKTOP MODE:
 *   • Always full width on any screen
 */
export default function MobileFrame({ children }) {
  const { isMobile } = useViewMode();

  /* ── Desktop mode: full width + floating toggle ── */
  if (!isMobile) {
    return (
      <div className="relative min-h-screen">
        {children}
        <div className="fixed bottom-5 right-5 z-[9998]">
          <ViewToggle />
        </div>
      </div>
    );
  }

  /* ── Mobile mode on a real phone: render normally ── */
  /* (screen width < 768 px — handled purely in CSS via the md: breakpoint) */

  return (
    <>
      {/* Real small screen: children fill the screen */}
      <div className="md:hidden min-h-screen bg-bg-primary relative">
        {children}
        <div className="fixed bottom-24 right-3 z-[9998]">
          <ViewToggle />
        </div>
      </div>

      {/* Laptop/desktop: phone frame */}
      <div className="hidden md:flex min-h-screen items-center justify-center bg-[#060C16] relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(56,189,248,0.07) 0%, transparent 70%)' }} />

        <div className="relative flex flex-col items-center gap-5 py-8">
          {/* Toggle above phone */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] text-text-muted tracking-[0.15em] uppercase">View Mode</span>
            <ViewToggle variant="login" />
          </div>

          {/* Phone shell */}
          <div className="relative"
            style={{ width: 390, filter: 'drop-shadow(0 40px 80px rgba(0,0,0,0.9)) drop-shadow(0 0 60px rgba(56,189,248,0.08))' }}>

            {/* Outer body */}
            <div className="relative rounded-[52px] overflow-hidden"
              style={{
                border: '2.5px solid #1a2a3f',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
                background: '#080D17',
              }}>

              {/* Status bar */}
              <div className="flex items-center justify-between px-7 pt-3 pb-0 h-12 bg-[#080D17]">
                <span className="text-[12px] font-semibold text-white tabular-nums">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {/* Notch */}
                <div className="w-28 h-8 bg-black rounded-full flex items-center justify-center gap-2 px-3">
                  <div className="w-2 h-2 bg-[#1a1a1a] rounded-full border border-[#333]" />
                  <div className="w-12 h-1.5 bg-[#1a1a1a] rounded-full" />
                </div>
                {/* Signal icons */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-end gap-[2px] h-3">
                    {[2, 3, 4, 5].map((h, i) => (
                      <div key={i} className="w-[3px] rounded-[1px] bg-white" style={{ height: h * 2 }} />
                    ))}
                  </div>
                  <svg className="w-4 h-3" viewBox="0 0 24 12" fill="none">
                    <rect x="0.5" y="0.5" width="17" height="11" rx="2.5" stroke="white" strokeOpacity="0.4"/>
                    <rect x="1" y="1" width="13" height="10" rx="2" fill="white"/>
                    <path d="M19 4v4a2 2 0 000-4z" fill="white" fillOpacity="0.4"/>
                  </svg>
                </div>
              </div>

              {/* App viewport — fixed height, scrollable inside */}
              <div
                className="overflow-hidden bg-[#080D17]"
                style={{
                  height: 'min(780px, calc(100vh - 240px))',
                  overflowY: 'auto',
                  scrollbarWidth: 'none',
                }}
              >
                <style>{`
                  .phone-scroll::-webkit-scrollbar { display: none; }
                `}</style>
                <div className="phone-scroll" style={{ overflowY: 'auto', height: '100%' }}>
                  {children}
                </div>
              </div>

              {/* Home bar */}
              <div className="flex justify-center items-center h-7 bg-[#080D17]">
                <div className="w-32 h-[5px] bg-white/25 rounded-full" />
              </div>
            </div>

            {/* Physical side buttons */}
            <div className="absolute -left-[3px] top-28 w-[3px] h-7 bg-[#1a2a3f] rounded-l" />
            <div className="absolute -left-[3px] top-40 w-[3px] h-12 bg-[#1a2a3f] rounded-l" />
            <div className="absolute -left-[3px] top-56 w-[3px] h-12 bg-[#1a2a3f] rounded-l" />
            <div className="absolute -right-[3px] top-40 w-[3px] h-16 bg-[#1a2a3f] rounded-r" />
          </div>

          <p className="text-[10px] text-text-muted/50 tracking-widest uppercase">TrafficX · Mobile View</p>
        </div>
      </div>
    </>
  );
}
