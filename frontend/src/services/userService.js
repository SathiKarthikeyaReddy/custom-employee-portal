import api from './api';

export const userService = {
  list: async () => {
    const response = await api.get('/users');
    return response.data;
  },

  create: async (userData) => {
    const response = await api.post('/users', userData);
    return response.data;
  },

  update: async (id, userData) => {
    const response = await api.patch(`/users/${id}`, userData);
    return response.data;
  },

  resetPassword: async (id, password) => {
    const response = await api.post(`/users/${id}/reset-password`, { password });
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
};

export default userService;
