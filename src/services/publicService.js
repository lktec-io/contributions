import api from './api';
import { downloadBlob, filenameFromDisposition } from '../utils/downloadBlob';

export const publicService = {
  getContribution: (token) =>
    api.get(`/public/contributions/${token}`),

  submitPaymentRequest: (token, data) =>
    api.post(`/public/contributions/${token}/payment-request`, data),

  downloadReceipt: async (token) => {
    const res = await api.get(`/public/contributions/${token}/receipt`, { responseType: 'blob' });
    const filename = filenameFromDisposition(res.headers['content-disposition'], 'receipt.pdf');
    downloadBlob(res.data, filename);
  },
};
