import { useApp } from '../../context/AppContext';
import { AnimatePresence, motion } from 'framer-motion';
import { useViewMode } from '../../context/ViewModeContext';
import DesktopSidebar from './DesktopSidebar';
import MobileNav from './MobileNav';
import TopBar from './TopBar';
import DemoBadge from '../ui/DemoBadge';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export default function AppLayout({ children, title, subtitle, dataStatus }) {
  const { sidebarCollapsed, presentationMode } = useApp();
  const { isMobile } = useViewMode();
  const isLargeScreen = useMediaQuery('(min-width: 768px)');

  // In mobile mode the frame provides the container — just render content
  const showDesktopSidebar = !isMobile && isLargeScreen;
  const showMobileNav      = isMobile || !isLargeScreen;

  if (presentationMode) {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle bg-bg-secondary">
          <span className="text-sm font-bold text-text-primary tracking-wider">TRAFFICX</span>
          <span className="demo-badge">PRESENTATION</span>
        </div>
        <main className="flex-1 overflow-auto p-4">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Desktop sidebar — only shown in desktop view mode on large screens */}
      {showDesktopSidebar && <DesktopSidebar />}

      {/* Main area */}
      <div
        className="flex-1 flex flex-col min-w-0 w-full"
        style={showDesktopSidebar
          ? { marginLeft: sidebarCollapsed ? 76 : 252, transition: 'margin-left 0.25s ease' }
          : { marginLeft: 0 }
        }
      >
        <TopBar title={title} subtitle={subtitle} dataStatus={dataStatus} showMenuBtn={!showDesktopSidebar} />

        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              /* Extra bottom padding clears the mobile bottom nav */
              className="p-3 pb-24 md:p-5 lg:p-7 xl:px-8"
              style={showDesktopSidebar ? { maxWidth: 1600, margin: '0 auto', width: '100%' } : {}}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom nav + drawer — shown in mobile mode or small screens */}
      {showMobileNav && <MobileNav />}

      <DemoBadge dataStatus={dataStatus} />
    </div>
  );
}
