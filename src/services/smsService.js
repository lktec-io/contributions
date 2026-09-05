import api from './api';

export const smsService = {
  // type: omit for the normal reminder window, 'custom' for Type One SMS
  getBulkStatus: (type) =>
    api.get('/sms/bulk-status', type ? { params: { type } } : undefined),

  sendReminder: (contributorId) =>
    api.post(`/sms/reminder/${contributorId}`),

  // customMessage is optional; without it this is the normal reminder dispatch
  sendBulkReminders: (eventId, customMessage) =>
    api.post('/sms/bulk-reminder', customMessage ? { eventId, customMessage } : { eventId }),
};
