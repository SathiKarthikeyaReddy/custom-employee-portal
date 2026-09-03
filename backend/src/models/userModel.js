const { pool, query } = require('../config/db');

const findByEmail = async (email) => {
  const res = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  return res.rows[0] || null;
};

const findById = async (id) => {
  const res = await query('SELECT id, name, email, is_active, created_at, updated_at FROM users WHERE id = $1', [id]);
  return res.rows[0] || null;
};

const getUserWithRolesAndPermissions = async (userId) => {
  const sql = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.is_active,
      u.created_at,
      u.updated_at,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('id', r.id, 'name', r.name))
        FILTER (WHERE r.id IS NOT NULL), '[]'
      ) as roles,
      COALESCE(
        json_agg(DISTINCT p.key)
        FILTER (WHERE p.key IS NOT NULL), '[]'
      ) as permissions
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = $1
    GROUP BY u.id
  `;
  const res = await query(sql, [userId]);
  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  const roleNames = Array.isArray(row.roles) ? row.roles.map(r => r.name) : [];
  const permissions = Array.isArray(row.permissions) ? row.permissions : [];

  return {
    ...row,
    roleNames,
    permissions,
  };
};

const listAllWithRoles = async () => {
  const sql = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.is_active,
      u.created_at,
      u.updated_at,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('id', r.id, 'name', r.name))
        FILTER (WHERE r.id IS NOT NULL), '[]'
      ) as roles
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    GROUP BY u.id
    ORDER BY u.id ASC
  `;
  const res = await query(sql);
  return res.rows.map(row => ({
    ...row,
    roleNames: Array.isArray(row.roles) ? row.roles.map(r => r.name) : [],
  }));
};

const createUser = async ({ name, email, passwordHash, roleIds = [] }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertUserSql = `
      INSERT INTO users (name, email, password_hash, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING id, name, email, is_active, created_at, updated_at
    `;
    const userRes = await client.query(insertUserSql, [name, email.toLowerCase(), passwordHash]);
    const user = userRes.rows[0];

    if (Array.isArray(roleIds) && roleIds.length > 0) {
      for (const roleId of roleIds) {
        await client.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [user.id, roleId]
        );
      }
    }

    await client.query('COMMIT');
    return getUserWithRolesAndPermissions(user.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const updateUser = async (id, { name, email, isActive, roleIds }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(name);
    }
    if (email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(email.toLowerCase());
    }
    if (isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(isActive);
    }

    if (fields.length > 0) {
      fields.push(`updated_at = now()`);
      values.push(id);
      const updateSql = `
        UPDATE users
        SET ${fields.join(', ')}
        WHERE id = $${idx}
        RETURNING id, name, email, is_active, created_at, updated_at
      `;
      await client.query(updateSql, values);
    }

    if (roleIds !== undefined && Array.isArray(roleIds)) {
      await client.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
      for (const roleId of roleIds) {
        await client.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, roleId]
        );
      }
    }

    await client.query('COMMIT');
    return getUserWithRolesAndPermissions(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const updatePassword = async (id, passwordHash) => {
  const sql = `
    UPDATE users
    SET password_hash = $1, updated_at = now()
    WHERE id = $2
    RETURNING id, email
  `;
  const res = await query(sql, [passwordHash, id]);
  return res.rows[0] || null;
};

const deleteUser = async (id) => {
  const res = await query('DELETE FROM users WHERE id = $1 RETURNING id, email', [id]);
  return res.rows[0] || null;
};

module.exports = {
  findByEmail,
  findById,
  getUserWithRolesAndPermissions,
  listAllWithRoles,
  createUser,
  updateUser,
  updatePassword,
  deleteUser,
};
