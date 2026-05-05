import api from './api';

export const smsService = {
  getBulkStatus: () =>
    api.get('/sms/bulk-status'),

  sendReminder: (contributorId) =>
    api.post(`/sms/reminder/${contributorId}`),

  sendBulkReminders: (eventId) =>
    api.post('/sms/bulk-reminder', { eventId }),
};
