import api, { unwrap } from './client.js';

export const authApi = {
  login: (data) => api.post('/auth/login', data).then(unwrap),
  logout: () => api.post('/auth/logout').then(unwrap),
  me: () => api.get('/auth/me').then(unwrap),
  changePassword: (data) => api.patch('/auth/password', data).then(unwrap),
};

export const usersApi = {
  list: (params) => api.get('/users', { params }).then(unwrap),
  get: (id) => api.get(`/users/${id}`).then(unwrap),
  create: (data) => api.post('/users', data).then(unwrap),
  update: (id, data) => api.patch(`/users/${id}`, data).then(unwrap),
  setActive: (id, active) => api.patch(`/users/${id}/active`, { active }).then(unwrap),
  resetPassword: (id, password) => api.patch(`/users/${id}/password`, { password }).then(unwrap),
};

export const categoriesApi = {
  list: (params) => api.get('/categories', { params }).then(unwrap),
  get: (id) => api.get(`/categories/${id}`).then(unwrap),
  create: (data) => api.post('/categories', data).then(unwrap),
  update: (id, data) => api.patch(`/categories/${id}`, data).then(unwrap),
  setActive: (id, active) => api.patch(`/categories/${id}/active`, { active }).then(unwrap),
  remove: (id) => api.delete(`/categories/${id}`).then(unwrap),
};

export const suppliersApi = {
  list: (params) => api.get('/suppliers', { params }).then(unwrap),
  get: (id) => api.get(`/suppliers/${id}`).then(unwrap),
  products: (id) => api.get(`/suppliers/${id}/products`).then(unwrap),
  create: (data) => api.post('/suppliers', data).then(unwrap),
  update: (id, data) => api.patch(`/suppliers/${id}`, data).then(unwrap),
  setActive: (id, active) => api.patch(`/suppliers/${id}/active`, { active }).then(unwrap),
  remove: (id) => api.delete(`/suppliers/${id}`).then(unwrap),
};

export const productsApi = {
  list: (params) => api.get('/products', { params }).then(unwrap),
  get: (id) => api.get(`/products/${id}`).then(unwrap),
  history: (id) => api.get(`/products/${id}/movements`).then(unwrap),
  create: (data) => api.post('/products', data).then(unwrap),
  update: (id, data) => api.patch(`/products/${id}`, data).then(unwrap),
  setActive: (id, active) => api.patch(`/products/${id}/active`, { active }).then(unwrap),
  setAlertSettings: (id, data) => api.patch(`/products/${id}/alert-settings`, data).then(unwrap),
  remove: (id) => api.delete(`/products/${id}`).then(unwrap),
};

export const movementsApi = {
  list: (params) => api.get('/movements', { params }).then(unwrap),
  get: (id) => api.get(`/movements/${id}`).then(unwrap),
  entry: (data) => api.post('/movements/in', data).then(unwrap),
  exit: (data) => api.post('/movements/out', data).then(unwrap),
};

export const alertsApi = {
  summary: () => api.get('/alerts/summary').then(unwrap),
  list: (params) => api.get('/alerts', { params }).then(unwrap),
  detail: (id) => api.get(`/alerts/${id}`).then(unwrap),
};

export const indicatorsApi = {
  summary: (days) => api.get('/indicators/summary', { params: { days } }).then(unwrap),
  coverage: (params) => api.get('/indicators/coverage', { params }).then(unwrap),
  topProducts: (days) => api.get('/indicators/top-products', { params: { days } }).then(unwrap),
};

export const dashboardApi = {
  get: (days = 30) => api.get('/dashboard', { params: { days } }).then(unwrap),
};

export const aiApi = {
  insights: (params) => api.get('/ia/insights', { params }).then(unwrap),
  status: () => api.get('/ia/status').then(unwrap),
  chat: (data) => api.post('/ia/chat', data).then(unwrap),
};

export const reportsApi = {
  catalog: () => api.get('/reports').then(unwrap),
  get: (name, params) => api.get(`/reports/${name}`, { params: { ...params, format: 'json' } }).then(unwrap),
  download: (name, params, format) => api.get(`/reports/${name}`, {
    params: { ...params, format },
    responseType: 'blob',
  }).then((response) => response.data),
};
