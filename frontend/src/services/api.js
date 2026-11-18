/**
 * TrafficX API service layer.
 */

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

async function request(path, options = {}) {
  if (!BASE_URL) return null;
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API request failed (${res.status})`);
  return res.json();
}

export const api = {
  configured: Boolean(BASE_URL),
  traffic: {
    summary:  () => request('/api/traffic/summary'),
    hourly:   () => request('/api/traffic/hourly'),
    locations:() => request('/api/traffic/locations'),
    predict:  (id) => request(`/api/traffic/predict/${id}`),
  },
  incidents: {
    list:   (params = {}) => request('/api/incidents/?' + new URLSearchParams(params)),
    create: (body)        => request('/api/incidents/', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body)    => request(`/api/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
  nodes: {
    list:    () => request('/api/nodes/'),
    health:  () => request('/api/nodes/health'),
    ledger:  (limit = 20) => request(`/api/nodes/ledger?limit=${limit}`),
    observe: (nodeId)     => request(`/api/nodes/${nodeId}/observe`, { method: 'POST' }),
  },
  health: {
    status: () => request('/health'),
  },
};
