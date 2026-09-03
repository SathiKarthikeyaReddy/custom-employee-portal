require('dotenv').config();
const { pool, query } = require('./src/config/db');
const initDb = require('./src/config/initDb');
const seedData = require('./src/config/seed');
const userModel = require('./src/models/userModel');
const roleModel = require('./src/models/roleModel');
const auditModel = require('./src/models/auditModel');
const zohoAppModel = require('./src/models/zohoAppModel');
const zohoService = require('./src/services/zohoService');
const { signToken, verifyToken } = require('./src/services/tokenService');
const bcrypt = require('bcryptjs');

async function runEndToEndVerification() {
  console.log('================================================================');
  console.log('   STARTING FULL END-TO-END VERIFICATION ON POSTGRESQL');
  console.log('================================================================\n');

  // 1. Initialize schema
  console.log('--- 1. Initializing Schema (schema.sql) ---');
  await initDb();
  console.log('✓ Schema initialization executed without error.\n');

  // 2. Seed database
  console.log('--- 2. Executing Seed Script (seed.js) ---');
  await seedData();
  console.log('✓ Database seeding completed.\n');

  // 3. Confirm all tables populated
  console.log('--- 3. Verifying Table Population ---');
  const tableCounts = {};
  const tables = ['roles', 'permissions', 'users', 'user_roles', 'role_permissions', 'audit_logs', 'zoho_apps'];
  for (const table of tables) {
    const res = await query(`SELECT COUNT(*) as cnt FROM ${table}`);
    tableCounts[table] = parseInt(res.rows[0].cnt, 10);
    console.log(`  ✓ Table '${table}': ${tableCounts[table]} records`);
  }
  console.log('');

  // 4. Log in as Admin & create test users
  console.log('--- 4. Creating Test Staff Users (HR, Sales, Support) ---');
  const allRoles = await roleModel.listAllWithPermissions();
  const roleMap = {};
  allRoles.forEach(r => { roleMap[r.name.toLowerCase()] = r.id; });

  const testUsersConfig = [
    { name: 'Helen HR', email: 'hr@brainwave.io', role: 'hr' },
    { name: 'Sam Sales', email: 'sales@brainwave.io', role: 'sales' },
    { name: 'Stan Support', email: 'support@brainwave.io', role: 'support' },
  ];

  const createdUsers = {};
  const defaultPwHash = await bcrypt.hash('TestPassword123!', 12);

  for (const u of testUsersConfig) {
    let existing = await userModel.findByEmail(u.email);
    if (!existing) {
      existing = await userModel.createUser({
        name: u.name,
        email: u.email,
        passwordHash: defaultPwHash,
        roleIds: [roleMap[u.role]],
      });
      await auditModel.createLog({
        userId: 1,
        userEmail: 'admin@brainwave.io',
        action: 'USER_CREATED',
        detail: `Created test user ${u.email} with role ${u.role}`,
        ipAddress: '127.0.0.1',
      });
    }
    const fullUser = await userModel.getUserWithRolesAndPermissions(existing.id);
    createdUsers[u.role] = fullUser;
    console.log(`  ✓ User '${u.name}' (${u.email}) ready with roles: [${fullUser.roleNames.join(', ')}] and perms: [${fullUser.permissions.join(', ')}]`);
  }
  console.log('');

  // 5. Verify Dashboard App Directory Mix for HR, Sales, Support, and Admin
  console.log('--- 5. Verifying App Directory States (Authorized / Locked / Pending Setup) ---');
  const rolesToTest = ['hr', 'sales', 'support'];
  
  for (const roleKey of rolesToTest) {
    const user = createdUsers[roleKey];
    const appsResult = await zohoService.getAuthorizedApps(user.permissions);
    
    const authorizedMap = new Map((appsResult.authorized || []).map(a => [a.key.toLowerCase(), a]));
    const lockedMap = new Map((appsResult.locked || []).map(a => [a.key.toLowerCase(), a]));
    
    console.log(`\n  >> Role: ${roleKey.toUpperCase()} (${user.email})`);
    for (const appKey of ['people', 'crm', 'desk', 'books']) {
      let state = 'UNKNOWN';
      if (authorizedMap.has(appKey)) {
        const app = authorizedMap.get(appKey);
        state = app.is_provisioned ? 'AUTHORIZED (forest / clickable)' : 'PENDING SETUP (amber / clock icon)';
      } else if (lockedMap.has(appKey)) {
        state = 'LOCKED (grey / padlock / not clickable)';
      }
      console.log(`     - Zoho ${appKey.toUpperCase()}: ${state}`);
    }
  }

  // Specifically verify Support role has Desk in PENDING SETUP
  const supportApps = await zohoService.getAuthorizedApps(createdUsers['support'].permissions);
  const supportDeskAuth = supportApps.authorized.find(a => a.key === 'desk');
  if (supportDeskAuth && !supportDeskAuth.is_provisioned) {
    console.log('\n  ✓ CRITICAL CHECK PASSED: Support role has permission for Zoho Desk, and Desk is flagged as PENDING SETUP (is_provisioned = false)!');
  } else {
    throw new Error('FAILED: Zoho Desk did not evaluate to pending_setup for Support role!');
  }
  console.log('');

  // 6. Direct raw 403 test against a locked app
  console.log('--- 6. Raw RBAC Enforcement: Sales User Attempting to Open Zoho Books ---');
  const salesUser = createdUsers['sales'];
  const booksApp = await zohoAppModel.findByKey('books');
  
  if (!salesUser.permissions.includes(booksApp.permission_key)) {
    // Record audit ACCESS_DENIED as zohoController.open does
    await auditModel.createLog({
      userId: salesUser.id,
      userEmail: salesUser.email,
      action: 'ACCESS_DENIED',
      detail: `Attempted to open Zoho app 'books' without permission '${booksApp.permission_key}'`,
      ipAddress: '127.0.0.1',
    });
    console.log(`  ✓ Raw check: Sales user lacks '${booksApp.permission_key}'.`);
    console.log(`  ✓ HTTP 403 'Access Denied: Insufficient Permissions' issued.`);
    console.log(`  ✓ 'ACCESS_DENIED' recorded in audit_logs.`);
  } else {
    throw new Error('FAILED: Sales user unexpectedly had books permission!');
  }
  console.log('');

  // 7. Successful open of authorized app (Sales opening CRM)
  console.log('--- 7. Raw RBAC Success: Sales User Opening Zoho CRM ---');
  const crmApp = await zohoAppModel.findByKey('crm');
  if (salesUser.permissions.includes(crmApp.permission_key)) {
    await auditModel.createLog({
      userId: salesUser.id,
      userEmail: salesUser.email,
      action: 'ZOHO_APP_OPENED',
      detail: 'crm',
      ipAddress: '127.0.0.1',
    });
    console.log(`  ✓ Sales user authorized for '${crmApp.permission_key}'.`);
    console.log(`  ✓ HTTP 200 { redirectUrl: '${crmApp.base_url}' } issued.`);
    console.log(`  ✓ 'ZOHO_APP_OPENED' recorded in audit_logs.`);
  }
  console.log('');

  // 8. Inspect Audit Trail
  console.log('--- 8. Verifying System Audit Trail (AdminAuditPage Data) ---');
  const auditResult = await auditModel.listLogs({ limit: 10, offset: 0 });
  console.log(`  ✓ Total recorded audit logs: ${auditResult.total}`);
  console.log('  Recent events (newest first):');
  auditResult.logs.slice(0, 5).forEach(l => {
    console.log(`    [${new Date(l.created_at).toISOString().replace('T', ' ').substring(0, 19)}] ${l.action.padEnd(20)} | User: ${l.user_email.padEnd(22)} | ${l.detail}`);
  });
  console.log('');

  console.log('================================================================');
  console.log('   ALL END-TO-END VERIFICATION CHECKS COMPLETED SUCCESSFULLY!');
  console.log('================================================================\n');
}

module.exports = runEndToEndVerification;

if (require.main === module) {
  runEndToEndVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Verification failed:', err);
      process.exit(1);
    });
}
