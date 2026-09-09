import api from './api';

// Saved Custom SMS messages — the server scopes every call to the
// authenticated user, so no client-side filtering is needed or trusted.
export const smsTemplateService = {
  getAll: ()         => api.get('/sms-templates'),
  create: (data)     => api.post('/sms-templates', data),
  update: (id, data) => api.put(`/sms-templates/${id}`, data),
  remove: (id)       => api.delete(`/sms-templates/${id}`),
};
