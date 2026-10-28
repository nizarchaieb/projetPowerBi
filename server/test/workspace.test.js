'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const pool = require('../src/db');
const { getSecret } = require('../src/middleware/auth');
const workspaceRoutes = require('../src/routes/workspace');

test('les jeux de données et rapports sont toujours filtrés par le compte connecté', async () => {
  const originalQuery = pool.query;
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const scopedQueries = [];
  pool.query = async (sql, params) => {
    if (sql.startsWith('SELECT id, name, email, role, is_approved FROM users')) {
      return [[{ id: 27, name: 'Client A', email: 'a@example.test', role: 'user', is_approved: 1 }]];
    }
    if (/FROM custom_datasets WHERE user_id = \?/i.test(sql)) {
      scopedQueries.push({ sql, params });
      return [[]];
    }
    if (/FROM custom_datasets WHERE id = \? AND user_id = \?/i.test(sql)) {
      scopedQueries.push({ sql, params });
      return [[]];
    }
    if (/FROM saved_reports WHERE user_id = \?/i.test(sql)) {
      scopedQueries.push({ sql, params });
      return [[]];
    }
    throw new Error(`Requête inattendue : ${sql}`);
  };

  const app = express();
  app.use(express.json());
  app.use('/api/workspace', workspaceRoutes);
  app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const token = jwt.sign({ id: 27 }, getSecret());
  const base = `http://127.0.0.1:${server.address().port}/api/workspace`;
  try {
    const datasets = await fetch(`${base}/datasets`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(datasets.status, 200);
    const rows = await fetch(`${base}/datasets/99/rows`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(rows.status, 404);
    const reports = await fetch(`${base}/reports`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(reports.status, 200);
    assert.equal(scopedQueries.length, 3);
    assert.ok(scopedQueries.every((query) => query.params.includes(27)));
    assert.ok(scopedQueries.every((query) => /user_id = \?/i.test(query.sql)));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    pool.query = originalQuery;
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  }
});
