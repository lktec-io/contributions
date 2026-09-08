import api from './api';

export const contributorService = {
  search: (q)    => api.get('/contributors/search', { params: { q } }),
  getAll: ()     => api.get('/contributors'),

  // Custom SMS members — name + phone only, owned by the calling user
  getMembers:   ()           => api.get('/contributors/members'),
  createMember: (data)       => api.post('/contributors/members', data),
  updateMember: (id, data)   => api.put(`/contributors/members/${id}`, data),
  deleteMember: (id)         => api.delete(`/contributors/members/${id}`),
};
