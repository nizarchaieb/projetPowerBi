'use strict';

const express = require('express');
const pool = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.get('/', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT l.id, l.admin_id, u.name AS admin_name, l.action, l.target_type, l.target_id, l.details_json, l.created_at
       FROM audit_logs l LEFT JOIN users u ON u.id = l.admin_id
       ORDER BY l.created_at DESC, l.id DESC LIMIT 200`
    );
    return res.json(rows);
  } catch (error) { return next(error); }
});

module.exports = router;
