import { useApp } from '../../context/AppContext';
import { AnimatePresence, motion } from 'framer-motion';
import TopBar from './TopBar';
import QuickDock from '../ui/QuickDock';
import DemoBadge from '../ui/DemoBadge';

export default function AppLayout({ children, title, subtitle, dataStatus, dataHealth, lastUpdated }) {
  const { presentationMode } = useApp();

  if (presentationMode) {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle bg-bg-secondary">
          <span className="demo-badge">PRESENTATION</span>
        </div>
        <main className="flex-1 overflow-auto p-4">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="flex min-h-screen flex-col">
        <TopBar title={title} subtitle={subtitle} dataStatus={dataStatus} dataHealth={dataHealth} lastUpdated={lastUpdated} />
        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="mx-auto w-full max-w-[1600px] p-3 pb-28 md:p-5 md:pb-24 lg:px-7 lg:py-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <QuickDock />
      <DemoBadge dataStatus={dataStatus} />
    </div>
  );
}
