import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Section } from '../../components/common/Section';
import { ErrorState, PageSkeleton } from '../../components/common/States';
import Field, { SubmitButton } from '../../components/forms/Field';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { createProperty, getProperty, getUsers, updateProperty } from '../../services/api.service';
import { PROPERTY_TYPES } from '../../utils/constants';
import { getErrorMessage, getFieldErrors } from '../../utils/errors';

const EMPTY = {
  propertyName: '', propertyType: '', address: '', city: '', state: '', postalCode: '',
  monthlyRent: '', status: 'Available', description: '', landlordId: '',
};

function validate(form, isAdmin, isNew) {
  const e = {};
  if (!form.propertyName.trim()) e.propertyName = 'Property name is required.';
  if (!form.propertyType) e.propertyType = 'Choose a property type.';
  if (!form.address.trim()) e.address = 'Address is required.';
  if (!form.city.trim()) e.city = 'City is required.';
  if (!form.state.trim()) e.state = 'State is required.';
  if (form.postalCode && !/^[A-Za-z0-9\- ]{3,10}$/.test(form.postalCode.trim())) e.postalCode = 'Use 3 to 10 letters or digits.';
  const rent = Number(form.monthlyRent);
  if (form.monthlyRent === '') e.monthlyRent = 'Monthly rent is required.';
  else if (!Number.isFinite(rent) || rent < 1 || rent > 10_000_000) e.monthlyRent = 'Enter an amount between 1 and 10,000,000.';
  if (isAdmin && isNew && !form.landlordId) e.landlordId = 'Choose the owner.';
  return e;
}

/** Add (/properties/new) and edit (/properties/:id/edit) share this form. */
export default function PropertyFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user.role === 'Admin';

  const [form, setForm] = useState(EMPTY);
  const [isOccupied, setIsOccupied] = useState(false);
  const [landlords, setLandlords] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    getProperty(id)
      .then((p) => {
        setForm({
          propertyName: p.propertyName, propertyType: p.propertyType, address: p.address, city: p.city,
          state: p.state, postalCode: p.postalCode ?? '', monthlyRent: String(p.monthlyRent), status: p.status,
          description: p.description ?? '', landlordId: String(p.landlordId),
        });
        setIsOccupied(p.status === 'Occupied');
      })
      .catch((e) => setLoadError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  useEffect(() => {
    if (!isAdmin || !isNew) return;
    getUsers({ role: 'Landlord', isActive: true, pageSize: 100, sortBy: 'name' })
      .then((page) => setLandlords(page.items))
      .catch((e) => setApiError(getErrorMessage(e, 'Could not load landlords.')));
  }, [isAdmin, isNew]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const found = validate(form, isAdmin, isNew);
    setErrors(found);
    setApiError('');
    if (Object.keys(found).length) return;

    const body = {
      ...form,
      propertyName: form.propertyName.trim(),
      postalCode: form.postalCode.trim() || null,
      description: form.description.trim() || null,
      monthlyRent: Number(form.monthlyRent),
      landlordId: form.landlordId ? Number(form.landlordId) : null,
    };

    setBusy(true);
    try {
      if (isNew) {
        const result = await createProperty(body);
        toast.success('Property added.');
        navigate(`/properties/${result.propertyId}`, { replace: true });
      } else {
        await updateProperty(id, body);
        toast.success('Changes saved.');
        navigate(`/properties/${id}`);
      }
    } catch (err) {
      setErrors(getFieldErrors(err));
      setApiError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PageSkeleton cards={0} rows={8} />;
  if (loadError) return <ErrorState message={loadError} />;

  const title = isNew ? 'Add property' : `Edit ${form.propertyName}`;
  const breadcrumbs = [{ label: 'Properties', to: '/properties' }, ...(!isNew ? [{ label: form.propertyName, to: `/properties/${id}` }] : [])];

  return (
    <div className="fade-in-up">
      <PageHeader title={title} breadcrumbs={breadcrumbs} />

      <Section className="form-card">
        <form onSubmit={submit} noValidate>
          {apiError && <div className="form-banner error" role="alert">{apiError}</div>}

          <div className="form-grid">
            {isAdmin && isNew && (
              <Field label="Owner (landlord)" required error={errors.landlordId} className="span-2">
                <select className="input" value={form.landlordId} onChange={set('landlordId')}>
                  <option value="">Select a landlord…</option>
                  {landlords.map((l) => (
                    <option key={l.userId} value={l.userId}>{l.firstName} {l.lastName} ({l.email})</option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Property name" required error={errors.propertyName} className="span-2">
              <input className="input" value={form.propertyName} maxLength={150} onChange={set('propertyName')}
                placeholder="e.g. Greenwood Apartments 2B" />
            </Field>

            <Field label="Property type" required error={errors.propertyType}>
              <select className="input" value={form.propertyType} onChange={set('propertyType')}>
                <option value="">Select…</option>
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Monthly rent (USD)" required error={errors.monthlyRent}>
              <input type="number" inputMode="decimal" min="1" step="0.01" className="input" value={form.monthlyRent}
                onChange={set('monthlyRent')} placeholder="1200" />
            </Field>

            <Field label="Street address" required error={errors.address} className="span-2">
              <input className="input" value={form.address} maxLength={250} onChange={set('address')} autoComplete="street-address" />
            </Field>

            <Field label="City" required error={errors.city}>
              <input className="input" value={form.city} maxLength={100} onChange={set('city')} />
            </Field>

            <Field label="State" required error={errors.state}>
              <input className="input" value={form.state} maxLength={100} onChange={set('state')} />
            </Field>

            <Field label="Postal code" error={errors.postalCode}>
              <input className="input" value={form.postalCode} maxLength={10} onChange={set('postalCode')} autoComplete="postal-code" />
            </Field>

            <Field label="Status" required error={errors.status}
              hint={isOccupied ? 'Occupied while a tenant is assigned. End the rental to change it.' : 'Becomes Occupied automatically when you assign a tenant.'}>
              {isOccupied ? (
                <select className="input" value="Occupied" disabled><option>Occupied</option></select>
              ) : (
                <select className="input" value={form.status} onChange={set('status')}>
                  <option value="Available">Available</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              )}
            </Field>

            <Field label="Description" error={errors.description} className="span-2" hint={`${form.description.length}/500`}>
              <textarea className="input" value={form.description} maxLength={500} onChange={set('description')}
                placeholder="Bedrooms, amenities, parking…" />
            </Field>
          </div>

          <div className="form-actions">
            <Link to={isNew ? '/properties' : `/properties/${id}`} className="btn btn-ghost">Cancel</Link>
            <SubmitButton busy={busy}>{isNew ? 'Add property' : 'Save changes'}</SubmitButton>
          </div>
        </form>
      </Section>
    </div>
  );
}
