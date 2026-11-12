import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function KpiCard({ title, value, unit, trend, icon: Icon, color = 'blue', subtitle, sparkline, index = 0 }) {
  const colorMap = {
    blue: { text: 'text-accent-blue', bg: 'bg-accent-blue/10', border: 'border-accent-blue/20', glow: 'shadow-glow-blue' },
    purple: { text: 'text-accent-purple', bg: 'bg-accent-purple/10', border: 'border-accent-purple/20', glow: 'shadow-glow-purple' },
    green: { text: 'text-status-success', bg: 'bg-status-success/10', border: 'border-status-success/20', glow: 'shadow-glow-green' },
    warning: { text: 'text-status-warning', bg: 'bg-status-warning/10', border: 'border-status-warning/20' },
    critical: { text: 'text-status-critical', bg: 'bg-status-critical/10', border: 'border-status-critical/20' },
  };
  const c = colorMap[color] || colorMap.blue;

  const trendPositive = trend > 0;
  const trendNeutral = trend === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="metric-card group hover:border-border-accent transition-all duration-300"
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-lg ${c.bg} ${c.border} border`}>
          {Icon && <Icon size={18} className={c.text} />}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
            trendNeutral ? 'text-text-muted bg-bg-elevated' :
            trendPositive
              ? (color === 'critical' || color === 'warning' ? 'text-status-critical bg-status-critical/10' : 'text-status-success bg-status-success/10')
              : (color === 'critical' || color === 'warning' ? 'text-status-success bg-status-success/10' : 'text-status-critical bg-status-critical/10')
          }`}>
            {trendNeutral ? <Minus size={10} /> : trendPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mb-1">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-2xl font-bold ${c.text}`}>{value?.toLocaleString()}</span>
          {unit && <span className="text-sm text-text-muted font-medium">{unit}</span>}
        </div>
        <p className="text-sm text-text-secondary mt-1">{title}</p>
        {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
      </div>

      {/* Sparkline area */}
      {sparkline && (
        <div className="mt-3 h-10">
          {sparkline}
        </div>
      )}

      {/* Bottom glow line */}
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity ${c.bg}`} />
    </motion.div>
  );
}
