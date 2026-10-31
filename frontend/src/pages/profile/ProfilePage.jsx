import { useState } from 'react';
import { Lock, Mail } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { DetailList, Section } from '../../components/common/Section';
import { ErrorState, PageSkeleton } from '../../components/common/States';
import Field, { SubmitButton } from '../../components/forms/Field';
import PasswordInput from '../../components/PasswordInput';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../hooks/useAsync';
import { changePassword, getProfile, updateProfile } from '../../services/api.service';
import { PASSWORD_HINT, PASSWORD_PATTERN, PHONE_PATTERN } from '../../utils/constants';
import { getErrorMessage, getFieldErrors } from '../../utils/errors';
import { formatDateTime, initials } from '../../utils/format';

export default function ProfilePage() {
  const { data: profile, loading, error, reload, setData } = useAsync(getProfile, []);

  if (loading && !profile) return <PageSkeleton cards={0} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="fade-in-up">
      <PageHeader title="My profile" subtitle="Your personal details and password." />

      <div className="card hero">
        <span className="avatar avatar-lg" aria-hidden="true">{initials(profile)}</span>
        <div className="hero-main">
          <div className="hero-title">{profile.firstName} {profile.lastName} <StatusBadge status={profile.role} /></div>
          <p className="hero-sub">{profile.email}</p>
        </div>
      </div>

      <div className="grid-main-side">
        <div className="stack">
          <DetailsForm profile={profile} onSaved={setData} />
          <PasswordForm />
        </div>
        <Section title="Account">
          <DetailList
            columns={1}
            items={[
              { label: 'Email', value: <><Mail size={13} /> {profile.email}</> },
              { label: 'Role', value: profile.role },
              { label: 'Member since', value: formatDateTime(profile.createdAt) },
              { label: 'Last sign-in', value: profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : '—' },
            ]}
          />
          <p className="notice mt-20">Your email address and role can only be changed by an administrator.</p>
        </Section>
      </div>
    </div>
  );
}

function DetailsForm({ profile, onSaved }) {
  const toast = useToast();
  const { updateSessionUser } = useAuth();
  // Starts from the loaded profile; after saving, the form already holds the saved values
  const [form, setForm] = useState({
    firstName: profile.firstName, lastName: profile.lastName, phoneNumber: profile.phoneNumber ?? '',
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const unchanged = form.firstName === profile.firstName && form.lastName === profile.lastName
    && form.phoneNumber === (profile.phoneNumber ?? '');

  async function submit(e) {
    e.preventDefault();
    const found = {};
    if (!form.firstName.trim()) found.firstName = 'First name is required.';
    if (!form.lastName.trim()) found.lastName = 'Last name is required.';
    if (form.phoneNumber && !PHONE_PATTERN.test(form.phoneNumber.trim())) found.phoneNumber = 'Enter a valid phone number.';
    setErrors(found);
    setApiError('');
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const updated = await updateProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phoneNumber: form.phoneNumber.trim() || null,
      });
      onSaved(updated);
      updateSessionUser({ firstName: updated.firstName, lastName: updated.lastName });
      toast.success('Profile updated.');
    } catch (err) {
      setErrors(getFieldErrors(err));
      setApiError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Personal details">
      <form onSubmit={submit} noValidate>
        {apiError && <div className="form-banner error" role="alert">{apiError}</div>}
        <div className="form-grid">
          <Field label="First name" required error={errors.firstName}>
            <input className="input" value={form.firstName} maxLength={50} onChange={set('firstName')} autoComplete="given-name" />
          </Field>
          <Field label="Last name" required error={errors.lastName}>
            <input className="input" value={form.lastName} maxLength={50} onChange={set('lastName')} autoComplete="family-name" />
          </Field>
          <Field label="Phone" error={errors.phoneNumber} className="span-2">
            <input type="tel" className="input" value={form.phoneNumber} maxLength={20} onChange={set('phoneNumber')} autoComplete="tel" />
          </Field>
        </div>
        <div className="form-actions">
          <SubmitButton busy={busy} disabled={busy || unchanged}>Save changes</SubmitButton>
        </div>
      </form>
    </Section>
  );
}

function PasswordForm() {
  const toast = useToast();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const found = {};
    if (!form.current) found.current = 'Enter your current password.';
    if (!PASSWORD_PATTERN.test(form.next)) found.next = PASSWORD_HINT;
    else if (form.next === form.current) found.next = 'Choose a password different from your current one.';
    if (form.confirm !== form.next) found.confirm = 'The passwords do not match.';
    setErrors(found);
    setApiError('');
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      await changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      toast.success('Password changed. Use your new password next time you sign in.');
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      setErrors({ current: fieldErrors.currentPassword, next: fieldErrors.newPassword });
      setApiError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Change password" description="You'll need your current password.">
      <form onSubmit={submit} noValidate>
        {apiError && <div className="form-banner error" role="alert">{apiError}</div>}
        <div className="form-grid">
          <Field label="Current password" required error={errors.current} className="span-2">
            <PasswordInput value={form.current} onChange={set('current')} hasError={Boolean(errors.current)} autoComplete="current-password" />
          </Field>
          <Field label="New password" required error={errors.next} hint={!errors.next && PASSWORD_HINT}>
            <PasswordInput value={form.next} onChange={set('next')} hasError={Boolean(errors.next)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password" required error={errors.confirm}>
            <PasswordInput value={form.confirm} onChange={set('confirm')} hasError={Boolean(errors.confirm)} autoComplete="new-password" />
          </Field>
        </div>
        <div className="form-actions">
          <SubmitButton busy={busy} busyText="Changing…"><Lock size={15} /> Change password</SubmitButton>
        </div>
      </form>
    </Section>
  );
}
