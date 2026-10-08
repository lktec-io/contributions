import api from './api';

export const smsHistoryService = {
  // params: { page, limit, search, status, type, from, to }
  list:    (params) => api.get('/sms-history', { params }),
  summary: (params) => api.get('/sms-history/summary', { params }),
  // days: 7 | 14 | 30 | 90 — aggregated server-side for the dashboard charts
  analytics: (days) => api.get('/sms-history/analytics', { params: { days } }),
  getById: (id)     => api.get(`/sms-history/${id}`),
};
