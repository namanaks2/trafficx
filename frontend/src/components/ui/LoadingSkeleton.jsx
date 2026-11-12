export function SkeletonCard() {
  return (
    <div className="glass-card p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-bg-elevated" />
        <div className="w-16 h-6 rounded-full bg-bg-elevated" />
      </div>
      <div className="w-24 h-8 rounded bg-bg-elevated mb-2" />
      <div className="w-32 h-4 rounded bg-bg-elevated" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="animate-pulse flex items-center gap-4 px-4 py-3 border-b border-border-subtle">
      <div className="w-8 h-8 rounded-full bg-bg-elevated shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="w-3/4 h-4 rounded bg-bg-elevated" />
        <div className="w-1/2 h-3 rounded bg-bg-elevated" />
      </div>
      <div className="w-20 h-6 rounded-full bg-bg-elevated" />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="glass-card p-5 animate-pulse">
      <div className="w-48 h-5 rounded bg-bg-elevated mb-6" />
      <div className="flex items-end gap-2 h-40">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-bg-elevated"
            style={{ height: `${Math.random() * 80 + 20}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function LoadingSkeleton({ type = 'card', count = 1 }) {
  const components = { card: SkeletonCard, row: SkeletonRow, chart: SkeletonChart };
  const Component = components[type] || SkeletonCard;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => <Component key={i} />)}
    </>
  );
}
