import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import PasswordInput from '../components/PasswordInput';
import BuildingIllustration from '../components/BuildingIllustration';
import { getDashboardPath } from '../routes/roleRoutes';
import './Login.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login, isAuthenticated, user, signOutReason } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Page the user tried to open before being sent to sign in
  const returnTo = location.state?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  function validate() {
    const nextErrors = {};
    if (!email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!password) {
      nextErrors.password = 'Password is required.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setApiError('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const loggedInUser = await login(email.trim(), password);
      navigate(returnTo || getDashboardPath(loggedInUser.role), { replace: true });
    } catch (error) {
      setApiError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-brand">
        <Logo onDark />

        <div className="login-brand-copy">
          <h1>
            Manage properties.
            <br />
            Simplify renting.
          </h1>
          <p>
            One clean workspace for landlords, tenants, and admins — leases, rent, and
            maintenance requests, all in one place.
          </p>
        </div>

        <BuildingIllustration />

        <ul className="login-brand-features">
          <li>Track rent payments and due dates</li>
          <li>Handle maintenance requests with ease</li>
          <li>Role-based access for every user</li>
        </ul>
      </section>

      <section className="login-panel">
        <div className="login-card fade-in-up">
          <header className="login-card-header">
            <h2>Welcome back</h2>
            <p className="text-secondary">Sign in to your RentEase account to continue.</p>
          </header>

          {apiError && (
            <div className="form-banner error" role="alert">
              {apiError}
            </div>
          )}
          {!apiError && signOutReason && (
            <div className="form-banner info" role="status">
              {signOutReason}
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="form-field">
              <label className="form-label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className={`input${errors.email ? ' input-error' : ''}`}
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
              {errors.email && <span className="field-message error">{errors.email}</span>}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <PasswordInput
                id="password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                hasError={Boolean(errors.password)}
                autoComplete="current-password"
              />
              {errors.password && <span className="field-message error">{errors.password}</span>}
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="spinner" /> Signing in…
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>

          <p className="login-register">
            Don&apos;t have an account? <Link to="/register">Sign up</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
