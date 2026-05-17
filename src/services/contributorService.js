import api from './api';

export const contributorService = {
  getAll:  (params) => api.get('/contributors',         { params }),
  getById: (id)     => api.get(`/contributors/${id}`),
  search:  (q)      => api.get('/contributors/search',  { params: { q } }),
};
