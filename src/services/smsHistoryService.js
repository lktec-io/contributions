import api from './api';

export const smsHistoryService = {
  // params: { page, limit, search, status, type, from, to }
  list:    (params) => api.get('/sms-history', { params }),
  summary: (params) => api.get('/sms-history/summary', { params }),
  getById: (id)     => api.get(`/sms-history/${id}`),
};
