import { useState } from 'react';
import Modal from '../../components/common/Modal';
import Field, { SubmitButton } from '../../components/forms/Field';
import PasswordInput from '../../components/PasswordInput';
import { useToast } from '../../context/ToastContext';
import { createUser, updateUser } from '../../services/api.service';
import { EMAIL_PATTERN, PASSWORD_HINT, PASSWORD_PATTERN, PHONE_PATTERN, ROLES } from '../../utils/constants';
import { getErrorMessage, getFieldErrors } from '../../utils/errors';

/**
 * Create a user (user = null) or edit one. Role is chosen at creation and cannot be changed later.
 * The form only exists while the dialog is open, so it always starts from the user's current values.
 */
export default function UserFormModal({ isOpen, ...props }) {
  return isOpen ? <UserFormDialog {...props} /> : null;
}

function UserFormDialog({ onClose, onSaved, user }) {
  const toast = useToast();
  const isNew = !user;
  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    phoneNumber: user?.phoneNumber ?? '',
    role: user?.role ?? 'Tenant',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const found = {};
    if (!form.firstName.trim()) found.firstName = 'First name is required.';
    if (!form.lastName.trim()) found.lastName = 'Last name is required.';
    if (!EMAIL_PATTERN.test(form.email.trim())) found.email = 'Enter a valid email address.';
    if (form.phoneNumber && !PHONE_PATTERN.test(form.phoneNumber.trim())) found.phoneNumber = 'Enter a valid phone number.';
    if ((isNew || form.password) && !PASSWORD_PATTERN.test(form.password)) found.password = PASSWORD_HINT;
    setErrors(found);
    setApiError('');
    if (Object.keys(found).length) return;

    const body = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phoneNumber: form.phoneNumber.trim() || null,
    };

    setBusy(true);
    try {
      if (isNew) {
        const result = await createUser({ ...body, role: form.role, password: form.password });
        toast.success(`${form.role} account created.`);
        onSaved?.(result.userId);
      } else {
        await updateUser(user.userId, { ...body, newPassword: form.password || null });
        toast.success(form.password ? 'User updated and password reset.' : 'User updated.');
        onSaved?.(user.userId);
      }
      onClose();
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      if (fieldErrors.newPassword) fieldErrors.password = fieldErrors.newPassword;
      setErrors(fieldErrors);
      setApiError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      busy={busy}
      size="lg"
      title={isNew ? 'Create user' : `Edit ${user.firstName} ${user.lastName}`}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <SubmitButton form="user-form" busy={busy}>{isNew ? 'Create user' : 'Save changes'}</SubmitButton>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} noValidate>
        {apiError && <div className="form-banner error" role="alert">{apiError}</div>}
        <div className="form-grid">
          <Field label="First name" required error={errors.firstName}>
            <input className="input" value={form.firstName} maxLength={50} onChange={set('firstName')} />
          </Field>
          <Field label="Last name" required error={errors.lastName}>
            <input className="input" value={form.lastName} maxLength={50} onChange={set('lastName')} />
          </Field>
          <Field label="Email" required error={errors.email}>
            <input type="email" className="input" value={form.email} maxLength={150} onChange={set('email')} autoComplete="off" />
          </Field>
          <Field label="Phone" error={errors.phoneNumber}>
            <input type="tel" className="input" value={form.phoneNumber} maxLength={20} onChange={set('phoneNumber')} />
          </Field>
          <Field label="Role" required={isNew} error={errors.role}
            hint={isNew ? 'Cannot be changed after the account is created.' : 'Roles cannot be changed after creation.'}>
            <select className="input" value={form.role} onChange={set('role')} disabled={!isNew}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label={isNew ? 'Password' : 'Reset password'} required={isNew} error={errors.password}
            hint={!errors.password && (isNew ? PASSWORD_HINT : 'Leave empty to keep the current password.')}>
            <PasswordInput value={form.password} onChange={set('password')} hasError={Boolean(errors.password)} autoComplete="new-password" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
