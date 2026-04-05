import api from './api';

export const paymentService = {
  create: (data) => api.post('/payments', data),
  getByContribution: (contributionId) => api.get(`/payments/${contributionId}`),
};
