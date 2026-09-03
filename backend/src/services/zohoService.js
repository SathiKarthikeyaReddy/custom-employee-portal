const axios = require('axios');
const ApiError = require('../utils/ApiError');
const zohoAppModel = require('../models/zohoAppModel');

// Module-level in-memory cache for Zoho access token
const tokenCache = {
  accessToken: null,
  expiresAt: 0,
};

let refreshPromise = null;

/**
 * Retrieves an active Zoho access token, reusing cached token if valid.
 */
const getAccessToken = async () => {
  const now = Date.now();
  // 60-second safety margin
  if (tokenCache.accessToken && now < tokenCache.expiresAt - 60000) {
    return tokenCache.accessToken;
  }

  // Mutex: reuse in-flight refresh promise to prevent concurrent race condition (Scenario 3.5)
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const accountsBaseUrl = process.env.ZOHO_ACCOUNTS_BASE_URL || 'https://accounts.zoho.in';
    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      console.error('Zoho OAuth credentials missing in environment.');
      throw new ApiError(502, 'Zoho token refresh failed');
    }

    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('refresh_token', refreshToken);

      const response = await axios.post(`${accountsBaseUrl}/oauth/v2/token`, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      });

      if (response.data && response.data.access_token) {
        const expiresIn = response.data.expires_in || 3600; // standard 3600s
        tokenCache.accessToken = response.data.access_token;
        tokenCache.expiresAt = Date.now() + expiresIn * 1000;
        return tokenCache.accessToken;
      }

      // If response didn't contain access_token (e.g. { error: 'invalid_code' })
      console.error('Zoho token refresh did not return access_token.');
      throw new ApiError(502, 'Zoho token refresh failed');
    } catch (err) {
      // Never expose raw Zoho error body or refresh token
      console.error('Zoho token refresh request error occurred.');
      throw new ApiError(502, 'Zoho token refresh failed');
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Returns all registered Zoho applications from the database.
 */
const listZohoApps = async () => {
  return await zohoAppModel.listAll();
};

/**
 * Filters apps based on the user's permission keys into authorized and locked lists.
 */
const getAuthorizedApps = async (userPermissions = []) => {
  const allApps = await listZohoApps();
  const permSet = new Set(Array.isArray(userPermissions) ? userPermissions : []);

  const authorized = [];
  const locked = [];

  for (const app of allApps) {
    if (permSet.has(app.permission_key)) {
      authorized.push(app);
    } else {
      locked.push({
        id: app.id,
        key: app.key,
        name: app.name,
        purpose: app.purpose,
        is_provisioned: app.is_provisioned,
        permission_key: app.permission_key,
      });
    }
  }

  return { authorized, locked };
};

/**
 * Proxies an authenticated API call to the specified Zoho app service.
 */
const proxyRequest = async (appKey, method, subPath = '', body = null, headers = {}) => {
  const app = await zohoAppModel.findByKey(appKey);
  if (!app) {
    throw new ApiError(404, `Zoho application '${appKey}' not found`);
  }

  if (!app.is_provisioned) {
    throw new ApiError(409, `This Zoho application is not yet provisioned`);
  }

  const accessToken = await getAccessToken();

  // Prepare full target URL
  const normalizedBase = app.base_url.replace(/\/+$/, '');
  const normalizedPath = subPath.startsWith('/') ? subPath : `/${subPath}`;
  const targetUrl = `${normalizedBase}${normalizedPath}`;

  const forwardHeaders = {
    ...headers,
    Authorization: `Zoho-oauthtoken ${accessToken}`,
  };

  // Strip host/connection headers if present
  delete forwardHeaders.host;
  delete forwardHeaders.connection;

  try {
    const response = await axios({
      method: method || 'GET',
      url: targetUrl,
      data: body,
      headers: forwardHeaders,
      timeout: 15000,
    });

    return {
      status: response.status,
      data: response.data,
      headers: response.headers,
    };
  } catch (error) {
    if (error.response) {
      return {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      };
    }
    throw new ApiError(502, `Failed to proxy request to Zoho ${app.name}`);
  }
};

module.exports = {
  getAccessToken,
  listZohoApps,
  getAuthorizedApps,
  proxyRequest,
};
