'use strict';

const express = require('express');
const pool = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const PAGES = ['ventes', 'annulations'];
function validateInsight(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some((key) => !['page', 'title', 'text', 'sort_order'].includes(key))) {
    return { error: 'Les champs de l’analyse sont invalides.' };
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const order = body.sort_order === undefined ? 0 : body.sort_order;
  if (!PAGES.includes(body.page) || !title || title.length > 255 || !text || text.length > 5000) {
    return { error: 'Page, titre (255 caractères max.) et texte (5 000 caractères max.) requis.' };
  }
  if (!Number.isSafeInteger(order) || order < 0 || order > 10000) return { error: 'Ordre d’affichage invalide.' };
  return { value: { page: body.page, title, text, sort_order: order } };
}

// GET /api/insights?page=ventes|annulations — public dashboard annotations.
router.get('/', async (req, res, next) => {
  try {
    const page = PAGES.includes(req.query.page) ? req.query.page : 'ventes';
    const [rows] = await pool.query(
      'SELECT id, page, title, text, sort_order FROM insights WHERE page = ? ORDER BY sort_order ASC, id ASC',
      [page]
    );
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

// POST /api/insights — admin.
router.post('/', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const validated = validateInsight(req.body);
    if (validated.error) return res.status(400).json({ error: validated.error });
    const { page, title, text, sort_order } = validated.value;
    const [result] = await pool.query(
      'INSERT INTO insights (page, title, text, sort_order) VALUES (?, ?, ?, ?)',
      [page, title, text, sort_order]
    );
    const [rows] = await pool.query('SELECT id, page, title, text, sort_order FROM insights WHERE id = ?', [result.insertId]);
    return res.status(201).json(rows[0]);
  } catch (e) {
    return next(e);
  }
});

// PUT /api/insights/:id — admin.
router.put('/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id) || Number(req.params.id) > 2147483647) return res.status(400).json({ error: 'Identifiant invalide.' });
    const validated = validateInsight(req.body);
    if (validated.error) return res.status(400).json({ error: validated.error });
    const { page, title, text, sort_order } = validated.value;
    await pool.query(
      'UPDATE insights SET page = ?, title = ?, text = ?, sort_order = ? WHERE id = ?',
      [page, title, text, sort_order, req.params.id]
    );
    const [rows] = await pool.query('SELECT id, page, title, text, sort_order FROM insights WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Insight introuvable.' });
    return res.json(rows[0]);
  } catch (e) {
    return next(e);
  }
});

// DELETE /api/insights/:id — admin.
router.delete('/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id) || Number(req.params.id) > 2147483647) return res.status(400).json({ error: 'Identifiant invalide.' });
    await pool.query('DELETE FROM insights WHERE id = ?', [req.params.id]);
    return res.status(204).send();
  } catch (e) {
    return next(e);
  }
});

module.exports = router;
