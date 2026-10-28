'use strict';

const jwt = require('jsonwebtoken');
const pool = require('../db');

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('JWT_SECRET doit contenir au moins 32 caractères aléatoires.');
  }
  return secret;
}

async function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, getSecret());
  } catch (e) {
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, is_approved FROM users WHERE id = ?',
      [decoded.id]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Compte introuvable.' });
    }
    if (!rows[0].is_approved) {
      return res.status(403).json({
        code: 'ACCOUNT_PENDING',
        error: 'Votre compte attend l’approbation de l’administrateur.',
      });
    }
    req.user = rows[0];
    return next();
  } catch (e) {
    return next(e);
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé à l’administrateur.' });
  }
  return next();
}

module.exports = { verifyToken, requireAdmin, getSecret };
