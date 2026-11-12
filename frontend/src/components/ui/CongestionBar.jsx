export default function CongestionBar({ value, showLabel = true, size = 'md' }) {
  const getColor = (v) => {
    if (v < 30) return 'bg-status-success';
    if (v < 55) return 'bg-yellow-400';
    if (v < 75) return 'bg-status-warning';
    return 'bg-status-critical';
  };

  const getLabel = (v) => {
    if (v < 30) return 'Free Flow';
    if (v < 55) return 'Moderate';
    if (v < 75) return 'Heavy';
    return 'Severe';
  };

  const heights = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' };

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-text-muted">{getLabel(value)}</span>
          <span className="text-xs font-semibold text-text-secondary">{value}%</span>
        </div>
      )}
      <div className={`w-full bg-bg-elevated rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`${heights[size]} rounded-full transition-all duration-700 ${getColor(value)}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}
