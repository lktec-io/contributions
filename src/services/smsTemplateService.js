import api from './api';

// Saved Custom SMS messages — the server scopes every call to the
// authenticated user, so no client-side filtering is needed or trusted.
export const smsTemplateService = {
  getAll: ()         => api.get('/sms-templates'),
  create: (data)     => api.post('/sms-templates', data),
  update: (id, data) => api.put(`/sms-templates/${id}`, data),
  remove: (id)       => api.delete(`/sms-templates/${id}`),

  // Renders + measures on the server using the same formatter the send path
  // uses, so the counter can never disagree with what Beem receives.
  preview: (message, eventId) =>
    api.post('/sms-templates/preview', { message, eventId }),
};
