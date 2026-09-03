import api from './api';

export const auditService = {
  list: async (params = {}) => {
    const response = await api.get('/audit', { params });
    return response.data;
  },
};

export default auditService;
