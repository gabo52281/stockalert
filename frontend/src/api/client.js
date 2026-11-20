import axios from 'axios';

const TOKEN_KEY = 'stockalert_token';

const api = axios.create({
  // Relativo: funciona igual con el proxy de Vite que con Vercel (mismo dominio).
  baseURL: '/api',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLogin = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLogin) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event('stockalert:unauthorized'));
    }
    return Promise.reject(error);
  },
);

export const unwrap = (response) => response.data;

export function errorMessage(error) {
  return error?.response?.data?.error?.message
    || error?.message
    || 'Ocurrió un error inesperado';
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function hasToken() {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}

export default api;
