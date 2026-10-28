'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const pool = require('../db');
const { getSecret, verifyToken } = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validPassword = (value) => typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value, 'utf8') <= 72;
const onlyFields = (body, fields) => body && typeof body === 'object' && !Array.isArray(body)
  && Object.keys(body).every((key) => fields.includes(key));
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
});

router.post('/register', async (req, res, next) => {
  try {
    if (!onlyFields(req.body, ['name', 'email', 'password'])) return res.status(400).json({ error: 'Les champs envoyés sont invalides.' });
    const { name, email, password } = req.body || {};
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanName || cleanName.length > 255 || cleanEmail.length > 255 || !EMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ error: 'Nom, email valide et mot de passe requis.' });
    }
    if (!validPassword(password)) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir entre 8 caractères et 72 octets.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, is_approved) VALUES (?, ?, ?, ?, 0)',
      [cleanName, cleanEmail, passwordHash, 'user']
    );
    return res.status(201).json({ id: result.insertId, status: 'pending' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Cette adresse email est déjà utilisée.' });
    }
    return next(e);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    if (!onlyFields(req.body, ['email', 'password'])) return res.status(400).json({ error: 'Les champs envoyés sont invalides.' });
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || email.length > 255 || !EMAIL_RE.test(email.trim())
      || typeof password !== 'string' || !password.length || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }
    const [rows] = await pool.query(
      'SELECT id, name, email, password_hash, role, is_approved FROM users WHERE email = ?',
      [String(email).trim().toLowerCase()]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }
    if (!user.is_approved) {
      return res.status(403).json({
        code: 'ACCOUNT_PENDING',
        error: 'Votre compte attend l’approbation de l’administrateur.',
      });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      getSecret(),
      { expiresIn: '12h' }
    );
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (e) {
    return next(e);
  }
});

router.post('/change-password', verifyToken, async (req, res, next) => {
  try {
    if (!onlyFields(req.body, ['currentPassword', 'newPassword'])) return res.status(400).json({ error: 'Les champs envoyés sont invalides.' });
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || !currentPassword.length || Buffer.byteLength(currentPassword, 'utf8') > 72 || !validPassword(newPassword)) {
      return res.status(400).json({ error: 'Le mot de passe actuel et un nouveau mot de passe de 8 à 72 octets sont requis.' });
    }
    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      return res.status(400).json({ error: 'Le mot de passe actuel est incorrect.' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
    return res.json({ ok: true });
  } catch (error) { return next(error); }
});

module.exports = router;
