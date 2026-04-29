import api from './api';

export const settingsService = {
  get:            ()     => api.get('/settings'),
  update:         (data) => api.post('/settings',          { settings: data }),
  updatePassword: (data) => api.post('/settings/password', data),
};
