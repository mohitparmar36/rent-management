import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { EmptyState, ErrorState } from './States';

/**
 * A table with built-in loading, error and empty states.
 *
 * columns: [{ key, header, render?(row), sortKey?, align?: 'right', hideOnMobile? }]
 * rowLink: optional (row) => '/path' — the whole row becomes clickable
 * sort:    { sortBy, sortDir } from useListParams, onSort(sortKey)
 *
 * On narrow screens each row turns into a card (labels come from `header`).
 */
export default function DataTable({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  empty,
  rowLink,
  sort,
  onSort,
  caption,
}) {
  const navigate = useNavigate();

  if (error) return <ErrorState message={error} onRetry={onRetry} compact />;

  const showSkeleton = loading && !rows;
  const isEmpty = !loading && rows && rows.length === 0;

  return (
    <div className={`table-wrap${loading && rows ? ' is-refreshing' : ''}`}>
      <table className="data-table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={[col.align === 'right' && 'align-right', col.hideOnMobile && 'hide-mobile'].filter(Boolean).join(' ')}
                aria-sort={sortState(col, sort)}
              >
                {col.sortKey && onSort ? (
                  <button type="button" className="th-sort" onClick={() => onSort(col.sortKey)}>
                    {col.header}
                    <SortIcon active={sort?.sortBy === col.sortKey} desc={sort?.sortDir === 'desc'} />
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {showSkeleton &&
            Array.from({ length: 5 }, (_, i) => (
              <tr key={`sk-${i}`} className="skeleton-tr">
                {columns.map((col) => (
                  <td key={col.key} className={col.hideOnMobile ? 'hide-mobile' : undefined}>
                    <span className="skeleton skeleton-text" />
                  </td>
                ))}
              </tr>
            ))}

          {!showSkeleton &&
            rows?.map((row) => {
              const link = rowLink?.(row);
              return (
                <tr
                  key={rowKey(row)}
                  className={link ? 'clickable' : undefined}
                  onClick={
                    link
                      ? (e) => {
                          // Let buttons/links inside the row do their own thing
                          if (!e.target.closest('a, button, input, select')) navigate(link);
                        }
                      : undefined
                  }
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      data-label={typeof col.header === 'string' ? col.header : undefined}
                      className={[col.align === 'right' && 'align-right', col.hideOnMobile && 'hide-mobile'].filter(Boolean).join(' ') || undefined}
                    >
                      <div className="cell-content">{col.render ? col.render(row) : row[col.key]}</div>
                    </td>
                  ))}
                </tr>
              );
            })}
        </tbody>
      </table>
      {isEmpty && (empty ?? <EmptyState title="Nothing here yet" compact />)}
    </div>
  );
}

function sortState(col, sort) {
  if (!col.sortKey || sort?.sortBy !== col.sortKey) return undefined;
  return sort.sortDir === 'desc' ? 'descending' : 'ascending';
}

function SortIcon({ active, desc }) {
  if (!active) return <ArrowUpDown size={13} className="sort-icon" aria-hidden="true" />;
  return desc ? <ArrowDown size={13} className="sort-icon active" aria-hidden="true" />
    : <ArrowUp size={13} className="sort-icon active" aria-hidden="true" />;
}
