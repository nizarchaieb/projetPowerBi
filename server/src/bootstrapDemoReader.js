'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

async function bootstrapDemoReader() {
  const name = String(process.env.DEMO_NAME || 'Lecteur de démonstration').trim();
  const email = String(process.env.DEMO_EMAIL || '').trim().toLowerCase();
  const password = process.env.DEMO_PASSWORD;
  if (!name || name.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    throw new Error('Définissez DEMO_EMAIL et un DEMO_NAME valide dans .env.');
  }
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Définissez DEMO_PASSWORD (8 à 72 octets) dans .env.');
  }

  const [existing] = await pool.query('SELECT id, role FROM users WHERE email = ?', [email]);
  if (existing[0]?.role === 'admin') throw new Error('Le compte lecteur ne peut pas utiliser une adresse administrateur.');
  const hash = await bcrypt.hash(password, 12);
  if (existing.length) {
    await pool.query('UPDATE users SET name = ?, password_hash = ?, role = ?, is_approved = 1 WHERE id = ? AND role = ?',
      [name, hash, 'user', existing[0].id, 'user']);
  } else {
    await pool.query('INSERT INTO users (name, email, password_hash, role, is_approved) VALUES (?, ?, ?, ?, 1)',
      [name, email, hash, 'user']);
  }
  await pool.end();
}

bootstrapDemoReader().catch(async (error) => {
  process.stderr.write(`${error.message}\n`);
  await pool.end();
  process.exitCode = 1;
});
