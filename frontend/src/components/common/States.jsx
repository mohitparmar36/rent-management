import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

/** Shown when a list or section has nothing to display yet. */
export function EmptyState({ icon: Icon = Inbox, title, description, action, compact = false }) {
  return (
    <div className={`empty-state${compact ? ' compact' : ''}`}>
      <span className="empty-state-icon" aria-hidden="true">
        <Icon size={compact ? 20 : 24} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

/** Shown when loading failed, with a retry button. */
export function ErrorState({ message, onRetry, compact = false }) {
  return (
    <div className={`empty-state error-state${compact ? ' compact' : ''}`} role="alert">
      <span className="empty-state-icon" aria-hidden="true">
        <AlertTriangle size={compact ? 20 : 24} />
      </span>
      <h3>We couldn&apos;t load this</h3>
      <p>{message}</p>
      {onRetry && (
        <div className="empty-state-action">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRetry()}>
            <RefreshCw size={15} /> Try again
          </button>
        </div>
      )}
    </div>
  );
}

/** Grey placeholder blocks shown while a page loads. */
export function PageSkeleton({ cards = 4, rows = 5 }) {
  return (
    <div className="skeleton-page" aria-busy="true" aria-label="Loading">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-subtitle" />
      {cards > 0 && (
        <div className="stat-grid">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
      )}
      <div className="card">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton skeleton-row" />
        ))}
      </div>
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="inline-loader" role="status">
      <span className="spinner spinner-dark" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
