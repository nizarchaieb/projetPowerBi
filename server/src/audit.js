'use strict';

async function writeAudit(pool, adminId, action, targetType, targetId, details = null) {
  await pool.query(
    'INSERT INTO audit_logs (admin_id, action, target_type, target_id, details_json) VALUES (?, ?, ?, ?, ?)',
    [adminId, action, targetType, targetId === null || targetId === undefined ? null : String(targetId), details ? JSON.stringify(details) : null]
  );
}

module.exports = { writeAudit };
