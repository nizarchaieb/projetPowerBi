'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('node:crypto');
const pool = require('../src/db');
const { getSecret } = require('../src/middleware/auth');
const authRoutes = require('../src/routes/auth');

async function withAuthApi(query, run) {
  const originalQuery = pool.query;
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  pool.query = async (sql, params) => {
    if (sql.startsWith('SELECT id, name, email, role, is_approved FROM users')) {
      return [[{ id: 12, name: 'User', email: 'user@example.test', role: 'user', is_approved: 1 }]];
    }
    return query(sql, params);
  };
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const token = jwt.sign({ id: 12 }, getSecret());
  try { await run(`http://127.0.0.1:${server.address().port}`, token); }
  finally {
    await new Promise((resolve) => server.close(resolve));
    pool.query = originalQuery;
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  }
}

test('les entrées d’inscription mal typées sont rejetées avant SQL', async () => {
  await withAuthApi(async () => { throw new Error('La requête SQL ne devrait pas être appelée.'); }, async (base) => {
    const response = await fetch(`${base}/api/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: { value: 'Admin' }, email: 'bad', password: 'password123' }),
    });
    assert.equal(response.status, 400);
  });
});

test('la route de connexion limite à dix tentatives par fenêtre', async () => {
  await withAuthApi(async () => [[]], async (base) => {
    const statuses = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await fetch(`${base}/api/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.test', password: 'wrong-password' }),
      });
      statuses.push(response.status);
    }
    assert.equal(statuses.filter((status) => status === 401).length, 10);
    assert.equal(statuses[10], 429);
  });
});

test('un utilisateur authentifié peut changer son mot de passe après vérification', async () => {
  const currentHash = await bcrypt.hash('old-password-123', 4);
  let updatedHash;
  await withAuthApi(async (sql, params) => {
    if (sql === 'SELECT password_hash FROM users WHERE id = ?') return [[{ password_hash: currentHash }]];
    if (sql === 'UPDATE users SET password_hash = ? WHERE id = ?') {
      updatedHash = params[0];
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Requête inattendue : ${sql}`);
  }, async (base, token) => {
    const response = await fetch(`${base}/api/auth/change-password`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'old-password-123', newPassword: 'new-password-456' }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
    assert.equal(await bcrypt.compare('new-password-456', updatedHash), true);
  });
});
