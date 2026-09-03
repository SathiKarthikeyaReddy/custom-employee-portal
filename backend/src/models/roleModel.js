const { query } = require('../config/db');

const listAllWithPermissions = async () => {
  const sql = `
    SELECT
      r.id,
      r.name,
      r.description,
      r.created_at,
      COALESCE(
        json_agg(
          jsonb_build_object('id', p.id, 'key', p.key, 'label', p.label)
        ) FILTER (WHERE p.id IS NOT NULL), '[]'
      ) as permissions
    FROM roles r
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id
    GROUP BY r.id
    ORDER BY r.id ASC
  `;
  const res = await query(sql);
  return res.rows.map(row => ({
    ...row,
    permissionKeys: Array.isArray(row.permissions) ? row.permissions.map(p => p.key) : [],
  }));
};

const findById = async (id) => {
  const res = await query('SELECT * FROM roles WHERE id = $1', [id]);
  return res.rows[0] || null;
};

const findByName = async (name) => {
  const res = await query('SELECT * FROM roles WHERE LOWER(name) = LOWER($1)', [name]);
  return res.rows[0] || null;
};

const createRole = async ({ name, description = '' }) => {
  const sql = `
    INSERT INTO roles (name, description)
    VALUES ($1, $2)
    RETURNING id, name, description, created_at
  `;
  const res = await query(sql, [name, description]);
  return {
    ...res.rows[0],
    permissions: [],
    permissionKeys: [],
  };
};

const updateRole = async (id, { name, description }) => {
  const fields = [];
  const values = [];
  let idx = 1;

  if (name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(name);
  }
  if (description !== undefined) {
    fields.push(`description = $${idx++}`);
    values.push(description);
  }

  if (fields.length === 0) {
    return findById(id);
  }

  values.push(id);
  const sql = `
    UPDATE roles
    SET ${fields.join(', ')}
    WHERE id = $${idx}
    RETURNING id, name, description, created_at
  `;
  const res = await query(sql, values);
  return res.rows[0] || null;
};

const deleteRole = async (id) => {
  const res = await query('DELETE FROM roles WHERE id = $1 RETURNING id, name', [id]);
  return res.rows[0] || null;
};

module.exports = {
  listAllWithPermissions,
  findById,
  findByName,
  createRole,
  updateRole,
  deleteRole,
};
