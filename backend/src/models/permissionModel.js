const { pool, query } = require('../config/db');

const listAll = async () => {
  const sql = 'SELECT id, key, label, description, created_at FROM permissions ORDER BY id ASC';
  const res = await query(sql);
  return res.rows;
};

const findById = async (id) => {
  const res = await query('SELECT * FROM permissions WHERE id = $1', [id]);
  return res.rows[0] || null;
};

const assignPermissionsToRole = async (roleId, permissionIds = []) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Remove existing role_permissions
    await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

    // Insert new role_permissions
    if (Array.isArray(permissionIds) && permissionIds.length > 0) {
      for (const permId of permissionIds) {
        await client.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [roleId, permId]
        );
      }
    }

    await client.query('COMMIT');

    // Return the updated role with permissions
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
      WHERE r.id = $1
      GROUP BY r.id
    `;
    const res = await query(sql, [roleId]);
    const row = res.rows[0];
    return {
      ...row,
      permissionKeys: Array.isArray(row.permissions) ? row.permissions.map(p => p.key) : [],
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  listAll,
  findById,
  assignPermissionsToRole,
};
