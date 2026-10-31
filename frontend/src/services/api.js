import axios from 'axios';

export const TOKEN_KEY = 'renteaseToken';
export const USER_KEY = 'renteaseUser';

/** Fired when the API rejects our token, so AuthContext can sign the user out. */
export const SESSION_EXPIRED_EVENT = 'rentease:session-expired';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'https://localhost:7190/api';

const api = axios.create({
  baseURL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 on any call except login itself means the token is missing, expired or revoked
    const isLogin = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLogin && localStorage.getItem(TOKEN_KEY)) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: error.response.data?.message }));
    }
    return Promise.reject(error);
  },
);

export default api;
