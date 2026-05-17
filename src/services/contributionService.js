import api from './api';

export const contributionService = {
  getAll: (params) => api.get('/contributions', { params }),
  getById: (id) => api.get(`/contributions/${id}`),
  create: (data) => api.post('/contributions', data),
  createBulk: (data) => api.post('/contributions/bulk', data),
  update: (id, data) => api.put(`/contributions/${id}`, data),
  delete:          (id) => api.delete(`/contributions/${id}`),
  hide:            (id) => api.post(`/contributions/${id}/hide`),
  restore:         (id) => api.post(`/contributions/${id}/restore`),
  permanentDelete: (id) => api.delete(`/contributions/${id}/permanent`),
  getHidden:       ()   => api.get('/contributions/hidden'),
};
