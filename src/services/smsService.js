import api from './api';

export const smsService = {
  // Returns { canSend, daysRemaining, smsMode, role } — one shared 7-day window
  getBulkStatus: () =>
    api.get('/sms/bulk-status'),

  sendReminder: (contributorId) =>
    api.post(`/sms/reminder/${contributorId}`),

  // customMessage is optional; without it this is the normal reminder dispatch
  sendBulkReminders: (eventId, customMessage) =>
    api.post('/sms/bulk-reminder', customMessage ? { eventId, customMessage } : { eventId }),

  // Individual Custom SMS to one member — cooldown applies to that member only.
  // eventId only: the server resolves the event name after an ownership check.
  sendMemberSms: (memberId, { message, eventId }) =>
    api.post(`/sms/member/${memberId}`, { message, eventId }),

  // Send Custom SMS to all owned members. Recipients are resolved server-side
  // from ownership; the campaign has its own 7-day window.
  sendCustomCampaign: ({ message, eventId }) =>
    api.post('/sms/members/campaign', { message, eventId }),
};
