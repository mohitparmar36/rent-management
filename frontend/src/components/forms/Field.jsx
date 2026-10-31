import { cloneElement, isValidElement, useId } from 'react';

/**
 * Label + control + hint/error, wired up for screen readers.
 *
 *   <Field label="Monthly rent" required error={errors.monthlyRent} hint="In USD">
 *     <input className="input" ... />
 *   </Field>
 *
 * The child control receives id, aria-invalid and aria-describedby automatically.
 */
export default function Field({ label, required, error, hint, children, className = '' }) {
  const id = useId();
  const messageId = `${id}-message`;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id ?? id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error || hint ? messageId : undefined,
        className: `${children.props.className ?? ''}${error ? ' input-error' : ''}`.trim(),
      })
    : children;

  return (
    <div className={`form-field ${className}`.trim()}>
      <label className="form-label" htmlFor={children?.props?.id ?? id}>
        {label}
        {required && <span className="required-mark" aria-hidden="true"> *</span>}
      </label>
      {control}
      {error ? (
        <span id={messageId} className="field-message error">{error}</span>
      ) : (
        hint && <span id={messageId} className="field-message hint">{hint}</span>
      )}
    </div>
  );
}

/** A submit button that shows a spinner and disables itself while saving. */
export function SubmitButton({ busy, children, busyText = 'Saving…', className = 'btn btn-primary', ...rest }) {
  return (
    <button type="submit" className={className} disabled={busy} {...rest}>
      {busy ? (
        <>
          <span className="spinner" aria-hidden="true" /> {busyText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
