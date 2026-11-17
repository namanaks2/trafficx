import { useEffect, useRef, useState, useCallback } from 'react';

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

/**
 * Connects to a TrafficX WebSocket channel.
 * @param {string} channel  - 'all' | 'traffic' | 'predictions' | 'incidents' | 'nodes'
 * @param {function} onMessage - called with parsed message object
 */
export function useWebSocket(channel, onMessage) {
  const wsRef        = useRef(null);
  const [status, setStatus] = useState('disconnected'); // connected | disconnected | error
  const retryRef     = useRef(null);
  const mountedRef   = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    try {
      const ws = new WebSocket(`${WS_BASE}/ws/${channel}`);
      wsRef.current = ws;
      setStatus('connecting');

      ws.onopen  = () => setStatus('connected');
      ws.onmessage = (e) => {
        try { onMessage && onMessage(JSON.parse(e.data)); }
        catch {}
      };
      ws.onerror = () => setStatus('error');
      ws.onclose = () => {
        setStatus('disconnected');
        if (mountedRef.current) {
          retryRef.current = setTimeout(connect, 4000);
        }
      };
    } catch {
      setStatus('error');
    }
  }, [channel, onMessage]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return status;
}

/**
 * Fetches backend health (Kafka, Cassandra, LSTM).
 */
export async function fetchSystemHealth() {
  const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  try {
    const r = await fetch(`${API}/api/health/`);
    return await r.json();
  } catch {
    return null;
  }
}

export async function fetchKafkaStatus() {
  const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  try {
    const r = await fetch(`${API}/api/kafka/status`);
    return await r.json();
  } catch {
    return null;
  }
}
