import './Logo.css';

export default function Logo({ onDark = false }) {
  return (
    <div className={`re-logo${onDark ? ' on-dark' : ''}`}>
      <span className="re-logo-mark">
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
          <path
            d="M16 5L28 15.5V27C28 27.5523 27.5523 28 27 28H21V19H11V28H5C4.44772 28 4 27.5523 4 27V15.5L16 5Z"
            fill={onDark ? '#e8b563' : '#1b4b3a'}
          />
        </svg>
      </span>
      <span className="re-logo-word">
        Rent<strong>Ease</strong>
      </span>
    </div>
  );
}
