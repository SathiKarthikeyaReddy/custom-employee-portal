import api from './api';

export const zohoService = {
  getApps: async () => {
    const response = await api.get('/zoho/apps');
    return response.data;
  },

  openApp: async (appKey) => {
    const response = await api.post(`/zoho/${appKey}/open`);
    return response.data;
  },
};

export default zohoService;
