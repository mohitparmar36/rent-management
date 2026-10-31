import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * List state (page, search, filters, sort) kept in the URL query string, so the
 * browser's back button, refresh and shared links all keep the same view.
 *
 *   const { params, setParam, setSort } = useListParams({ pageSize: 10 });
 *   getProperties(params)
 */
export default function useListParams(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => {
    const result = { page: 1, pageSize: 10, ...defaults };
    for (const [key, value] of searchParams.entries()) {
      result[key] = key === 'page' || key === 'pageSize' ? Number(value) || result[key] : value;
    }
    return result;
    // `defaults` is a literal at the call site; the URL is the real input
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /** Sets one filter (empty value removes it) and goes back to page 1. */
  const setParam = useCallback(
    (key, value) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value === '' || value === null || value === undefined) next.delete(key);
          else next.set(key, String(value));
          if (key !== 'page') next.delete('page');
          return next;
        },
        { replace: key === 'search' },
      );
    },
    [setSearchParams],
  );

  /** Clicking the same column flips direction; a new column starts ascending. */
  const setSort = useCallback(
    (column) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        const sameColumn = next.get('sortBy') === column;
        next.set('sortBy', column);
        next.set('sortDir', sameColumn && next.get('sortDir') !== 'desc' ? 'desc' : 'asc');
        next.delete('page');
        return next;
      });
    },
    [setSearchParams],
  );

  const clear = useCallback(() => setSearchParams({}), [setSearchParams]);

  const hasFilters = [...searchParams.keys()].some((k) => !['page', 'pageSize', 'sortBy', 'sortDir'].includes(k));

  return { params, setParam, setSort, clear, hasFilters };
}
