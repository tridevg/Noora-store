import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiGet } from '../../lib/api';

export interface ApiResource<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** Re-runs the request for the current path (used by retry buttons). */
  reload: () => void;
}

/**
 * GET a public /api path. Re-fetches when path changes or reload is called, and aborts the
 * in-flight request on change or unmount. A null path does nothing (conditional loads).
 */
export function useApiResource<T>(path: string | null): ApiResource<T> {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{
    key: string | null;
    data?: T;
    error?: unknown;
    done: boolean;
  }>({ key: null, done: false });
  const key = path === null ? null : `${nonce}:${path}`;

  useEffect(() => {
    if (path === null) return;
    const controller = new AbortController();
    apiGet<T>(path, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data, done: true });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          key,
          error: error ?? new ApiError(0, 'internal', 'Request failed'),
          done: true,
        });
      });
    // key already encodes path and nonce, so it is the only dependency that matters.
    return () => controller.abort();
  }, [key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // State belongs to a key; a different key means the request for the current path is pending.
  const current = state.key === key;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: key !== null && !(current && state.done),
    reload,
  };
}
