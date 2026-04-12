import api from './api';

/**
 * SMS service — Africa's Talking reminder system.
 * All API keys are stored server-side only.
 */
export const smsService = {
  /**
   * Send reminder SMS to a single contributor.
   * @param {number|string} contributorId
   */
  sendReminder: (contributorId) =>
    api.post(`/sms/reminder/${contributorId}`),

  /**
   * Send bulk reminders to all unpaid contributors for an event.
   * @param {number|string} eventId
   */
  sendBulkReminders: (eventId) =>
    api.post('/sms/bulk-reminder', { eventId }),
};
