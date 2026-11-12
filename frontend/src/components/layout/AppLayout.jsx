import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import DemoBadge from '../ui/DemoBadge';

export default function AppLayout({ children, title, subtitle }) {
  const { sidebarCollapsed, presentationMode } = useApp();

  if (presentationMode) {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border-subtle bg-bg-secondary">
          <div className="flex items-center gap-3">
            <div className="text-sm font-bold text-text-primary tracking-wider">TRAFFICX</div>
            <span className="demo-badge">PRESENTATION MODE</span>
          </div>
          <TopBar title={title} subtitle={subtitle} />
        </div>
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <motion.div
        animate={{ marginLeft: sidebarCollapsed ? 72 : 256 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="flex-1 flex flex-col min-h-screen min-w-0"
      >
        <TopBar title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="p-4 md:p-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </motion.div>

      {/* Demo indicator */}
      <DemoBadge />
    </div>
  );
}
