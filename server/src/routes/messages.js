'use strict';

const express = require('express');
const pool = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/messages — public (formulaire de contact).
router.post('/', async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)
      || Object.keys(req.body).some((key) => !['name', 'email', 'subject', 'message'].includes(key))) {
      return res.status(400).json({ error: 'Les champs du message sont invalides.' });
    }
    const { name, email, subject, message } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 255) {
      return res.status(400).json({ error: 'Le nom est requis.' });
    }
    if (typeof email !== 'string' || email.trim().length > 255 || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'Une adresse email valide est requise.' });
    }
    if (subject !== undefined && (typeof subject !== 'string' || subject.trim().length > 255)) {
      return res.status(400).json({ error: 'Le sujet doit contenir 255 caractères maximum.' });
    }
    if (typeof message !== 'string' || !message.trim() || message.trim().length > 5000) {
      return res.status(400).json({ error: 'Le message est requis.' });
    }
    const [result] = await pool.query(
      'INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), (subject || '').trim(), message.trim()]
    );
    return res.status(201).json({ id: result.insertId, ok: true });
  } catch (e) {
    return next(e);
  }
});

// GET /api/messages — admin.
router.get('/', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, subject, message, is_read, created_at FROM messages ORDER BY created_at DESC'
    );
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

// PATCH /api/messages/:id/read — admin (marquer comme lu).
router.patch('/:id/read', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id) || Number(req.params.id) > 2147483647) return res.status(400).json({ error: 'Identifiant de message invalide.' });
    await pool.query('UPDATE messages SET is_read = 1 WHERE id = ?', [req.params.id]);
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

// DELETE /api/messages/:id — admin.
router.delete('/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id) || Number(req.params.id) > 2147483647) return res.status(400).json({ error: 'Identifiant de message invalide.' });
    await pool.query('DELETE FROM messages WHERE id = ?', [req.params.id]);
    return res.status(204).send();
  } catch (e) {
    return next(e);
  }
});

module.exports = router;
