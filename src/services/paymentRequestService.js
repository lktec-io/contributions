import api from './api';

export const paymentRequestService = {
  getAll: (status) =>
    api.get('/payment-requests', { params: status ? { status } : {} }),

  approve: (id) =>
    api.post(`/payment-requests/${id}/approve`),

  reject: (id) =>
    api.post(`/payment-requests/${id}/reject`),

  remove: (id) =>
    api.delete(`/payment-requests/${id}`),
};
