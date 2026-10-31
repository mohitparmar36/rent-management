import { useState } from 'react';
import { Info } from 'lucide-react';
import Modal from '../common/Modal';
import Field, { SubmitButton } from '../forms/Field';
import { DetailList } from '../common/Section';
import { useToast } from '../../context/ToastContext';
import { markRentPaid } from '../../services/api.service';
import { PAYMENT_METHODS } from '../../utils/constants';
import { getErrorMessage, getFieldErrors } from '../../utils/errors';
import { formatMoney, formatMonth, todayIso } from '../../utils/format';

/**
 * Record that a tenant paid rent outside the app (cash, UPI, bank transfer…).
 * The form only exists while the dialog is open, so it starts empty every time.
 */
export default function MarkPaidModal({ isOpen, payment, ...props }) {
  if (!isOpen || !payment) return null;
  return <MarkPaidDialog payment={payment} {...props} />;
}

function MarkPaidDialog({ onClose, onPaid, payment }) {
  const toast = useToast();
  const [form, setForm] = useState({ paymentDate: todayIso(), paymentMethod: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (!form.paymentDate) next.paymentDate = 'Payment date is required.';
    else if (form.paymentDate > todayIso()) next.paymentDate = 'Payment date cannot be in the future.';
    if (!form.paymentMethod) next.paymentMethod = 'Choose how the rent was paid.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setApiError('');
    try {
      await markRentPaid(payment.paymentId, { ...form, notes: form.notes.trim() || null });
      toast.success(`Payment of ${formatMoney(payment.amount)} recorded.`);
      onPaid?.();
      onClose();
    } catch (err) {
      setErrors(getFieldErrors(err));
      setApiError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      busy={busy}
      title="Record payment"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <SubmitButton form="mark-paid-form" busy={busy} busyText="Recording…">Mark as paid</SubmitButton>
        </>
      }
    >
      <form id="mark-paid-form" onSubmit={submit} noValidate className="form-stack">
        <DetailList
          items={[
            { label: 'Tenant', value: payment.tenantName },
            { label: 'Property', value: payment.propertyName },
            { label: 'Billing month', value: formatMonth(payment.billingMonth, 'long') },
            { label: 'Amount', value: <span className="cell-money">{formatMoney(payment.amount)}</span> },
          ]}
        />

        {apiError && <div className="form-banner error" role="alert">{apiError}</div>}

        <div className="form-grid">
          <Field label="Payment date" required error={errors.paymentDate}>
            <input type="date" className="input" value={form.paymentDate} max={todayIso()} onChange={set('paymentDate')} />
          </Field>
          <Field label="Payment method" required error={errors.paymentMethod}>
            <select className="input" value={form.paymentMethod} onChange={set('paymentMethod')}>
              <option value="">Select…</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Notes" className="span-2" error={errors.notes} hint="Optional, e.g. a transaction reference.">
            <input className="input" value={form.notes} maxLength={250} onChange={set('notes')} />
          </Field>
        </div>

        <p className="notice">
          <Info size={16} aria-hidden="true" />
          This records a payment you have already received. RentEase does not process or move money.
        </p>
      </form>
    </Modal>
  );
}
