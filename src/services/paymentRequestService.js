import api from './api';
import { downloadBlob, filenameFromDisposition } from '../utils/downloadBlob';

export const paymentRequestService = {
  getAll: (status) =>
    api.get('/payment-requests', { params: status ? { status } : {} }),

  approve: (id) =>
    api.post(`/payment-requests/${id}/approve`),

  reject: (id) =>
    api.post(`/payment-requests/${id}/reject`),

  remove: (id) =>
    api.delete(`/payment-requests/${id}`),

  downloadReceipt: async (id) => {
    const res = await api.get(`/payment-requests/${id}/receipt`, { responseType: 'blob' });
    const filename = filenameFromDisposition(res.headers['content-disposition'], `receipt_${id}.pdf`);
    downloadBlob(res.data, filename);
  },
};
