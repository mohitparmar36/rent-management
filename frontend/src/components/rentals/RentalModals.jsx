import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../common/Modal';
import Field, { SubmitButton } from '../forms/Field';
import { Spinner } from '../common/States';
import { useToast } from '../../context/ToastContext';
import { createRental, endRental, getAvailableTenants, getProperties } from '../../services/api.service';
import { getErrorMessage, getFieldErrors } from '../../utils/errors';
import { formatDate, formatMoney, todayIso } from '../../utils/format';

// The dialogs below only render their form while open, so each opening starts fresh.

/**
 * Assign a tenant to a property. Pass `property` to fix the property (pick a tenant),
 * or `tenant` to fix the tenant (pick a vacant property).
 */
export function AssignRentalModal({ isOpen, ...props }) {
  return isOpen ? <AssignRentalDialog {...props} /> : null;
}

function AssignRentalDialog({ onClose, onAssigned, property, tenant }) {
  const toast = useToast();
  const choosingTenant = Boolean(property);
  const [options, setOptions] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({
    tenantId: tenant?.userId ?? '', propertyId: property?.propertyId ?? '', startDate: todayIso(), endDate: '',
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);

  // Load the choices once when the dialog opens
  useEffect(() => {
    const load = choosingTenant
      ? getAvailableTenants().then((list) => list.map((t) => ({ value: t.userId, label: `${t.fullName} (${t.email})` })))
      : getProperties({ status: 'Available', pageSize: 100, sortBy: 'name' }).then((page) =>
          page.items.map((p) => ({ value: p.propertyId, label: `${p.propertyName} — ${formatMoney(p.monthlyRent)}/mo` })));
    load.then(setOptions).catch((e) => setLoadError(getErrorMessage(e)));
  }, [choosingTenant]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (!form.tenantId) next.tenantId = 'Select a tenant.';
    if (!form.propertyId) next.propertyId = 'Select a property.';
    if (!form.startDate) next.startDate = 'Start date is required.';
    if (form.endDate && form.endDate <= form.startDate) next.endDate = 'End date must be after the start date.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setApiError('');
    try {
      await createRental({
        tenantId: Number(form.tenantId),
        propertyId: Number(form.propertyId),
        startDate: form.startDate,
        endDate: form.endDate || null,
      });
      toast.success('Tenant assigned. The property is now occupied.');
      onAssigned?.();
      onClose();
    } catch (err) {
      setErrors(getFieldErrors(err));
      setApiError(getErrorMessage(err));
      setBusy(false);
    }
  }

  const noChoices = options && options.length === 0;

  return (
    <Modal
      isOpen
      onClose={onClose}
      busy={busy}
      title={choosingTenant ? `Assign a tenant to ${property.propertyName}` : `Assign ${tenant?.firstName} to a property`}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <SubmitButton form="assign-form" busy={busy} busyText="Assigning…" disabled={busy || !options || noChoices}>
            Assign tenant
          </SubmitButton>
        </>
      }
    >
      <form id="assign-form" onSubmit={submit} noValidate className="form-stack">
        {apiError && <div className="form-banner error" role="alert">{apiError}</div>}
        {loadError && <div className="form-banner error" role="alert">{loadError}</div>}
        {!options && !loadError && <Spinner />}

        {noChoices && (
          <div className="form-banner info">
            {choosingTenant ? (
              <span>
                Every tenant already has a home. <Link to="/tenants/new" className="cell-link">Create a new tenant account</Link> instead.
              </span>
            ) : (
              'There are no vacant properties right now. End a rental or add a property first.'
            )}
          </div>
        )}

        {options && !noChoices && (
          <>
            <Field label={choosingTenant ? 'Tenant' : 'Property'} required error={errors[choosingTenant ? 'tenantId' : 'propertyId']}
              hint={choosingTenant ? 'Only active tenants without a current rental are listed.' : 'Only vacant properties are listed.'}>
              <select className="input" value={choosingTenant ? form.tenantId : form.propertyId}
                onChange={set(choosingTenant ? 'tenantId' : 'propertyId')}>
                <option value="">Select…</option>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Start date" required error={errors.startDate}>
                <input type="date" className="input" value={form.startDate} onChange={set('startDate')} />
              </Field>
              <Field label="End date" error={errors.endDate} hint="Optional — leave empty for an open-ended rental.">
                <input type="date" className="input" value={form.endDate} min={form.startDate} onChange={set('endDate')} />
              </Field>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}

/** End an active rental. Rent records stay; the property becomes available. */
export function EndRentalModal({ isOpen, rental, ...props }) {
  return isOpen && rental ? <EndRentalDialog rental={rental} {...props} /> : null;
}

function EndRentalDialog({ onClose, onEnded, rental }) {
  const toast = useToast();
  const [endDate, setEndDate] = useState(todayIso());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!endDate) {
      setError('End date is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await endRental(rental.tenantPropertyId, endDate);
      toast.success('Rental ended. The property is available again.');
      onEnded?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      busy={busy}
      size="sm"
      title="End this rental?"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <SubmitButton form="end-rental-form" busy={busy} busyText="Ending…" className="btn btn-danger">End rental</SubmitButton>
        </>
      }
    >
      <form id="end-rental-form" onSubmit={submit} noValidate className="form-stack">
        <p className="confirm-message">
          <strong>{rental.tenantName}</strong> will be moved out of <strong>{rental.propertyName}</strong> (renting since{' '}
          {formatDate(rental.startDate)}). Their rent history is kept, and the property becomes available for a new tenant.
        </p>
        {error && <div className="form-banner error" role="alert">{error}</div>}
        <Field label="Move-out date" required hint="Today or earlier.">
          <input type="date" className="input" value={endDate} min={rental.startDate} max={todayIso()}
            onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
