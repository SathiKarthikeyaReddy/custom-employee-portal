require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, query } = require('./db');
const initDb = require('./initDb');

const seedData = async () => {
  console.log('Starting database seeding...');
  await initDb();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Permissions
    const permissions = [
      { key: 'zoho.people.access', label: 'Access Zoho People', description: 'Permission to access Zoho People application' },
      { key: 'zoho.crm.access', label: 'Access Zoho CRM', description: 'Permission to access Zoho CRM application' },
      { key: 'zoho.desk.access', label: 'Access Zoho Desk', description: 'Permission to access Zoho Desk application' },
      { key: 'zoho.books.access', label: 'Access Zoho Books', description: 'Permission to access Zoho Books application' },
      { key: 'admin.users.manage', label: 'Manage users', description: 'Permission to view, create, edit, and delete portal users' },
      { key: 'admin.roles.manage', label: 'Manage roles', description: 'Permission to view, create, edit, and delete roles' },
      { key: 'admin.permissions.manage', label: 'Manage permissions', description: 'Permission to view permissions and assign them to roles' },
      { key: 'admin.audit.view', label: 'View audit logs', description: 'Permission to inspect security and access audit logs' },
    ];

    for (const perm of permissions) {
      await client.query(
        `INSERT INTO permissions (key, label, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE
         SET label = EXCLUDED.label, description = EXCLUDED.description`,
        [perm.key, perm.label, perm.description]
      );
    }
    console.log('Permissions seeded.');

    // 2. Zoho Apps
    const apps = [
      {
        key: 'people',
        name: 'Zoho People',
        purpose: 'HR management functions',
        base_url: process.env.ZOHO_PEOPLE_URL || 'https://people.zoho.in',
        permission_key: 'zoho.people.access',
        is_provisioned: true,
      },
      {
        key: 'crm',
        name: 'Zoho CRM',
        purpose: 'Sales and customer relationship management',
        base_url: process.env.ZOHO_CRM_URL || 'https://crm.zoho.in',
        permission_key: 'zoho.crm.access',
        is_provisioned: true,
      },
      {
        key: 'desk',
        name: 'Zoho Desk',
        purpose: 'Support ticketing and case management',
        base_url: process.env.ZOHO_DESK_URL || 'https://desk.zoho.in',
        permission_key: 'zoho.desk.access',
        is_provisioned: false, // Not yet provisioned in trial org
      },
      {
        key: 'books',
        name: 'Zoho Books',
        purpose: 'Financial and accounting operations',
        base_url: process.env.ZOHO_BOOKS_URL || 'https://books.zoho.in',
        permission_key: 'zoho.books.access',
        is_provisioned: true,
      },
    ];

    for (const app of apps) {
      await client.query(
        `INSERT INTO zoho_apps (key, name, purpose, base_url, permission_key, is_provisioned)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (key) DO UPDATE
         SET name = EXCLUDED.name,
             purpose = EXCLUDED.purpose,
             base_url = EXCLUDED.base_url,
             permission_key = EXCLUDED.permission_key,
             is_provisioned = EXCLUDED.is_provisioned`,
        [app.key, app.name, app.purpose, app.base_url, app.permission_key, app.is_provisioned]
      );
    }
    console.log('Zoho apps seeded.');

    // 3. Roles
    const roles = [
      { name: 'Admin', description: 'System Administrator with full access to all applications and administrative functions' },
      { name: 'HR', description: 'Human Resources role with access to Zoho People' },
      { name: 'Sales', description: 'Sales role with access to Zoho CRM' },
      { name: 'Support', description: 'Customer Support role with access to Zoho Desk' },
      { name: 'Finance', description: 'Finance role with access to Zoho Books' },
      { name: 'Manager', description: 'Management role with audit oversight privileges' },
    ];

    const roleMap = {};
    for (const role of roles) {
      const res = await client.query(
        `INSERT INTO roles (name, description)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE
         SET description = EXCLUDED.description
         RETURNING id, name`,
        [role.name, role.description]
      );
      roleMap[role.name] = res.rows[0].id;
    }
    console.log('Roles seeded.');

    // Query all permissions to map keys to IDs
    const permRes = await client.query('SELECT id, key FROM permissions');
    const permMap = {};
    for (const row of permRes.rows) {
      permMap[row.key] = row.id;
    }

    // Role-Permission mappings
    const rolePermissionGrants = {
      Admin: [
        'zoho.people.access',
        'zoho.crm.access',
        'zoho.desk.access',
        'zoho.books.access',
        'admin.users.manage',
        'admin.roles.manage',
        'admin.permissions.manage',
        'admin.audit.view',
      ],
      HR: ['zoho.people.access'],
      Sales: ['zoho.crm.access'],
      Support: ['zoho.desk.access'],
      Finance: ['zoho.books.access'],
      Manager: ['admin.audit.view'],
    };

    for (const [roleName, permKeys] of Object.entries(rolePermissionGrants)) {
      const roleId = roleMap[roleName];
      for (const key of permKeys) {
        const permId = permMap[key];
        if (permId) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [roleId, permId]
          );
        }
      }
    }
    console.log('Role permissions seeded.');

    // 4. Default Seed Admin User
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@brainwave.io';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

    const existingUserRes = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    let adminUserId;

    if (existingUserRes.rows.length === 0) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      const userRes = await client.query(
        `INSERT INTO users (name, email, password_hash, is_active)
         VALUES ($1, $2, $3, true)
         RETURNING id`,
        ['System Administrator', adminEmail, passwordHash]
      );
      adminUserId = userRes.rows[0].id;
      console.log(`Admin user created with ID ${adminUserId}.`);
    } else {
      adminUserId = existingUserRes.rows[0].id;
      console.log(`Admin user already exists with ID ${adminUserId}.`);
    }

    // Assign Admin role to admin user
    const adminRoleId = roleMap['Admin'];
    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [adminUserId, adminRoleId]
    );
    console.log('Admin user assigned Admin role.');

    await client.query('COMMIT');
    console.log('Database seeding completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database seeding failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

if (require.main === module) {
  seedData()
    .then(() => {
      console.log('Seed process finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal seed error:', err);
      process.exit(1);
    });
}

module.exports = seedData;
