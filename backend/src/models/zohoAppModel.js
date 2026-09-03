const { query } = require('../config/db');

const listAll = async () => {
  const sql = `
    SELECT id, key, name, purpose, base_url, permission_key, is_provisioned
    FROM zoho_apps
    ORDER BY id ASC
  `;
  const res = await query(sql);
  return res.rows;
};

const findByKey = async (key) => {
  const sql = `
    SELECT id, key, name, purpose, base_url, permission_key, is_provisioned
    FROM zoho_apps
    WHERE LOWER(key) = LOWER($1)
  `;
  const res = await query(sql, [key]);
  return res.rows[0] || null;
};

module.exports = {
  listAll,
  findByKey,
};
