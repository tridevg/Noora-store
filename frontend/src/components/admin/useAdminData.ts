import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../../lib/api';

interface LoadState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
}

/**
 * Loads admin data for the current deps and aborts on change or unmount.
 * A 401 sends the browser to /admin/login. Call reload() after a mutation.
 */
export function useAdminData<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
) {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState<T>>({
    data: undefined,
    error: undefined,
    loading: true,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ data: prev.data, error: undefined, loading: true }));
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ data, error: undefined, loading: false });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          navigate('/admin/login', { replace: true });
          return;
        }
        setState({ data: undefined, error, loading: false });
      },
    );
    return () => controller.abort();
  }, [version, navigate, ...deps]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
