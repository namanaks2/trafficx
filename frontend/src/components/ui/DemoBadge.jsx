import { Cpu } from 'lucide-react';

export default function DemoBadge() {
  return (
    <div className="demo-overlay">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-bg-secondary/95 text-text-muted border border-border-subtle backdrop-blur-sm shadow-card">
        <Cpu size={11} />
        DEMO MODE
      </div>
    </div>
  );
}
