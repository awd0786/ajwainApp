import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Generic loader:
 *   const { data, loading, error, reload, refreshing, refresh, setData } =
 *     useAsync(() => api.get('pendingReplicationBugs'), [], { initial: [] });
 *
 * reload()  -> full loading state (spinner)
 * refresh() -> pull-to-refresh state (keeps data visible)
 */
export default function useAsync(fn, deps = [], { initial = null, immediate = true } = {}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(immediate);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const alive = useRef(true);
  const seq = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(
    async (mode = 'load') => {
      const id = ++seq.current;
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fn();
        if (alive.current && id === seq.current) setData(res);
        return res;
      } catch (e) {
        if (alive.current && id === seq.current) setError(e?.message || String(e));
        return undefined;
      } finally {
        if (alive.current && id === seq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  useEffect(() => {
    if (immediate) run('load');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  return {
    data,
    setData,
    loading,
    refreshing,
    error,
    reload: () => run('load'),
    refresh: () => run('refresh'),
  };
}
