import { Link } from 'react-router-dom';

/** A single headline figure. Becomes a link when `to` is given. */
export default function StatCard({ label, value, hint, icon: Icon, tone = 'primary', to }) {
  const content = (
    <>
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        {Icon && (
          <span className={`stat-card-icon tone-${tone}`} aria-hidden="true">
            <Icon size={18} />
          </span>
        )}
      </div>
      <div className="stat-card-value">{value}</div>
      {hint && <div className="stat-card-hint">{hint}</div>}
    </>
  );

  return to ? (
    <Link to={to} className="stat-card stat-card-link">{content}</Link>
  ) : (
    <div className="stat-card">{content}</div>
  );
}
