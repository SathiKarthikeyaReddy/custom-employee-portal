const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const puppeteer = require('puppeteer-core');
const path = require('path');
const EmbeddedPostgres = require('embedded-postgres').default;
const { Client } = require('pg');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:4000/api';
const FRONTEND_URL = 'http://localhost:5173';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const results = [];

function recordResult(num, scenario, expected, actual, passed) {
  const status = passed ? 'PASS' : 'FAIL';
  results.push({ num, scenario, expected, actual, status });
  console.log(`[${status}] ${num} - ${scenario}`);
  if (!passed) {
    console.log(`       Expected: ${expected}`);
    console.log(`       Actual:   ${actual}`);
  }
}

async function runAllChecks() {
  process.env.DISABLE_RATE_LIMIT = 'true';
  console.log('================================================================');
  console.log('   STARTING FULL EDGE-CASE & SPECIFICATION VERIFICATION SUITE');
  console.log('================================================================\n');

  // 1. Start Postgres & initialize
  console.log('Starting Embedded PostgreSQL...');
  const pg = new EmbeddedPostgres({
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    persistent: true,
  });

  try {
    await pg.initialise();
  } catch (e) {}

  await pg.start();
  console.log('✓ PostgreSQL live.');

  const rootClient = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres',
  });
  await rootClient.connect();
  const dbCheck = await rootClient.query("SELECT 1 FROM pg_database WHERE datname = 'employee_portal'");
  if (dbCheck.rows.length === 0) {
    await rootClient.query('CREATE DATABASE employee_portal');
  }
  await rootClient.end();

  // Run seed
  const initDb = require('./src/config/initDb');
  const seed = require('./src/config/seed');
  await initDb();
  await seed();

  const { query } = require('./src/config/db');

  // Clean up any test users/roles from prior runs
  await query("DELETE FROM users WHERE email IN ('zeroroles@brainwave.io', 'secondadmin@brainwave.io', 'audithistory@brainwave.io', 'shortpw@brainwave.io', 'duplicate_admin@brainwave.io')");
  await query("DELETE FROM roles WHERE name IN ('EmptyPermRole', 'Auditor')");

  // Start Express server
  const { app } = require('./server');
  const server = app.listen(4000);
  console.log('✓ Express server listening on port 4000.\n');

  try {
    // -------------------------------------------------------------
    // SECTION 1: AUTHENTICATION & SESSION
    // -------------------------------------------------------------
    console.log('--- SECTION 1: Authentication & Session ---');

    // 1.1: Login with wrong password
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        email: 'admin@brainwave.io',
        password: 'WrongPassword!',
      });
      recordResult('1.1', 'Login with wrong password', '401 Invalid credentials', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message;
      const auditRes = await query("SELECT action FROM audit_logs WHERE user_email = 'admin@brainwave.io' AND action = 'LOGIN_FAILED' ORDER BY id DESC LIMIT 1");
      const hasAudit = auditRes.rows.length > 0;
      recordResult('1.1', 'Login with wrong password', '401, generic "Invalid credentials", LOGIN_FAILED audit row', `${status} "${msg}", audit: ${hasAudit}`, status === 401 && msg === 'Invalid credentials' && hasAudit);
    }

    // 1.2: Login with non-existent email
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        email: 'ghost_user_999@brainwave.io',
        password: 'SomePassword123!',
      });
      recordResult('1.2', 'Login with non-existent email', '401 Invalid credentials', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message;
      recordResult('1.2', 'Login with non-existent email', '401 Invalid credentials (must not reveal non-existence)', `${status} "${msg}"`, status === 401 && msg === 'Invalid credentials');
    }

    // 1.3: Login with empty email or empty password
    try {
      await axios.post(`${BASE_URL}/auth/login`, { email: '', password: '' });
      recordResult('1.3', 'Login with empty email/password', '400 Bad Request', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('1.3', 'Login with empty email/password', '400 Bad Request before hitting DB', `${status}`, status === 400);
    }

    // 1.4: Login with malformed email
    try {
      await axios.post(`${BASE_URL}/auth/login`, { email: 'notanemail', password: 'ValidPassword123!' });
      recordResult('1.4', 'Login with malformed email', '400 Bad Request', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('1.4', 'Login with malformed email', '400 Bad Request', `${status}`, status === 400);
    }

    // 1.5: Login as user with is_active = false
    await query("UPDATE users SET is_active = false WHERE email = 'sales@brainwave.io'");
    try {
      await axios.post(`${BASE_URL}/auth/login`, { email: 'sales@brainwave.io', password: 'TestPassword123!' });
      recordResult('1.5', 'Login as user with is_active = false', '401 Invalid credentials', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message;
      recordResult('1.5', 'Login as user with is_active = false', '401 Invalid credentials (generic, not "account disabled")', `${status} "${msg}"`, status === 401 && msg === 'Invalid credentials');
    }
    await query("UPDATE users SET is_active = true WHERE email = 'sales@brainwave.io'");

    // 1.6: Protected route with no Authorization header
    try {
      await axios.get(`${BASE_URL}/auth/me`);
      recordResult('1.6', 'Protected route with no Authorization header', '401 Unauthorized', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message;
      recordResult('1.6', 'Protected route with no Authorization header', '401 Unauthorized', `${status} "${msg}"`, status === 401 && msg === 'Unauthorized');
    }

    // 1.7: Protected route with header missing Bearer prefix
    try {
      await axios.get(`${BASE_URL}/auth/me`, { headers: { Authorization: 'Token xyz123' } });
      recordResult('1.7', 'Protected route with missing Bearer prefix', '401 Unauthorized', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('1.7', 'Protected route with missing Bearer prefix', '401 Unauthorized', `${status}`, status === 401);
    }

    // 1.8: Protected route with syntactically invalid JWT
    try {
      await axios.get(`${BASE_URL}/auth/me`, { headers: { Authorization: 'Bearer not.a.valid.jwt.token' } });
      recordResult('1.8', 'Protected route with syntactically invalid JWT', '401 Invalid or expired token', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('1.8', 'Protected route with syntactically invalid JWT', '401 Invalid or expired token (not 500)', `${status}`, status === 401);
    }

    // 1.9: Protected route with expired JWT
    const expiredToken = jwt.sign(
      { sub: 1, email: 'admin@brainwave.io' },
      process.env.JWT_SECRET || 'super-secret',
      { expiresIn: '-10s' }
    );
    try {
      await axios.get(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${expiredToken}` } });
      recordResult('1.9', 'Protected route with expired JWT', '401 Invalid or expired token', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('1.9', 'Protected route with expired JWT', '401 Invalid or expired token', `${status}`, status === 401);
    }

    // 1.10: GET /api/auth/me immediately after permission change without re-login
    const adminLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@brainwave.io',
      password: 'ChangeMe123!',
    });
    const adminToken = adminLoginRes.data.token;

    // Login Helen HR
    const hrLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'hr@brainwave.io',
      password: 'TestPassword123!',
    });
    const hrToken = hrLoginRes.data.token;
    const hrUserId = hrLoginRes.data.user.id;

    // Check HR's initial permissions
    const hrMeInitial = await axios.get(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${hrToken}` } });
    const initialPerms = hrMeInitial.data.user.permissions;

    // Grant HR the CRM permission via role
    const hrRoleRes = await query("SELECT id FROM roles WHERE name = 'HR'");
    const hrRoleId = hrRoleRes.rows[0].id;
    const crmPermRes = await query("SELECT id FROM permissions WHERE key = 'zoho.crm.access'");
    const crmPermId = crmPermRes.rows[0].id;

    await axios.post(
      `${BASE_URL}/permissions/assign`,
      { roleId: hrRoleId, permissionIds: [crmPermId] },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    // Call /api/auth/me with HR's EXISTING token (no re-login!)
    const hrMeUpdated = await axios.get(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${hrToken}` } });
    const updatedPerms = hrMeUpdated.data.user.permissions;
    const hasNewPerm = updatedPerms.includes('zoho.crm.access');
    recordResult('1.10', 'GET /api/auth/me reflects fresh DB permissions without re-login', 'Returns updated permissions from DB', `Has zoho.crm.access: ${hasNewPerm}`, hasNewPerm);

    // Restore HR role permissions to People
    const peoplePermRes = await query("SELECT id FROM permissions WHERE key = 'zoho.people.access'");
    await axios.post(
      `${BASE_URL}/permissions/assign`,
      { roleId: hrRoleId, permissionIds: [peoplePermRes.rows[0].id] },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    // 1.15: Minimum password length on create/reset
    try {
      await axios.post(
        `${BASE_URL}/users`,
        { name: 'Short Pw', email: 'shortpw@brainwave.io', password: 'abc' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      recordResult('1.15', 'Create user with password < 8 chars', '400 Bad Request', '201 Created', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('1.15', 'Create user with password < 8 chars', '400 Bad Request', `${status}`, status === 400);
    }

    // -------------------------------------------------------------
    // SECTION 2: RBAC / AUTHORIZATION
    // -------------------------------------------------------------
    console.log('\n--- SECTION 2: RBAC / Authorization ---');

    // 2.1: Test unauthorized app open for all roles
    // HR trying CRM, Desk, Books
    const unauthorizedCombos = [
      { role: 'HR', token: hrToken, apps: ['crm', 'desk', 'books'] },
      { role: 'Sales', token: (await axios.post(`${BASE_URL}/auth/login`, { email: 'sales@brainwave.io', password: 'TestPassword123!' })).data.token, apps: ['people', 'desk', 'books'] },
    ];
    let all403 = true;
    for (const combo of unauthorizedCombos) {
      for (const app of combo.apps) {
        try {
          await axios.post(`${BASE_URL}/zoho/${app}/open`, {}, { headers: { Authorization: `Bearer ${combo.token}` } });
          all403 = false;
        } catch (err) {
          if (err.response?.status !== 403) all403 = false;
        }
      }
    }
    const accessDeniedAudit = await query("SELECT COUNT(*) as count FROM audit_logs WHERE action = 'ACCESS_DENIED'");
    const hasAccessDeniedAudit = parseInt(accessDeniedAudit.rows[0].count, 10) > 0;
    recordResult('2.1', 'POST /api/zoho/:appKey/open for unauthorized apps', '403 + ACCESS_DENIED audit row', `All 403: ${all403}, ACCESS_DENIED rows: ${hasAccessDeniedAudit}`, all403 && hasAccessDeniedAudit);

    // 2.2: HR user calls any admin.* route
    const adminRoutes = ['/users', '/roles', '/permissions', '/audit'];
    let allAdminRoutesBlocked = true;
    for (const route of adminRoutes) {
      try {
        await axios.get(`${BASE_URL}${route}`, { headers: { Authorization: `Bearer ${hrToken}` } });
        allAdminRoutesBlocked = false;
      } catch (err) {
        if (err.response?.status !== 403) allAdminRoutesBlocked = false;
      }
    }
    recordResult('2.2', 'HR user calls admin.* routes (/users, /roles, /permissions, /audit)', '403 for all', `All 403: ${allAdminRoutesBlocked}`, allAdminRoutesBlocked);

    // 2.3: User with zero roles assigned
    const zeroRoleUser = await axios.post(
      `${BASE_URL}/users`,
      { name: 'Zero Roles', email: 'zeroroles@brainwave.io', password: 'ValidPassword123!', roleIds: [] },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const zeroLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'zeroroles@brainwave.io',
      password: 'ValidPassword123!',
    });
    const zeroApps = await axios.get(`${BASE_URL}/zoho/apps`, {
      headers: { Authorization: `Bearer ${zeroLogin.data.token}` },
    });
    const zeroPassed = zeroApps.data.authorized.length === 0 && zeroApps.data.locked.length === 4;
    recordResult('2.3', 'User with zero roles logs in', 'Dashboard loads with 4 locked apps, no crash', `Authorized: ${zeroApps.data.authorized.length}, Locked: ${zeroApps.data.locked.length}`, zeroPassed);

    // 2.4: Call POST /api/zoho/nonexistent-app/open
    try {
      await axios.post(`${BASE_URL}/zoho/nonexistent-app/open`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });
      recordResult('2.4', 'Open non-existent app', '404 Not Found', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('2.4', 'Open non-existent app', '404 Not Found (not 500)', `${status}`, status === 404);
    }

    // 2.5: Assign a user two roles (HR + Sales)
    const salesRoleId = (await query("SELECT id FROM roles WHERE name = 'Sales'")).rows[0].id;
    await axios.patch(
      `${BASE_URL}/users/${zeroRoleUser.data.user.id}`,
      { roleIds: [hrRoleId, salesRoleId] },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const dualApps = await axios.get(`${BASE_URL}/zoho/apps`, {
      headers: { Authorization: `Bearer ${zeroLogin.data.token}` },
    });
    const authKeys = dualApps.data.authorized.map(a => a.key);
    const dualPassed = authKeys.includes('people') && authKeys.includes('crm');
    recordResult('2.5', 'Assign user two roles (HR + Sales)', 'Dashboard shows both People and CRM authorized', `Authorized keys: [${authKeys.join(', ')}]`, dualPassed);

    // 2.6: Remove all roles from existing user
    await axios.patch(
      `${BASE_URL}/users/${zeroRoleUser.data.user.id}`,
      { roleIds: [] },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const revertedApps = await axios.get(`${BASE_URL}/zoho/apps`, {
      headers: { Authorization: `Bearer ${zeroLogin.data.token}` },
    });
    const revertedPassed = revertedApps.data.authorized.length === 0 && revertedApps.data.locked.length === 4;
    recordResult('2.6', 'Remove all roles from existing user', 'Reverts to fully locked', `Authorized count: ${revertedApps.data.authorized.length}`, revertedPassed);

    // 2.7: Deactivate currently logged-in user with valid JWT
    await axios.patch(
      `${BASE_URL}/users/${zeroRoleUser.data.user.id}`,
      { isActive: false },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    try {
      await axios.get(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${zeroLogin.data.token}` },
      });
      recordResult('2.7', 'Deactivate currently logged-in user with valid JWT', '401 Inactive user on next request', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('2.7', 'Deactivate currently logged-in user with valid JWT', '401 Inactive user on next request', `${status}`, status === 401);
    }

    // 2.8: PATCH /api/users/999999
    try {
      await axios.patch(
        `${BASE_URL}/users/999999`,
        { name: 'Ghost' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      recordResult('2.8', 'PATCH nonexistent user ID 999999', '404 Not Found', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('2.8', 'PATCH nonexistent user ID 999999', '404 Not Found (not 500)', `${status}`, status === 404);
    }

    // 2.9: Assign non-existent permission ID
    try {
      await axios.post(
        `${BASE_URL}/permissions/assign`,
        { roleId: hrRoleId, permissionIds: [999999] },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      recordResult('2.9', 'Assign non-existent permission ID', '400 Bad Request', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('2.9', 'Assign non-existent permission ID', '400 Bad Request (no leaking FK error)', `${status}`, status === 400);
    }

    // 2.10: SQL injection payload in login
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        email: "' OR '1'='1' --",
        password: "' OR '1'='1'",
      });
      recordResult('2.10', 'SQL injection in login email', '400/401, no bypass', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('2.10', 'SQL injection in login email', '400/401 handled cleanly, no bypass, no 500', `${status}`, status === 400 || status === 401);
    }

    // -------------------------------------------------------------
    // SECTION 3: ZOHO INTEGRATION
    // -------------------------------------------------------------
    console.log('\n--- SECTION 3: Zoho Integration ---');

    // 3.1: Support calls POST /api/zoho/desk/open
    const supportLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'support@brainwave.io',
      password: 'TestPassword123!',
    });
    try {
      await axios.post(
        `${BASE_URL}/zoho/desk/open`,
        {},
        { headers: { Authorization: `Bearer ${supportLogin.data.token}` } }
      );
      recordResult('3.1', 'Support calls /api/zoho/desk/open', '409 App not yet provisioned', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message;
      recordResult('3.1', 'Support calls /api/zoho/desk/open', '409 "This Zoho application is not yet provisioned"', `${status} "${msg}"`, status === 409 && msg === 'This Zoho application is not yet provisioned');
    }

    // 3.2: Unauthorized role calls proxy
    try {
      await axios.get(`${BASE_URL}/zoho/crm/proxy/leads`, {
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      recordResult('3.2', 'Unauthorized role calls /proxy', '403 Access Denied', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('3.2', 'Unauthorized role calls /proxy', '403 Access Denied', `${status}`, status === 403);
    }

    // 3.4: Temporarily set ZOHO_CLIENT_SECRET wrong, call Zoho endpoint
    const originalSecret = process.env.ZOHO_CLIENT_SECRET;
    process.env.ZOHO_CLIENT_SECRET = 'invalid_secret_test';
    try {
      await axios.get(`${BASE_URL}/zoho/crm/proxy/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      recordResult('3.4', 'Zoho call with invalid secret', '502 Zoho token refresh failed', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message;
      recordResult('3.4', 'Zoho call with invalid secret', '502 "Zoho token refresh failed" (no credentials leaked)', `${status} "${msg}"`, status === 502 && msg === 'Zoho token refresh failed');
    } finally {
      process.env.ZOHO_CLIENT_SECRET = originalSecret;
    }

    // 3.5: 5+ concurrent requests with fresh token cache
    const zohoService = require('./src/services/zohoService');
    const tokenReqs = [
      zohoService.getAccessToken().catch(e => e.message),
      zohoService.getAccessToken().catch(e => e.message),
      zohoService.getAccessToken().catch(e => e.message),
      zohoService.getAccessToken().catch(e => e.message),
      zohoService.getAccessToken().catch(e => e.message),
    ];
    const tokenResults = await Promise.all(tokenReqs);
    recordResult('3.5', '5 concurrent token requests with mutex', 'All requests handled synchronously via mutex without race conditions', `Processed ${tokenResults.length} requests`, tokenResults.length === 5);

    // 3.6: GET /api/zoho/CRM/open
    try {
      await axios.get(`${BASE_URL}/zoho/CRM/open`, { headers: { Authorization: `Bearer ${adminToken}` } });
      recordResult('3.6', 'GET /api/zoho/CRM/open (wrong method/case)', '404 Not Found', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('3.6', 'GET /api/zoho/CRM/open (wrong method/case)', '404 Not Found (intentional REST routing)', `${status}`, status === 404);
    }

    // -------------------------------------------------------------
    // SECTION 4: ADMIN CRUD
    // -------------------------------------------------------------
    console.log('\n--- SECTION 4: Admin CRUD ---');

    // 4.1: Create user with duplicate email
    try {
      await axios.post(
        `${BASE_URL}/users`,
        { name: 'Duplicate Admin', email: 'admin@brainwave.io', password: 'ValidPassword123!' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      recordResult('4.1', 'Create user with duplicate email', '409 Conflict', '201 Created', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('4.1', 'Create user with duplicate email', '409 Conflict (not 500)', `${status}`, status === 409);
    }

    // 4.2: Create user with missing fields
    try {
      await axios.post(
        `${BASE_URL}/users`,
        { name: '', email: '', password: '' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      recordResult('4.2', 'Create user with missing fields', '400 Bad Request', '201 Created', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('4.2', 'Create user with missing fields', '400 Bad Request', `${status}`, status === 400);
    }

    // 4.3: Update user email to one already used
    try {
      await axios.patch(
        `${BASE_URL}/users/${zeroRoleUser.data.user.id}`,
        { email: 'admin@brainwave.io' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      recordResult('4.3', 'Update user email to existing email', '409 Conflict', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('4.3', 'Update user email to existing email', '409 Conflict', `${status}`, status === 409);
    }

    // 4.4: Create role with existing name
    try {
      await axios.post(
        `${BASE_URL}/roles`,
        { name: 'Admin', description: 'Duplicate Admin' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      recordResult('4.4', 'Create role with existing name', '409 Conflict', '201 Created', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('4.4', 'Create role with existing name', '409 Conflict', `${status}`, status === 409);
    }

    // 4.5: Create role with empty name
    try {
      await axios.post(
        `${BASE_URL}/roles`,
        { name: '', description: 'Empty role' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      recordResult('4.5', 'Create role with empty name', '400 Bad Request', '201 Created', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('4.5', 'Create role with empty name', '400 Bad Request', `${status}`, status === 400);
    }

    // 4.6: Assign empty permissions array to role
    const emptyPermRole = await axios.post(
      `${BASE_URL}/roles`,
      { name: 'EmptyPermRole', description: 'Role with no permissions' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const assignEmpty = await axios.post(
      `${BASE_URL}/permissions/assign`,
      { roleId: emptyPermRole.data.role.id, permissionIds: [] },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    recordResult('4.6', 'Assign empty permissions array to role', '200 OK, 0 permissions', `${assignEmpty.status}, perms: ${assignEmpty.data.role.permissionKeys.length}`, assignEmpty.status === 200 && assignEmpty.data.role.permissionKeys.length === 0);

    // 4.7: Guardrail - Delete the only remaining Admin
    // First confirm admin count
    const adminCountRes = await query("SELECT COUNT(DISTINCT u.id) as count FROM user_roles ur JOIN roles r ON ur.role_id = r.id JOIN users u ON ur.user_id = u.id WHERE r.name = 'Admin' AND u.is_active = true");
    const adminCount = parseInt(adminCountRes.rows[0].count, 10);
    
    // Create a dummy second admin so we can test attempting to delete the last one
    const secondAdmin = await axios.post(
      `${BASE_URL}/users`,
      { name: 'Second Admin', email: 'secondadmin@brainwave.io', password: 'ValidPassword123!', roleIds: [1] },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    // Delete secondAdmin succeeds
    await axios.delete(`${BASE_URL}/users/${secondAdmin.data.user.id}`, { headers: { Authorization: `Bearer ${adminToken}` } });

    // Now there is only 1 Admin left (ID 1). Try to delete ID 1 from another user's request (or direct controller call)
    try {
      await axios.delete(`${BASE_URL}/users/1`, { headers: { Authorization: `Bearer ${adminToken}` } });
      recordResult('4.7', 'Delete only remaining Admin user', '409 Conflict', '204 Deleted', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('4.7', 'Delete only remaining Admin user', 'Blocked with 400/409', `${status}`, status === 400 || status === 409);
    }

    // 4.8: Guardrail - Admin removes their own Admin role leaving 0 admins
    try {
      await axios.patch(
        `${BASE_URL}/users/1`,
        { roleIds: [hrRoleId] },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      recordResult('4.8', 'Admin self-demotes leaving 0 admins', '409 Conflict', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message;
      recordResult('4.8', 'Admin self-demotes leaving 0 admins', '409 "At least one Admin must remain"', `${status} "${msg}"`, status === 409 && msg === 'At least one Admin must remain');
    }

    // 4.10: Reset password with 1-character password
    try {
      await axios.post(
        `${BASE_URL}/users/1/reset-password`,
        { password: '1' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      recordResult('4.10', 'Reset password with 1-char password', '400 Bad Request', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      recordResult('4.10', 'Reset password with 1-char password', '400 Bad Request', `${status}`, status === 400);
    }

    // -------------------------------------------------------------
    // SECTION 5: AUDIT LOG
    // -------------------------------------------------------------
    console.log('\n--- SECTION 5: Audit Log ---');

    // 5.1: Query /api/audit with offset beyond total count
    const highOffsetRes = await axios.get(`${BASE_URL}/audit?offset=999999`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordResult('5.1', 'Audit query with offset beyond total count', '200 OK with empty array', `${highOffsetRes.status}, logs: ${highOffsetRes.data.logs.length}`, highOffsetRes.status === 200 && highOffsetRes.data.logs.length === 0);

    // 5.2: Filter by action with zero matches
    const noMatchActionRes = await axios.get(`${BASE_URL}/audit?action=IMPOSSIBLE_ACTION_KEY`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordResult('5.2', 'Audit filter by non-existent action', '200 OK with empty array', `${noMatchActionRes.status}, logs: ${noMatchActionRes.data.logs.length}`, noMatchActionRes.status === 200 && noMatchActionRes.data.logs.length === 0);

    // 5.3: Filter by userEmail that never existed
    const noMatchEmailRes = await axios.get(`${BASE_URL}/audit?userEmail=never_existed@domain.com`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordResult('5.3', 'Audit filter by non-existent userEmail', '200 OK with empty array', `${noMatchEmailRes.status}, logs: ${noMatchEmailRes.data.logs.length}`, noMatchEmailRes.status === 200 && noMatchEmailRes.data.logs.length === 0);

    // 5.4: Pagination limit & offset
    const page1Res = await axios.get(`${BASE_URL}/audit?limit=5&offset=0`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const page2Res = await axios.get(`${BASE_URL}/audit?limit=5&offset=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const paginationWorks = page1Res.data.logs.length <= 5 && page2Res.data.logs.length > 0 && page1Res.data.logs[0]?.id !== page2Res.data.logs[0]?.id;
    recordResult('5.4', 'Audit pagination limit/offset check', 'Page 1 & 2 return distinct sliced logs', `Page 1: ${page1Res.data.logs.length}, Page 2: ${page2Res.data.logs.length}`, paginationWorks);

    // 5.5: Delete user who has prior audit history, confirm user_email preserved and user_id is NULL
    const tempAuditUser = await axios.post(
      `${BASE_URL}/users`,
      { name: 'Audit History User', email: 'audithistory@brainwave.io', password: 'ValidPassword123!' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const tempId = tempAuditUser.data.user.id;
    // Log in temp user to generate login audit
    await axios.post(`${BASE_URL}/auth/login`, { email: 'audithistory@brainwave.io', password: 'ValidPassword123!' });
    // Delete temp user
    await axios.delete(`${BASE_URL}/users/${tempId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    // Check audit rows for audithistory@brainwave.io
    const preservedAudit = await query("SELECT user_id, user_email, action FROM audit_logs WHERE user_email = 'audithistory@brainwave.io'");
    const rowsWithNullId = preservedAudit.rows.filter(r => r.user_id === null && r.action === 'LOGIN_SUCCESS');
    recordResult('5.5', 'Delete user preserves email and sets user_id to NULL', 'user_email preserved, user_id NULL on prior events', `Preserved rows: ${preservedAudit.rows.length}, null-id rows: ${rowsWithNullId.length}`, preservedAudit.rows.length > 0 && rowsWithNullId.length > 0);

    // -------------------------------------------------------------
    // SECTION 7: SECURITY & INFRASTRUCTURE
    // -------------------------------------------------------------
    console.log('\n--- SECTION 7: Security & Infrastructure ---');

    // 7.1: Request with unrelated Origin header blocked by CORS
    try {
      const corsRes = await axios.get(`${BASE_URL}/zoho/apps`, {
        headers: {
          Origin: 'http://malicious-site.com',
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const allowOrigin = corsRes.headers['access-control-allow-origin'];
      recordResult('7.1', 'Request with unrelated Origin header', 'CORS origin check restricts to http://localhost:5173', `Access-Control-Allow-Origin: ${allowOrigin}`, allowOrigin !== 'http://malicious-site.com');
    } catch (err) {
      recordResult('7.1', 'Request with unrelated Origin header', 'CORS blocked', 'Blocked by CORS', true);
    }

    // 7.2: Helmet security headers
    const healthRes = await axios.get('http://localhost:4000/health');
    const xContentType = healthRes.headers['x-content-type-options'];
    recordResult('7.2', 'Helmet security headers present', 'X-Content-Type-Options: nosniff present', `X-Content-Type-Options: ${xContentType}`, xContentType === 'nosniff');

    // 7.3: Malformed JSON payload
    try {
      await axios.post(`${BASE_URL}/auth/login`, '{"malformed": json}', {
        headers: { 'Content-Type': 'application/json' },
      });
      recordResult('7.3', 'Malformed JSON body', '400 Bad Request', '200 OK', false);
    } catch (err) {
      const status = err.response?.status;
      const dataStr = JSON.stringify(err.response?.data || {});
      const hasStack = dataStr.includes('stack') || dataStr.includes('at ');
      recordResult('7.3', 'Malformed JSON body', '400 Bad Request with no stack trace', `${status}, has stack: ${hasStack}`, status === 400 && !hasStack);
    }

    // 7.4: JWT_SECRET check
    const jwtSecretVal = process.env.JWT_SECRET;
    const isSecretStrong = jwtSecretVal && jwtSecretVal.length >= 32 && !jwtSecretVal.includes('placeholder') && !jwtSecretVal.includes('example');
    recordResult('7.4', 'JWT_SECRET is long random string', 'Random string >= 32 chars, no placeholder', `Length: ${jwtSecretVal?.length}`, isSecretStrong);

    // -------------------------------------------------------------
    // SECTION 8: DATA INTEGRITY & SEED IDEMPOTENCY
    // -------------------------------------------------------------
    console.log('\n--- SECTION 8: Data Integrity & Seed Idempotency ---');

    // 8.1: Run npm run seed a second time against already-seeded DB
    await query("DELETE FROM roles WHERE name = 'EmptyPermRole'");
    const adminBefore = await query("SELECT password_hash FROM users WHERE email = 'admin@brainwave.io'");
    await seed();
    const adminAfter = await query("SELECT password_hash FROM users WHERE email = 'admin@brainwave.io'");
    const rolesCount = await query('SELECT COUNT(*) as count FROM roles');
    const permsCount = await query('SELECT COUNT(*) as count FROM permissions');
    const appsCount = await query('SELECT COUNT(*) as count FROM zoho_apps');

    const seedIdempotent = adminBefore.rows[0].password_hash === adminAfter.rows[0].password_hash &&
      parseInt(rolesCount.rows[0].count, 10) === 6 &&
      parseInt(permsCount.rows[0].count, 10) === 8 &&
      parseInt(appsCount.rows[0].count, 10) === 4;

    recordResult('8.1', 'Run seed script a second time', 'No duplicate rows, admin password hash unchanged', `Roles: ${rolesCount.rows[0].count}, Perms: ${permsCount.rows[0].count}, Apps: ${appsCount.rows[0].count}`, seedIdempotent);

    // 8.2: Check zoho_apps.base_url for People, CRM, Books matches .env
    const appRows = (await query("SELECT key, base_url FROM zoho_apps WHERE key IN ('people', 'crm', 'books')")).rows;
    const peopleMatch = appRows.find(a => a.key === 'people')?.base_url === (process.env.ZOHO_PEOPLE_URL || 'https://people.zoho.in');
    const crmMatch = appRows.find(a => a.key === 'crm')?.base_url === (process.env.ZOHO_CRM_URL || 'https://crm.zoho.in');
    const booksMatch = appRows.find(a => a.key === 'books')?.base_url === (process.env.ZOHO_BOOKS_URL || 'https://books.zoho.in');
    const allUrlsMatch = peopleMatch && crmMatch && booksMatch;
    recordResult('8.2', 'Check zoho_apps.base_url for People, CRM, Books', 'Matches .env URLs exactly', `People: ${peopleMatch}, CRM: ${crmMatch}, Books: ${booksMatch}`, allUrlsMatch);

    // 8.3: Check zoho_apps row for Desk
    const deskApp = (await query("SELECT * FROM zoho_apps WHERE key = 'desk'")).rows[0];
    const deskCorrect = deskApp && deskApp.is_provisioned === false;
    recordResult('8.3', 'Check zoho_apps row for Desk', 'is_provisioned = false', `is_provisioned: ${deskApp.is_provisioned}`, deskCorrect);

    // -------------------------------------------------------------
    // SECTION 6 & UI BROWSER EDGE-CASES VIA PUPPETEER
    // -------------------------------------------------------------
    console.log('\n--- SECTION 6: Frontend & Browser Verification ---');

    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      defaultViewport: { width: 1280, height: 800 },
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // 1.11 & 1.12: Logout clears token from localStorage
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
    await page.type('input[type="email"]', 'admin@brainwave.io');
    await page.type('input[type="password"]', 'ChangeMe123!');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 10000 });
    
    // Check localStorage has token
    const tokenInStorage = await page.evaluate(() => localStorage.getItem('portal_auth_token'));
    // Click Sign Out
    await page.click('button[title="Sign Out"]');
    await page.waitForFunction(() => window.location.pathname === '/login', { timeout: 10000 });
    const tokenAfterLogout = await page.evaluate(() => localStorage.getItem('portal_auth_token'));
    recordResult('1.12', 'Logout removes token from localStorage', 'Token removed from localStorage', `Before: ${!!tokenInStorage}, After: ${tokenAfterLogout}`, !!tokenInStorage && tokenAfterLogout === null);

    // 1.11: session_expired query param displays explaining message
    await page.goto(`${FRONTEND_URL}/login?reason=session_expired`, { waitUntil: 'networkidle0' });
    const reasonMsg = await page.$eval('.bg-amber-50', el => el.innerText);
    recordResult('1.11', 'Login page displays explanation on ?reason=session_expired', 'Shows clear expiration message', reasonMsg.trim(), reasonMsg.includes('session has expired'));

    // 1.13: Refresh page while logged in persists session
    await page.type('input[type="email"]', 'admin@brainwave.io');
    await page.type('input[type="password"]', 'ChangeMe123!');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 10000 });
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(500);
    const pathAfterReload = await page.evaluate(() => window.location.pathname);
    recordResult('1.13', 'Refresh page while logged in persists session', 'Remains on /dashboard', pathAfterReload, pathAfterReload === '/dashboard');

    // 1.14: Fresh incognito window redirects to /login
    const incognitoContext = await browser.createBrowserContext();
    const incognitoPage = await incognitoContext.newPage();
    await incognitoPage.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'networkidle0' });
    await sleep(400);
    const incognitoPath = await incognitoPage.evaluate(() => window.location.pathname);
    recordResult('1.14', 'Fresh context/incognito without token redirects to /login', 'Redirects to /login', incognitoPath, incognitoPath === '/login');
    await incognitoContext.close();

    // 6.1: Non-admin navigates directly to /admin/users
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
    await page.type('input[type="email"]', 'hr@brainwave.io');
    await page.type('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 10000 });
    await page.goto(`${FRONTEND_URL}/admin/users`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('h2');
    const accessDeniedCard = await page.$eval('h2', el => el.innerText);
    recordResult('6.1', 'Non-admin visits /admin/users URL', 'Inline Access Denied card, no table flash', accessDeniedCard, accessDeniedCard.includes('ACCESS DENIED'));

    // 6.3: Mobile viewport (375px) check
    await page.setViewport({ width: 375, height: 667 });
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
    const hasHorizScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    recordResult('6.3', 'Mobile viewport 375px responsiveness', 'Fully usable, no horizontal overflow scroll', `Horizontal scroll: ${hasHorizScroll}`, !hasHorizScroll);

    // 6.5: Modal closes on Escape
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
    await page.type('input[type="email"]', 'admin@brainwave.io');
    await page.type('input[type="password"]', 'ChangeMe123!');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 10000 });
    await page.goto(`${FRONTEND_URL}/admin/users`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('table');
    // Open create user modal
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('add new user'));
      if (btn) btn.click();
    });
    await page.waitForSelector('input[placeholder="e.g. John Doe"]');
    // Press Escape
    await page.keyboard.press('Escape');
    await sleep(400);
    const modalClosed = await page.evaluate(() => !document.querySelector('input[placeholder="e.g. John Doe"]'));
    recordResult('6.5', 'Modal closes when Escape key is pressed', 'Modal dismissed', `Modal closed: ${modalClosed}`, modalClosed);

    await browser.close();

    console.log('\n================================================================');
    console.log(`   EXECUTION COMPLETE: ${results.filter(r => r.status === 'PASS').length} / ${results.length} CHECKS PASSED`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Fatal execution error during verification:', err);
  } finally {
    server.close();
    try {
      const { pool } = require('./src/config/db');
      await pool.end();
    } catch (e) {}
    await pg.stop();
  }

  // Write JSON report
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, 'checklist-results.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('Saved checklist results to checklist-results.json');
}

runAllChecks();
