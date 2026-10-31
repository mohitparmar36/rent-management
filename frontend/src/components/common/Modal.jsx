import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Accessible dialog: closes on Escape or backdrop click, moves focus inside
 * when opened and back to the previously focused element when closed.
 */
export default function Modal({ isOpen, title, onClose, children, footer, size = 'md', busy = false }) {
  const titleId = useId();
  const dialogRef = useRef(null);

  // Latest callbacks in a ref, so re-renders of the parent (e.g. typing in a
  // field) don't re-run the effect below and steal focus
  const latest = useRef({ onClose, busy });
  useEffect(() => {
    latest.current = { onClose, busy };
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    // Focus the first form control, otherwise the dialog itself
    const first = dialog?.querySelector('[autofocus], input:not([type=hidden]), select, textarea');
    (first ?? dialog)?.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape' && !latest.current.busy) latest.current.onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('modal-open');

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div
        ref={dialogRef}
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="modal-header">
          <h2 id={titleId} className="modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog" disabled={busy}>
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}
