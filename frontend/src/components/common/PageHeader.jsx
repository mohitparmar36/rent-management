import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Title row for every page. `breadcrumbs` is a list of { label, to }; the
 * current page (the title) is appended automatically. Also sets the browser tab title.
 */
export default function PageHeader({ title, subtitle, breadcrumbs, actions, eyebrow }) {
  useEffect(() => {
    document.title = title ? `${title} · RentEase` : 'RentEase';
  }, [title]);

  return (
    <div className="page-header">
      <div className="page-header-text">
        {breadcrumbs?.length > 0 && (
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb) => (
              <span key={crumb.to} className="breadcrumb-item">
                <Link to={crumb.to}>{crumb.label}</Link>
                <ChevronRight size={14} aria-hidden="true" />
              </span>
            ))}
            <span className="breadcrumb-current" aria-current="page">{title}</span>
          </nav>
        )}
        {eyebrow && <p className="text-eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
