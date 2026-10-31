import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { Section } from '../../components/common/Section';
import { EmptyState, Spinner } from '../../components/common/States';
import Field, { SubmitButton } from '../../components/forms/Field';
import { useToast } from '../../context/ToastContext';
import { createComplaint, getComplaintCategories, getRentals } from '../../services/api.service';
import { COMPLAINT_PRIORITIES } from '../../utils/constants';
import { getErrorMessage, getFieldErrors } from '../../utils/errors';

const PRIORITY_HINTS = {
  High: 'Urgent — safety risk, no water or power, major leak.',
  Medium: 'Needs attention soon but the home is usable.',
  Low: 'Minor — can wait for a convenient time.',
};

/** Tenant only: report an issue at the property they currently rent. */
export default function NewComplaintPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [rental, setRental] = useState(undefined); // undefined = loading, null = none
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ categoryId: '', title: '', description: '', priority: 'Medium' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([getRentals({ status: 'Active', pageSize: 1 }), getComplaintCategories()])
      .then(([rentals, cats]) => {
        setRental(rentals.items[0] ?? null);
        setCategories(cats);
      })
      .catch((e) => {
        setRental(null);
        setApiError(getErrorMessage(e));
      });
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const found = {};
    if (!form.categoryId) found.categoryId = 'Choose a category.';
    if (form.title.trim().length < 5) found.title = 'Give the issue a short title (at least 5 characters).';
    if (form.description.trim().length < 10) found.description = 'Describe the problem (at least 10 characters).';
    setErrors(found);
    setApiError('');
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const result = await createComplaint({
        propertyId: rental.propertyId,
        categoryId: Number(form.categoryId),
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
      });
      toast.success('Issue reported. Your landlord has been notified.');
      navigate(`/complaints/${result.complaintId}`, { replace: true });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setApiError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-in-up">
      <PageHeader title="Report an issue" subtitle="Tell your landlord what needs fixing."
        breadcrumbs={[{ label: 'Complaints', to: '/complaints' }]} />

      <Section className="form-card">
        {rental === undefined && <Spinner />}

        {rental === null && (
          <EmptyState icon={Home} title="You don't have an active rental"
            description={apiError || 'You can report issues for the property you currently rent.'} />
        )}

        {rental && (
          <form onSubmit={submit} noValidate className="form-stack">
            {apiError && <div className="form-banner error" role="alert">{apiError}</div>}

            <Field label="Property">
              <input className="input" value={`${rental.propertyName} — ${rental.propertyAddress}`} disabled />
            </Field>

            <div className="form-grid">
              <Field label="Category" required error={errors.categoryId}>
                <select className="input" value={form.categoryId} onChange={set('categoryId')}>
                  <option value="">Select…</option>
                  {categories.map((c) => <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>)}
                </select>
              </Field>

              <Field label="Title" required error={errors.title}>
                <input className="input" value={form.title} maxLength={150} onChange={set('title')} placeholder="e.g. Kitchen tap is leaking" />
              </Field>
            </div>

            <fieldset className="form-field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="form-label">Priority <span className="required-mark" aria-hidden="true">*</span></legend>
              <div className="choice-group">
                {COMPLAINT_PRIORITIES.map((p) => (
                  <label key={p} className="choice">
                    <input type="radio" name="priority" value={p} checked={form.priority === p} onChange={set('priority')} />
                    <span>{p}</span>
                  </label>
                ))}
              </div>
              <span className="field-message hint">{PRIORITY_HINTS[form.priority]}</span>
            </fieldset>

            <Field label="Description" required error={errors.description} hint={`${form.description.length}/1000`}>
              <textarea className="input" value={form.description} maxLength={1000} onChange={set('description')}
                placeholder="What is wrong, where is it, and since when?" />
            </Field>

            <div className="form-actions">
              <Link to="/complaints" className="btn btn-ghost">Cancel</Link>
              <SubmitButton busy={busy} busyText="Submitting…">Submit</SubmitButton>
            </div>
          </form>
        )}
      </Section>
    </div>
  );
}
