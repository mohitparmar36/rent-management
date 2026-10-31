import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Info } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { Section } from '../../components/common/Section';
import { Spinner } from '../../components/common/States';
import Field, { SubmitButton } from '../../components/forms/Field';
import { useToast } from '../../context/ToastContext';
import { createRentPayment, getRentals } from '../../services/api.service';
import { getErrorMessage, getFieldErrors } from '../../utils/errors';
import { currentMonthIso, formatMoney } from '../../utils/format';

/** /rent/new?rental=<id> pre-selects a rental. */
export default function RentFormPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [rentals, setRentals] = useState(null);
  const [form, setForm] = useState({
    tenantPropertyId: searchParams.get('rental') ?? '',
    billingMonth: currentMonthIso(),
    amount: '',
    dueDate: `${currentMonthIso()}-01`,
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRentals({ status: 'Active', pageSize: 100, sortBy: 'property' })
      .then((page) => {
        setRentals(page.items);
        // Default the amount to the property's monthly rent
        const selected = page.items.find((r) => String(r.tenantPropertyId) === String(searchParams.get('rental')));
        if (selected) setForm((f) => ({ ...f, amount: String(selected.monthlyRent) }));
      })
      .catch((e) => setApiError(getErrorMessage(e, 'Could not load your active rentals.')));
  }, [searchParams]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function onRentalChange(e) {
    const value = e.target.value;
    const rental = rentals.find((r) => String(r.tenantPropertyId) === value);
    setForm((f) => ({ ...f, tenantPropertyId: value, amount: rental ? String(rental.monthlyRent) : f.amount }));
  }

  function onMonthChange(e) {
    const month = e.target.value;
    // Keep the due date on the 1st of the chosen month unless the user changed it
    setForm((f) => ({ ...f, billingMonth: month, dueDate: f.dueDate === `${f.billingMonth}-01` && month ? `${month}-01` : f.dueDate }));
  }

  async function submit(e) {
    e.preventDefault();
    const found = {};
    if (!form.tenantPropertyId) found.tenantPropertyId = 'Choose a rental.';
    if (!/^\d{4}-\d{2}$/.test(form.billingMonth)) found.billingMonth = 'Choose the month being billed.';
    const amount = Number(form.amount);
    if (form.amount === '' || !Number.isFinite(amount) || amount < 1) found.amount = 'Enter an amount of at least 1.';
    if (!form.dueDate) found.dueDate = 'Due date is required.';
    setErrors(found);
    setApiError('');
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const result = await createRentPayment({
        tenantPropertyId: Number(form.tenantPropertyId),
        billingMonth: form.billingMonth,
        amount,
        dueDate: form.dueDate,
        notes: form.notes.trim() || null,
      });
      toast.success('Rent record created. The tenant has been notified.');
      navigate(`/rent/${result.paymentId}`, { replace: true });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setApiError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const selected = rentals?.find((r) => String(r.tenantPropertyId) === String(form.tenantPropertyId));

  return (
    <div className="fade-in-up">
      <PageHeader title="Add rent record" subtitle="Bill one month's rent for an active rental."
        breadcrumbs={[{ label: 'Rent', to: '/rent' }]} />

      <Section className="form-card">
        {!rentals && !apiError && <Spinner label="Loading your rentals…" />}
        {rentals && rentals.length === 0 && (
          <p className="notice">
            <Info size={16} aria-hidden="true" />
            You have no active rentals. Assign a tenant to a property first.
          </p>
        )}

        {apiError && <div className="form-banner error mb-20" role="alert">{apiError}</div>}

        {rentals && rentals.length > 0 && (
          <form onSubmit={submit} noValidate>
            <div className="form-grid">
              <Field label="Rental" required error={errors.tenantPropertyId} className="span-2">
                <select className="input" value={form.tenantPropertyId} onChange={onRentalChange}>
                  <option value="">Select tenant and property…</option>
                  {rentals.map((r) => (
                    <option key={r.tenantPropertyId} value={r.tenantPropertyId}>
                      {r.tenantName} — {r.propertyName}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Billing month" required error={errors.billingMonth} hint="Each rental can be billed once per month.">
                <input type="month" className="input" value={form.billingMonth} onChange={onMonthChange} />
              </Field>

              <Field label="Amount (USD)" required error={errors.amount}
                hint={selected && `Monthly rent for this property: ${formatMoney(selected.monthlyRent)}`}>
                <input type="number" inputMode="decimal" min="1" step="0.01" className="input" value={form.amount} onChange={set('amount')} />
              </Field>

              <Field label="Due date" required error={errors.dueDate}>
                <input type="date" className="input" value={form.dueDate} onChange={set('dueDate')} />
              </Field>

              <Field label="Notes" error={errors.notes} hint="Optional">
                <input className="input" value={form.notes} maxLength={250} onChange={set('notes')} />
              </Field>
            </div>

            <div className="form-actions">
              <Link to="/rent" className="btn btn-ghost">Cancel</Link>
              <SubmitButton busy={busy} busyText="Creating…">Create rent record</SubmitButton>
            </div>
          </form>
        )}
      </Section>
    </div>
  );
}
