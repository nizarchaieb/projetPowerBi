'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const pool = require('../src/db');
const { getSecret } = require('../src/middleware/auth');
const { router, normalizeLayout, DEFAULTS } = require('../src/routes/layouts');

test('la disposition ne contient que des widgets prévus et complète l’ordre', () => {
  assert.equal(normalizeLayout({ order: ['unexpected'], hidden: [] }, 'demo'), null);
  assert.deepEqual(normalizeLayout({ order: ['client'], hidden: ['status'] }, 'demo'), {
    order: ['client', 'monthly', 'status', 'region', 'product'], hidden: ['status'],
  });
  assert.equal(DEFAULTS.personal.order.length, 3);
});

test('la disposition personnelle est sauvegardée sous le compte authentifié', async () => {
  const originalQuery = pool.query;
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  let savedUserId;
  pool.query = async (sql, params) => {
    if (sql.startsWith('SELECT id, name, email, role, is_approved FROM users')) {
      return [[{ id: 73, name: 'Client', email: 'client@example.test', role: 'user', is_approved: 1 }]];
    }
    assert.match(sql, /INSERT INTO dashboard_layouts/);
    savedUserId = params[0];
    return [{ affectedRows: 1 }];
  };

  const app = express();
  app.use(express.json());
  app.use('/api/layouts', router);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const token = jwt.sign({ id: 73 }, getSecret());
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/layouts/personal`, {
      method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ order: ['status', 'month', 'dimension'], hidden: ['month'] }),
    });
    assert.equal(response.status, 200);
    assert.equal(savedUserId, 73);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    pool.query = originalQuery;
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  }
});
