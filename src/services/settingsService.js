import api from './api';

export const settingsService = {
  get:            ()     => api.get('/settings'),
  update:         (data) => api.post('/settings',          { settings: data }),
  updatePassword: (data) => api.post('/settings/password', data),

  uploadLogo: (file) => {
    const formData = new FormData();
    formData.append('logo', file);
    return api.post('/settings/branding/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  removeLogo: () => api.delete('/settings/branding/logo'),
};
