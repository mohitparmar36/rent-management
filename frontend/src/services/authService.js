import api from './api';

const GENERIC_ERROR = 'Invalid email or password.';

export async function login(email, password) {
  try {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  } catch (error) {
    if (!error.response) {
      throw new Error('Cannot reach the RentEase server. Check that the API is running and try again.');
    }
    throw new Error(error.response.data?.message || GENERIC_ERROR);
  }
}

/** Confirms the stored token is still valid and returns the current user. */
export async function getCurrentUser() {
  const { data } = await api.get('/auth/me');
  return data;
}

/** Reads the expiry time (ms since epoch) from a JWT without verifying it — the API does that. */
export function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
