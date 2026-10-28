'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

async function bootstrapAdmin() {
  const name = String(process.env.ADMIN_NAME || 'Administrateur').trim();
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!name || name.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    throw new Error('Définissez ADMIN_EMAIL et un ADMIN_NAME valide dans .env.');
  }
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Définissez ADMIN_PASSWORD (8 à 72 octets) dans .env.');
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, is_approved)
     VALUES (?, ?, ?, 'admin', 1)
     ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = 'admin', is_approved = 1`,
    [name, email, hash]
  );
  await pool.end();
}

bootstrapAdmin().catch(async (error) => {
  process.stderr.write(`${error.message}\n`);
  await pool.end();
  process.exitCode = 1;
});
