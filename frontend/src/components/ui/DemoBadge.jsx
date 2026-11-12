import { Cpu } from 'lucide-react';

export default function DemoBadge() {
  return (
    <div className="demo-overlay">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-status-warning/20 text-status-warning border border-status-warning/40 backdrop-blur-sm shadow-lg">
        <Cpu size={11} />
        DEMO MODE
      </div>
    </div>
  );
}
