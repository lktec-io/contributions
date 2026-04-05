import api from './api';

const downloadFile = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const getDate = () => new Date().toISOString().split('T')[0];

const safeName = (name) => (name || 'export').replace(/[^a-z0-9]/gi, '_').toLowerCase();

export const exportService = {
  exportCSV: async (eventId, eventName) => {
    const res = await api.get('/export/csv', { params: { eventId }, responseType: 'blob' });
    downloadFile(res.data, `contributions_${safeName(eventName)}_${getDate()}.csv`);
  },
  exportXLSX: async (eventId, eventName) => {
    const res = await api.get('/export/xlsx', { params: { eventId }, responseType: 'blob' });
    downloadFile(res.data, `contributions_${safeName(eventName)}_${getDate()}.xlsx`);
  },
  exportPDF: async (eventId, eventName) => {
    const res = await api.get('/export/pdf', { params: { eventId }, responseType: 'blob' });
    downloadFile(res.data, `report_${safeName(eventName)}_${getDate()}.pdf`);
  },
};
