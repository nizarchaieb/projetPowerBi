'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const pool = require('../src/db');
const { getSecret } = require('../src/middleware/auth');
const { router } = require('../src/routes/customMeasures');

async function withApi(role, query, run) {
  const originalQuery = pool.query;
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  pool.query = async (...args) => {
    const [sql, params] = args;
    if (sql.startsWith('SELECT id, name, email, role, is_approved FROM users')) {
      return [[{ id: 42, name: 'Test', email: 'test@example.test', role, is_approved: 1 }]];
    }
    return query(sql, params);
  };

  const app = express();
  app.use(express.json());
  app.use('/api/measures', router);
  app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const token = jwt.sign({ id: 42 }, getSecret());
  try {
    await run(`http://127.0.0.1:${server.address().port}`, token);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    pool.query = originalQuery;
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  }
}

test('un utilisateur non administrateur ne peut pas créer une mesure (403)', async () => {
  await withApi('user', async () => { throw new Error('La requête SQL ne devrait pas être appelée.'); }, async (base, token) => {
    const response = await fetch(`${base}/api/measures`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ titre: 'Test', formule: 'sum', colonne: 'prix_total', type_graphique: 'bar' }),
    });
    assert.equal(response.status, 403);
  });
});

test('une formule inconnue est refusée (400)', async () => {
  await withApi('admin', async () => { throw new Error('La requête SQL ne devrait pas être appelée.'); }, async (base, token) => {
    const response = await fetch(`${base}/api/measures`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ titre: 'Test', formule: 'DROP TABLE users', colonne: 'prix_total', type_graphique: 'bar' }),
    });
    assert.equal(response.status, 400);
  });
});

test('seules les mesures visibles sont présentées aux clients', async () => {
  const visible = { id: 1, titre: 'CA par région', formule: 'sum', colonne: 'prix_total', group_by: 'region', type_graphique: 'bar', ordre: 1, visible: 1 };
  const hidden = { id: 2, titre: 'Interne', formule: 'sum', colonne: 'prix_total', group_by: 'region', type_graphique: 'bar', ordre: 2, visible: 0 };
  await withApi('user', async (sql) => {
    if (sql.includes('FROM custom_measures WHERE visible = 1')) return [[visible, hidden].filter((measure) => measure.visible)];
    if (sql.includes('FROM fact_ventes')) return [[{ label: 'South', value: '100' }]];
    throw new Error(`Requête inattendue : ${sql}`);
  }, async (base) => {
    const response = await fetch(`${base}/api/measures`);
    assert.equal(response.status, 200);
    const measures = await response.json();
    assert.deepEqual(measures.map((measure) => measure.id), [1]);
    assert.equal(measures[0].data[0].value, 100);
  });
});

test('les requêtes ne peuvent employer que des colonnes SQL de la liste blanche', async () => {
  const { validateMeasure, buildMeasureQuery } = require('../src/routes/customMeasures');
  const invalid = validateMeasure({ titre: 'Test', formule: 'sum', colonne: 'prix_total; DROP TABLE users', group_by: 'region', type_graphique: 'bar' });
  assert.match(invalid.error, /Colonne invalide/);
  const valid = validateMeasure({ titre: 'CA par région', formule: 'sum', colonne: 'prix_total', group_by: 'region', type_graphique: 'bar' });
  assert.match(buildMeasureQuery(valid.value).sql, /SUM\(f\.prix_total\)/);
  assert.doesNotMatch(buildMeasureQuery(valid.value).sql, /DROP TABLE/);
});
