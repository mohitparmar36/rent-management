import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService';
import { SESSION_EXPIRED_EVENT, TOKEN_KEY, USER_KEY } from '../services/api';

const AuthContext = createContext(null);

const MAX_TIMER_MS = 2_147_483_647;

/*
 * Session storage strategy
 * ------------------------
 * The JWT is kept in localStorage so a page refresh keeps the user signed in.
 * Trade-off: any script running on the page could read it, so the app must not
 * render untrusted HTML (React escapes text by default and we never use
 * dangerouslySetInnerHTML). The token expires after 8 hours, the API re-checks
 * that the account is still active on every request, and we sign out as soon
 * as the API answers 401. See README → Security notes.
 */

function readStoredSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  const storedUser = localStorage.getItem(USER_KEY);
  if (!token || !storedUser) return null;

  const expiresAt = authService.getTokenExpiry(token);
  if (!expiresAt || expiresAt <= Date.now()) return null;

  try {
    return { user: JSON.parse(storedUser), expiresAt };
  } catch {
    return null;
  }
}

function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const stored = readStoredSession();
    if (!stored) clearStoredSession();
    return stored;
  });
  // Why the user was signed out (shown on the login page), e.g. "session expired"
  const [signOutReason, setSignOutReason] = useState('');

  const logout = useCallback((reason = '') => {
    clearStoredSession();
    setSession(null);
    setSignOutReason(reason);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authService.login(email, password);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setSession({ user: data.user, expiresAt: authService.getTokenExpiry(data.token) });
    setSignOutReason('');
    return data.user;
  }, []);

  /** Keeps the header in sync after the user edits their own name. */
  const updateSessionUser = useCallback((changes) => {
    setSession((current) => {
      if (!current) return current;
      const user = { ...current.user, ...changes };
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return { ...current, user };
    });
  }, []);

  // On first load, confirm the stored token with the API (it may have been
  // revoked by deactivating the account). A 401 triggers SESSION_EXPIRED_EVENT.
  const hasSession = Boolean(session);
  useEffect(() => {
    if (!hasSession) return;
    // A failure here is handled by the 401 interceptor; other errors (API down) keep the session
    authService.getCurrentUser().then(updateSessionUser).catch(() => {});
  }, [hasSession, updateSessionUser]);

  // The API rejected our token
  useEffect(() => {
    function handleExpired(event) {
      logout(event.detail || 'Your session has expired. Please sign in again.');
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, [logout]);

  // Sign out exactly when the token expires, even if the user is idle
  const expiresAt = session?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return undefined;
    // Browsers fire timers longer than ~24.8 days (2^31 ms) immediately, so cap the delay;
    // if the cap is reached first the effect simply re-arms on the next sign-in or reload.
    const delay = Math.min(Math.max(0, expiresAt - Date.now()), MAX_TIMER_MS);
    const timer = setTimeout(() => {
      if (Date.now() >= expiresAt) logout('Your session has expired. Please sign in again.');
    }, delay);
    return () => clearTimeout(timer);
  }, [expiresAt, logout]);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      isLoading: false,
      signOutReason,
      login,
      logout,
      updateSessionUser,
    }),
    [session, signOutReason, login, logout, updateSessionUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
