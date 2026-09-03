import api from './api';

export const roleService = {
  list: async () => {
    const response = await api.get('/roles');
    return response.data;
  },

  create: async (roleData) => {
    const response = await api.post('/roles', roleData);
    return response.data;
  },

  update: async (id, roleData) => {
    const response = await api.patch(`/roles/${id}`, roleData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/roles/${id}`);
    return response.data;
  },

  listPermissions: async () => {
    const response = await api.get('/permissions');
    return response.data;
  },

  assignPermissions: async (roleId, permissionIds) => {
    const response = await api.post('/permissions/assign', { roleId, permissionIds });
    return response.data;
  },
};

export default roleService;
