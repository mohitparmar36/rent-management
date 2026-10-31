import { useState } from 'react';

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M1 12s4-7.5 11-7.5S23 12 23 12s-4 7.5-11 7.5S1 12 1 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 3l18 18M10.6 5.7A11.6 11.6 0 0 1 12 5.6c7 0 11 6.4 11 6.4a17.9 17.9 0 0 1-3.6 4.2M6.6 7.2C3.6 9 1 12 1 12s4 6.4 11 6.4c1.3 0 2.5-.2 3.6-.6M9.9 10a3 3 0 0 0 4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PasswordInput({
  id, value, onChange, placeholder, hasError, autoComplete, name,
  'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="input-wrapper">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        className={`input input-with-action${hasError ? ' input-error' : ''}`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      />
      <button
        type="button"
        className="input-action"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
