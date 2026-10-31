import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Modal from '../components/common/Modal';

const ConfirmContext = createContext(null);

/**
 * A promise-based confirmation dialog:
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Delete property?', message: '…', confirmText: 'Delete', danger: true })) { … }
 */
export function ConfirmProvider({ children }) {
  const [options, setOptions] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setOptions(opts);
      }),
    [],
  );

  function close(result) {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        isOpen={Boolean(options)}
        title={options?.title}
        onClose={() => close(false)}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => close(false)}>
              {options?.cancelText ?? 'Cancel'}
            </button>
            <button
              type="button"
              className={`btn ${options?.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => close(true)}
              autoFocus
            >
              {options?.confirmText ?? 'Confirm'}
            </button>
          </>
        }
      >
        <p className="confirm-message">{options?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within a ConfirmProvider');
  return context;
}
