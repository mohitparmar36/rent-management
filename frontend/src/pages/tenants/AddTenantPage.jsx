import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { Section } from '../../components/common/Section';
import Field, { SubmitButton } from '../../components/forms/Field';
import PasswordInput from '../../components/PasswordInput';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { createTenant, getProperties } from '../../services/api.service';
import { EMAIL_PATTERN, PASSWORD_HINT, PASSWORD_PATTERN, PHONE_PATTERN } from '../../utils/constants';
import { getErrorMessage, getFieldErrors } from '../../utils/errors';
import { formatMoney, todayIso } from '../../utils/format';

/**
 * Creates a tenant account. Landlords must assign the tenant to one of their
 * vacant properties at the same time (otherwise the tenant would not be linked
 * to them); admins may create an unassigned tenant.
 */
export default function AddTenantPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const assignmentRequired = user.role === 'Landlord';

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phoneNumber: '', password: '',
    propertyId: '', startDate: todayIso(), endDate: '',
  });
  const [properties, setProperties] = useState(null);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getProperties({ status: 'Available', pageSize: 100, sortBy: 'name' })
      .then((page) => setProperties(page.items))
      .catch((e) => setApiError(getErrorMessage(e, 'Could not load your vacant properties.')));
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function validate() {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required.';
    if (!form.lastName.trim()) e.lastName = 'Last name is required.';
    if (!EMAIL_PATTERN.test(form.email.trim())) e.email = 'Enter a valid email address.';
    if (form.phoneNumber && !PHONE_PATTERN.test(form.phoneNumber.trim())) e.phoneNumber = 'Enter a valid phone number.';
    if (!PASSWORD_PATTERN.test(form.password)) e.password = PASSWORD_HINT;
    if (assignmentRequired && !form.propertyId) e.propertyId = 'Choose the property this tenant will rent.';
    if (form.propertyId && !form.startDate) e.startDate = 'Start date is required.';
    if (form.propertyId && form.endDate && form.endDate <= form.startDate) e.endDate = 'End date must be after the start date.';
    return e;
  }

  async function submit(e) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setApiError('');
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const result = await createTenant({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim() || null,
        password: form.password,
        propertyId: form.propertyId ? Number(form.propertyId) : null,
        startDate: form.propertyId ? form.startDate : null,
        endDate: form.propertyId && form.endDate ? form.endDate : null,
      });
      toast.success(result.assignmentId ? 'Tenant account created and assigned.' : 'Tenant account created.');
      navigate(`/tenants/${result.userId}`, { replace: true });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setApiError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const noVacancies = properties && properties.length === 0;

  return (
    <div className="fade-in-up">
      <PageHeader
        title="Add tenant"
        subtitle="Create a sign-in for your tenant and move them into a property."
        breadcrumbs={[{ label: 'Tenants', to: '/tenants' }]}
      />

      <form onSubmit={submit} noValidate className="form-card">
        {apiError && <div className="form-banner error mb-20" role="alert">{apiError}</div>}

        <Section title="Account" description="The tenant signs in with this email and password, and can change the password later.">
          <div className="form-grid">
            <Field label="First name" required error={errors.firstName}>
              <input className="input" value={form.firstName} maxLength={50} onChange={set('firstName')} autoComplete="off" />
            </Field>
            <Field label="Last name" required error={errors.lastName}>
              <input className="input" value={form.lastName} maxLength={50} onChange={set('lastName')} autoComplete="off" />
            </Field>
            <Field label="Email" required error={errors.email}>
              <input type="email" className="input" value={form.email} maxLength={150} onChange={set('email')} autoComplete="off" />
            </Field>
            <Field label="Phone" error={errors.phoneNumber}>
              <input type="tel" className="input" value={form.phoneNumber} maxLength={20} onChange={set('phoneNumber')} autoComplete="off" />
            </Field>
            <Field label="Temporary password" required error={errors.password} hint={!errors.password && PASSWORD_HINT} className="span-2">
              <PasswordInput value={form.password} onChange={set('password')} hasError={Boolean(errors.password)} autoComplete="new-password" />
            </Field>
          </div>
        </Section>

        <Section
          title="Rental"
          description={assignmentRequired ? 'Choose which of your vacant properties the tenant is moving into.' : 'Optional — you can also assign a property later.'}
        >
          {noVacancies ? (
            <p className="notice">
              <Info size={16} aria-hidden="true" />
              {assignmentRequired
                ? 'You have no vacant properties. End a rental or add a property before adding a new tenant.'
                : 'There are no vacant properties right now, so the tenant will be created without a rental.'}
            </p>
          ) : (
            <div className="form-grid">
              <Field label="Property" required={assignmentRequired} error={errors.propertyId} className="span-2">
                <select className="input" value={form.propertyId} onChange={set('propertyId')} disabled={!properties}>
                  <option value="">{properties ? 'Select a vacant property…' : 'Loading…'}</option>
                  {properties?.map((p) => (
                    <option key={p.propertyId} value={p.propertyId}>
                      {p.propertyName} — {formatMoney(p.monthlyRent)}/mo{user.role === 'Admin' ? ` (${p.landlordName})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              {form.propertyId && (
                <>
                  <Field label="Start date" required error={errors.startDate}>
                    <input type="date" className="input" value={form.startDate} onChange={set('startDate')} />
                  </Field>
                  <Field label="End date" error={errors.endDate} hint="Optional">
                    <input type="date" className="input" value={form.endDate} min={form.startDate} onChange={set('endDate')} />
                  </Field>
                </>
              )}
            </div>
          )}

          <div className="form-actions">
            <Link to="/tenants" className="btn btn-ghost">Cancel</Link>
            <SubmitButton busy={busy} busyText="Creating…" disabled={busy || (assignmentRequired && noVacancies)}>
              Create tenant
            </SubmitButton>
          </div>
        </Section>
      </form>
    </div>
  );
}
