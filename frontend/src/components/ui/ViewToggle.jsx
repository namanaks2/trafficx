import { Smartphone, Monitor } from 'lucide-react';
import { useViewMode } from '../../context/ViewModeContext';

/**
 * Small pill button that switches between Mobile and Desktop view.
 * Pass variant="login" for the larger version on the login screen.
 */
export default function ViewToggle({ variant = 'default' }) {
  const { mode, toggle } = useViewMode();
  const isMobile = mode === 'mobile';

  if (variant === 'login') {
    return (
      <div className="flex items-center gap-2 p-1 rounded-2xl border border-border-default bg-bg-secondary">
        <button
          onClick={() => !isMobile && toggle()}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            isMobile
              ? 'bg-accent-blue text-bg-primary shadow-glow-blue'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <Smartphone size={15} />
          Mobile
        </button>
        <button
          onClick={() => isMobile && toggle()}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            !isMobile
              ? 'bg-accent-blue text-bg-primary shadow-glow-blue'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <Monitor size={15} />
          Desktop
        </button>
      </div>
    );
  }

  // Compact pill for inside the app
  return (
    <button
      onClick={toggle}
      title={isMobile ? 'Switch to Desktop view' : 'Switch to Mobile view'}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                 bg-bg-elevated border-border-default text-text-muted hover:border-accent-blue hover:text-accent-blue"
    >
      {isMobile ? <Monitor size={13} /> : <Smartphone size={13} />}
      {isMobile ? 'Desktop' : 'Mobile'}
    </button>
  );
}
