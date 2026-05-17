import api from './api';

export const contributorService = {
  search: (q)    => api.get('/contributors/search', { params: { q } }),
  getAll: ()     => api.get('/contributors'),
};
