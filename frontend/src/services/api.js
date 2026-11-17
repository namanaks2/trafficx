/**
 * TrafficX API Service Layer
 * Falls back to demo data when VITE_API_URL is not configured.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  if (!BASE_URL) return null; // No backend configured — caller uses demo data
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

export const api = {
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
};
