import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '';

export const AUTH_STORAGE_KEYS = {
  token: 'auth_token',
  user: 'auth_user',
  permissions: 'permissions',
  deviceId: 'device_id',
} as const;

export function clearAuthStorage() {
  Object.values(AUTH_STORAGE_KEYS).forEach((key) => {
    if (key !== AUTH_STORAGE_KEYS.deviceId) localStorage.removeItem(key);
  });
}

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const token = localStorage.getItem(AUTH_STORAGE_KEYS.token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url = error.config?.url as string | undefined;
    const isLoginRequest = url === '/api/v1/auth/login';

    if (isLoginRequest && error.response?.data) {
      return Promise.reject(error.response.data);
    }

    if (!error.response) {
      return Promise.reject(error);
    }

    if (error.response.status === 403) {
      const message = (
        error.response.data as { response_schema?: { response_message?: string } } | undefined
      )?.response_schema?.response_message;
      window.dispatchEvent(new CustomEvent('api-forbidden', { detail: { message } }));
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);

export default api;
