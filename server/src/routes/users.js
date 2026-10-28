'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('node:crypto');
const pool = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { writeAudit } = require('../audit');

const router = express.Router();
router.use(verifyToken, requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, is_approved
       FROM users
       WHERE role = 'user'
       ORDER BY is_approved ASC, name ASC`
    );
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

router.patch('/:id/approval', async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Identifiant invalide.' });
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)
      || Object.keys(req.body).some((key) => key !== 'approved')) return res.status(400).json({ error: 'Les champs du statut sont invalides.' });
    const id = Number(req.params.id);
    const { approved } = req.body || {};
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647 || typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'Identifiant ou statut invalide.' });
    }
    const [result] = await pool.query(
      'UPDATE users SET is_approved = ? WHERE id = ? AND role = ?',
      [approved ? 1 : 0, id, 'user']
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }
    await writeAudit(pool, req.user.id, approved ? 'user.approved' : 'user.suspended', 'user', id);
    return res.json({ id, is_approved: approved ? 1 : 0 });
  } catch (e) {
    return next(e);
  }
});

router.post('/:id/password-reset', async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Identifiant invalide.' });
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) return res.status(400).json({ error: 'Identifiant invalide.' });
    const temporaryPassword = randomBytes(18).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const [result] = await pool.query(
      'UPDATE users SET password_hash = ? WHERE id = ? AND role = ?',
      [passwordHash, id, 'user']
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    await writeAudit(pool, req.user.id, 'user.password_reset', 'user', id);
    return res.json({ temporaryPassword });
  } catch (error) { return next(error); }
});

module.exports = router;
