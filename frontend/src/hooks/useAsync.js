import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../utils/errors';

/**
 * Loads data when the component mounts and whenever `deps` change.
 *
 *   const { data, loading, error, reload } = useAsync(() => getProperty(id), [id]);
 *
 * If deps change while a request is in flight, the older response is ignored,
 * so a slow request can never overwrite newer data.
 */
export default function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null, errorObject: null });
  const latestRequest = useRef(0);

  // Always call the latest loader (it closes over the latest props) without re-running on every render
  const loaderRef = useRef(loader);
  useLayoutEffect(() => {
    loaderRef.current = loader;
  });

  const run = useCallback(async ({ silent = false, isStale = () => false } = {}) => {
    const id = ++latestRequest.current;
    const isCurrent = () => id === latestRequest.current && !isStale();

    if (!silent) setState((s) => ({ ...s, loading: true, error: null, errorObject: null }));
    try {
      const data = await loaderRef.current();
      if (isCurrent()) setState({ data, loading: false, error: null, errorObject: null });
    } catch (error) {
      if (isCurrent()) setState((s) => ({ ...s, loading: false, error: getErrorMessage(error), errorObject: error }));
    }
  }, []);

  useEffect(() => {
    let stale = false; // set when deps change or the component unmounts
    run({ isStale: () => stale });
    return () => {
      stale = true;
    };
    // `deps` is the caller's dependency list, as with useEffect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  /** Reload; `silent` keeps current data on screen while refreshing. */
  const reload = useCallback((options) => run(options), [run]);
  const setData = useCallback((data) => setState((s) => ({ ...s, data })), []);

  return { ...state, reload, setData };
}
