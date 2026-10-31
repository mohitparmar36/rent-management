import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Page controls for a PagedResult from the API ({ page, pageSize, totalCount, totalPages }). */
export default function Pagination({ result, onPageChange }) {
  if (!result || result.totalCount === 0) return null;

  const { page, pageSize, totalCount, totalPages } = result;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalCount);

  // 1 … 4 5 6 … 12
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination-summary">
        {first}–{last} of {totalCount}
      </span>
      {totalPages > 1 && (
        <div className="pagination-buttons">
          <button type="button" className="page-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
            <ChevronLeft size={16} />
          </button>
          {pages.map((p, i) => (
            <span key={p} className="pagination-group">
              {i > 0 && p - pages[i - 1] > 1 && <span className="pagination-gap">…</span>}
              <button
                type="button"
                className={`page-btn${p === page ? ' active' : ''}`}
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            </span>
          ))}
          <button type="button" className="page-btn" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </nav>
  );
}
