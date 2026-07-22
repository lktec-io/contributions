import api from './api';

export const publicService = {
  getContribution: (token) =>
    api.get(`/public/contributions/${token}`),

  submitPaymentRequest: (token, data) =>
    api.post(`/public/contributions/${token}/payment-request`, data),
};
