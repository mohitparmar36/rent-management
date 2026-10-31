import { Link } from 'react-router-dom';
import { EmptyState } from './States';

/**
 * A compact list for dashboards and detail pages.
 * items: [{ key, to?, icon?, title, subtitle, end? }]
 */
export default function ItemList({ items, empty }) {
  if (!items?.length) return empty ?? <EmptyState title="Nothing to show yet" compact />;

  return (
    <ul className="item-list">
      {items.map((item) => {
        const body = (
          <>
            {item.icon}
            <span className="item-row-main">
              <span className="item-row-title">{item.title}</span>
              {item.subtitle && <span className="item-row-sub">{item.subtitle}</span>}
            </span>
            {item.end && <span className="item-row-end">{item.end}</span>}
          </>
        );
        return (
          <li key={item.key}>
            {item.to ? <Link to={item.to} className="item-row">{body}</Link> : <div className="item-row">{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}
