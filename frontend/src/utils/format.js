/** Shared formatting utilities */

export const fmtNumber = (n) =>
  typeof n === 'number' ? n.toLocaleString() : n;

export const fmtPercent = (n, decimals = 1) =>
  `${Number(n).toFixed(decimals)}%`;

export const fmtSpeed = (n) => `${n} km/h`;

export const congestionLabel = (v) => {
  if (v < 30) return 'Free Flow';
  if (v < 55) return 'Moderate';
  if (v < 75) return 'Heavy';
  return 'Severe';
};

export const congestionColor = (v) => {
  if (v < 30) return '#22C55E';
  if (v < 55) return '#EAB308';
  if (v < 75) return '#F59E0B';
  return '#EF4444';
};

export const severityColor = (s) => ({
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#38BDF8',
  low: '#22C55E',
}[s] || '#94A3B8');

/** Download an array of objects as a CSV file */
export function downloadCSV(rows, filename = 'export.csv') {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const v = r[h] ?? '';
        return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
      }).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
