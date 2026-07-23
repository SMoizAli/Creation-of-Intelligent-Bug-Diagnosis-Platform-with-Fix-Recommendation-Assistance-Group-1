import { useState, useEffect, useCallback } from 'react';
import { getStatus } from '../services/api';

export function useSystemStatus(pollInterval = 30000) {
  const [status, setStatus] = useState({ overall: 'checking', services: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getStatus();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setStatus({ overall: 'unavailable', services: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollInterval);
    return () => clearInterval(id);
  }, [refresh, pollInterval]);

  return { status, loading, error, refresh };
}
