import { Circle } from 'lucide-react';

const STATUS_CONFIG = {
  // Incident statuses
  reported: { label: 'Reported', className: 'badge-info' },
  under_verification: { label: 'Under Verification', className: 'badge-warning' },
  verified: { label: 'Verified', className: 'badge-warning' },
  responding: { label: 'Responding', className: 'badge-critical' },
  resolved: { label: 'Resolved', className: 'badge-success' },
  
  // Node statuses
  active: { label: 'Active', className: 'badge-success' },
  online: { label: 'Online', className: 'badge-success' },
  offline: { label: 'Offline', className: 'badge-critical' },
  warning: { label: 'Warning', className: 'badge-warning' },
  syncing: { label: 'Syncing', className: 'badge-info' },
  
  // Severity
  critical: { label: 'Critical', className: 'badge-critical' },
  high: { label: 'High', className: 'badge-critical' },
  medium: { label: 'Medium', className: 'badge-warning' },
  low: { label: 'Low', className: 'badge-info' },
  
  // Source statuses
  connected: { label: 'Connected', className: 'badge-success' },
  disconnected: { label: 'Disconnected', className: 'badge-critical' },
  error: { label: 'Error', className: 'badge-critical' },
};

export default function StatusBadge({ status, label, dot = true }) {
  const config = STATUS_CONFIG[status?.toLowerCase()] || { label: status, className: 'badge-info' };
  
  return (
    <span className={config.className}>
      {dot && <Circle size={6} className="fill-current" />}
      {label || config.label}
    </span>
  );
}
