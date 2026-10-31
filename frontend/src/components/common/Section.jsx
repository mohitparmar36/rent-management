/** A titled card that groups related content on a page. */
export function Section({ title, description, actions, children, flush = false, className = '' }) {
  return (
    <section className={`card section ${flush ? 'section-flush' : ''} ${className}`.trim()}>
      {(title || actions) && (
        <header className="section-header">
          <div>
            {title && <h2 className="section-title">{title}</h2>}
            {description && <p className="section-description">{description}</p>}
          </div>
          {actions && <div className="section-actions">{actions}</div>}
        </header>
      )}
      <div className="section-body">{children}</div>
    </section>
  );
}

/** Label/value pairs, e.g. contact details. items: [{ label, value }] — empty values show a dash. */
export function DetailList({ items, columns = 2 }) {
  return (
    <dl className={`detail-list cols-${columns}`}>
      {items.map(({ label, value }) => (
        <div key={label} className="detail-item">
          <dt>{label}</dt>
          <dd>{value === null || value === undefined || value === '' ? '—' : value}</dd>
        </div>
      ))}
    </dl>
  );
}
