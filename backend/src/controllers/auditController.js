const asyncHandler = require('../utils/asyncHandler');
const auditModel = require('../models/auditModel');

const list = asyncHandler(async (req, res) => {
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const action = req.query.action || '';
  const userEmail = req.query.userEmail || '';

  const result = await auditModel.listLogs({
    limit,
    offset,
    action,
    userEmail,
  });

  return res.status(200).json({
    logs: result.logs,
    total: result.total,
  });
});

module.exports = {
  list,
};
