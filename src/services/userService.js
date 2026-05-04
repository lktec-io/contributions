import api from './api';

export const userService = {
  getAll:          () => api.get('/users'),
  getHidden:       () => api.get('/users/hidden'),
  getById:         (id) => api.get(`/users/${id}`),
  create:          (data) => api.post('/users', data),
  update:          (id, data) => api.put(`/users/${id}`, data),
  delete:          (id) => api.delete(`/users/${id}`),
  toggleStatus:    (id) => api.put(`/users/${id}/toggle-status`),
  hide:            (id) => api.post(`/users/${id}/hide`),
  restore:         (id) => api.post(`/users/${id}/restore`),
  permanentDelete: (id) => api.delete(`/users/${id}/permanent`),
};
