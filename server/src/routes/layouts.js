'use strict';

const express = require('express');
const pool = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const DEFAULTS = {
  demo: { order: ['monthly', 'status', 'region', 'product', 'client'], hidden: [] },
  personal: { order: ['month', 'dimension', 'status'], hidden: [] },
};

function normalizeLayout(input, scope) {
  const allowed = DEFAULTS[scope].order;
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some((key) => !['order', 'hidden'].includes(key))
    || !Array.isArray(input.order) || !Array.isArray(input.hidden)) return null;
  if (input.order.some((id) => !allowed.includes(id)) || new Set(input.order).size !== input.order.length) return null;
  if (input.hidden.some((id) => !allowed.includes(id)) || new Set(input.hidden).size !== input.hidden.length) return null;
  return {
    order: [...input.order, ...allowed.filter((id) => !input.order.includes(id))],
    hidden: input.hidden,
  };
}

function decodeLayout(value, scope) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return normalizeLayout(parsed, scope) || DEFAULTS[scope];
  } catch {
    return DEFAULTS[scope];
  }
}

async function readLayout(userId, scope) {
  const [rows] = await pool.query('SELECT layout_json FROM dashboard_layouts WHERE user_id = ? AND scope = ?', [userId, scope]);
  return rows.length ? decodeLayout(rows[0].layout_json, scope) : DEFAULTS[scope];
}

async function saveLayout(userId, scope, layout) {
  await pool.query(
    `INSERT INTO dashboard_layouts (user_id, scope, layout_json) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE layout_json = VALUES(layout_json)`,
    [userId, scope, JSON.stringify(layout)]
  );
}

router.get('/demo', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT dl.layout_json FROM dashboard_layouts dl JOIN users u ON u.id = dl.user_id
       WHERE dl.scope = 'demo' AND u.role = 'admin' ORDER BY u.id ASC LIMIT 1`
    );
    return res.json(rows.length ? decodeLayout(rows[0].layout_json, 'demo') : DEFAULTS.demo);
  } catch (error) { return next(error); }
});

router.get('/demo/admin', verifyToken, requireAdmin, async (req, res, next) => {
  try { return res.json(await readLayout(req.user.id, 'demo')); }
  catch (error) { return next(error); }
});

router.put('/demo', verifyToken, requireAdmin, async (req, res, next) => {
  const layout = normalizeLayout(req.body, 'demo');
  if (!layout) return res.status(400).json({ error: 'La disposition des graphiques est invalide.' });
  try {
    await saveLayout(req.user.id, 'demo', layout);
    return res.json(layout);
  } catch (error) { return next(error); }
});

router.get('/personal', verifyToken, async (req, res, next) => {
  try { return res.json(await readLayout(req.user.id, 'personal')); }
  catch (error) { return next(error); }
});

router.put('/personal', verifyToken, async (req, res, next) => {
  const layout = normalizeLayout(req.body, 'personal');
  if (!layout) return res.status(400).json({ error: 'La disposition des graphiques est invalide.' });
  try {
    await saveLayout(req.user.id, 'personal', layout);
    return res.json(layout);
  } catch (error) { return next(error); }
});

module.exports = { router, normalizeLayout, DEFAULTS };
