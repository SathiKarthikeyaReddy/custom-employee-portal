const { query } = require('../config/db');

const createLog = async ({ userId = null, userEmail, action, detail = '', ipAddress = '' }) => {
  const sql = `
    INSERT INTO audit_logs (user_id, user_email, action, detail, ip_address)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, user_id, user_email, action, detail, ip_address, created_at
  `;
  const res = await query(sql, [userId, userEmail, action, detail, ipAddress]);
  return res.rows[0];
};

const listLogs = async ({ limit = 50, offset = 0, action = '', userEmail = '' }) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (action && action.trim() !== '') {
    conditions.push(`LOWER(action) LIKE LOWER($${idx++})`);
    params.push(`%${action.trim()}%`);
  }

  if (userEmail && userEmail.trim() !== '') {
    conditions.push(`LOWER(user_email) LIKE LOWER($${idx++})`);
    params.push(`%${userEmail.trim()}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Total count
  const countSql = `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`;
  const countRes = await query(countSql, params);
  const total = parseInt(countRes.rows[0].count, 10);

  // Paginated rows
  const limitIdx = idx++;
  const offsetIdx = idx++;
  const dataParams = [...params, limit, offset];

  const dataSql = `
    SELECT id, user_id, user_email, action, detail, ip_address, created_at
    FROM audit_logs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;
  const dataRes = await query(dataSql, dataParams);

  return {
    logs: dataRes.rows,
    total,
  };
};

module.exports = {
  createLog,
  listLogs,
};
