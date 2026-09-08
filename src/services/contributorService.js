import api from './api';

export const contributorService = {
  search: (q)    => api.get('/contributors/search', { params: { q } }),
  getAll: ()     => api.get('/contributors'),

  // Custom SMS members — name + phone only, owned by the calling user
  getMembers:   ()           => api.get('/contributors/members'),
  createMember: (data)       => api.post('/contributors/members', data),
  updateMember: (id, data)   => api.put(`/contributors/members/${id}`, data),
  deleteMember: (id)         => api.delete(`/contributors/members/${id}`),

  importMembers: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/contributors/members/import', form);
  },

  // Reports — the server scopes both to the caller's own members
  exportMembersXLSX: (eventId) =>
    api.get('/contributors/members/export/xlsx', { params: { eventId }, responseType: 'blob' }),
  exportMembersPDF: (eventId) =>
    api.get('/contributors/members/export/pdf', { params: { eventId }, responseType: 'blob' }),
};
