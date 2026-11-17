import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

const colorMap = {
  blue:     { text: 'text-accent-blue',    bg: 'bg-accent-blue/10',    border: 'border-accent-blue/20' },
  purple:   { text: 'text-accent-purple',  bg: 'bg-accent-purple/10',  border: 'border-accent-purple/20' },
  green:    { text: 'text-status-success', bg: 'bg-status-success/10', border: 'border-status-success/20' },
  warning:  { text: 'text-status-warning', bg: 'bg-status-warning/10', border: 'border-status-warning/20' },
  critical: { text: 'text-status-critical',bg: 'bg-status-critical/10',border: 'border-status-critical/20' },
};

export default function KpiCard({ title, value, unit, trend, icon: Icon, color = 'blue', subtitle, index = 0, compact = false }) {
  const c = colorMap[color] || colorMap.blue;
  const trendUp = trend > 0;
  const trendNeutral = trend === 0;
  const trendBad = (color === 'critical' || color === 'warning') ? trendUp : !trendUp;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className="glass-card relative overflow-hidden hover:border-border-accent transition-all duration-300"
      style={{ padding: compact ? '10px 12px' : '20px' }}
    >
      {/* Icon row */}
      <div className="flex items-start justify-between mb-2">
        <div className={`rounded-lg flex items-center justify-center ${c.bg} ${c.border} border`}
          style={{ width: compact ? 28 : 36, height: compact ? 28 : 36 }}>
          {Icon && <Icon size={compact ? 13 : 17} className={c.text} />}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
            trendNeutral ? 'text-text-muted bg-bg-elevated' :
            trendBad     ? 'text-status-critical bg-status-critical/10' :
                           'text-status-success bg-status-success/10'
          }`}>
            {!trendNeutral && (trendUp ? <TrendingUp size={8} /> : <TrendingDown size={8} />)}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-0.5 mb-0.5">
        <span className={`font-bold leading-none ${c.text} ${compact ? 'text-xl' : 'text-2xl'}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-[10px] text-text-muted font-medium">{unit}</span>}
      </div>
      <p className={`text-text-secondary font-medium leading-tight ${compact ? 'text-[10px]' : 'text-xs'}`}>{title}</p>
      {subtitle && <p className={`text-text-muted leading-tight mt-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{subtitle}</p>}

      {/* Bottom accent line */}
      <div className={`absolute bottom-0 left-0 right-0 h-[2px] opacity-40 ${c.bg}`} />
    </motion.div>
  );
}
