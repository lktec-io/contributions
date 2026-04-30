import api from './api';

export const notificationService = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  deleteOne: (id) => api.delete(`/notifications/${id}`),
  deleteAll: () => api.delete('/notifications'),
};
