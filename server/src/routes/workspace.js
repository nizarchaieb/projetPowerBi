'use strict';

const express = require('express');
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;
const MAX_COLUMNS = 100;
const MAX_ROWS = 5000;
const CHART_TYPES = new Set(['bar', 'line', 'pie', 'table']);
const AGGREGATIONS = new Set(['sum', 'average', 'count']);

router.use(verifyToken);

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

function parseJson(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function validateDataset(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.columns) || !Array.isArray(body.rows)) {
    return 'Le fichier CSV ne contient pas de données valides.';
  }
  if (Array.isArray(body) || Object.keys(body).some((key) => !['name', 'fileName', 'columns', 'rows'].includes(key))) {
    return 'Les champs du jeu de données sont invalides.';
  }
  if (body.columns.length < 1 || body.columns.length > MAX_COLUMNS) {
    return `Le fichier doit contenir entre 1 et ${MAX_COLUMNS} colonnes.`;
  }
  if (body.rows.length < 1 || body.rows.length > MAX_ROWS) {
    return `Le fichier doit contenir entre 1 et ${MAX_ROWS} lignes de données.`;
  }
  if (body.columns.some((column) => typeof column !== 'string' || !column.trim() || column.length > 255)) {
    return 'Chaque colonne doit avoir un nom valide de 255 caractères maximum.';
  }
  const columnNames = new Set(body.columns.map((column) => column.trim().toLocaleLowerCase('fr-FR')));
  if (columnNames.size !== body.columns.length) {
    return 'Les noms des colonnes doivent être uniques.';
  }
  if (body.rows.some((row) => !Array.isArray(row)
    || row.length !== body.columns.length
    || row.some((value) => typeof value !== 'string' || value.length > 10000))) {
    return 'Certaines lignes ne correspondent pas aux colonnes ou contiennent une valeur trop longue.';
  }
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_PAYLOAD_BYTES) {
    return 'Le fichier est trop volumineux. La limite est de 8 Mo.';
  }
  return null;
}

async function getDatasetForUser(datasetId, userId) {
  const [rows] = await pool.query(
    'SELECT id, columns_json FROM custom_datasets WHERE id = ? AND user_id = ?',
    [datasetId, userId]
  );
  return rows[0] || null;
}

router.get('/datasets', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, file_name, columns_json, row_count, created_at
       FROM custom_datasets WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
      [req.user.id]
    );
    return res.json(rows.map((row) => ({
      id: row.id,
      name: row.name,
      fileName: row.file_name,
      columns: parseJson(row.columns_json),
      rowCount: row.row_count,
      createdAt: row.created_at,
    })));
  } catch (e) {
    return next(e);
  }
});

router.post('/datasets', async (req, res, next) => {
  try {
    const error = validateDataset(req.body);
    if (error) return res.status(400).json({ error });

    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const fileName = typeof req.body.fileName === 'string' ? req.body.fileName.trim() : '';
    if (!name || name.length > 120 || !fileName || fileName.length > 255) {
      return res.status(400).json({ error: 'Le nom du jeu de données (120 caractères maximum) et celui du fichier (255 caractères maximum) sont requis.' });
    }

    const [result] = await pool.query(
      `INSERT INTO custom_datasets (user_id, name, file_name, columns_json, rows_json, row_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        name,
        fileName,
        JSON.stringify(req.body.columns),
        JSON.stringify(req.body.rows),
        req.body.rows.length,
      ]
    );
    return res.status(201).json({
      id: result.insertId,
      name,
      fileName,
      columns: req.body.columns,
      rowCount: req.body.rows.length,
    });
  } catch (e) {
    return next(e);
  }
});

router.get('/datasets/:id/rows', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Identifiant de jeu de données invalide.' });
    const [rows] = await pool.query(
      'SELECT rows_json FROM custom_datasets WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Jeu de données introuvable.' });
    return res.json(parseJson(rows[0].rows_json));
  } catch (e) {
    return next(e);
  }
});

router.delete('/datasets/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Identifiant de jeu de données invalide.' });
    const [result] = await pool.query(
      'DELETE FROM custom_datasets WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Jeu de données introuvable.' });
    return res.status(204).send();
  } catch (e) {
    return next(e);
  }
});

router.get('/reports', async (req, res, next) => {
  try {
    const where = ['user_id = ?'];
    const params = [req.user.id];
    if (req.query.datasetId !== undefined) {
      const datasetId = parseId(req.query.datasetId);
      if (!datasetId) return res.status(400).json({ error: 'Identifiant de jeu de données invalide.' });
      where.push('dataset_id = ?');
      params.push(datasetId);
    }
    const [rows] = await pool.query(
      `SELECT id, dataset_id, title, chart_type, dimension_column, metric_column, aggregation, created_at
       FROM saved_reports WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC`,
      params
    );
    return res.json(rows.map((row) => ({
      id: row.id,
      datasetId: row.dataset_id,
      title: row.title,
      chartType: row.chart_type,
      dimension: row.dimension_column,
      metric: row.metric_column,
      aggregation: row.aggregation,
      createdAt: row.created_at,
    })));
  } catch (e) {
    return next(e);
  }
});

function validateReport(body, columns) {
  if (!body || typeof body !== 'object') return 'La configuration du rapport est invalide.';
  if (Array.isArray(body) || Object.keys(body).some((key) => !['datasetId', 'title', 'chartType', 'dimension', 'metric', 'aggregation'].includes(key))) {
    return 'Les champs du rapport sont invalides.';
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > 120) return 'Le titre est requis (120 caractères maximum).';
  if (!CHART_TYPES.has(body.chartType)) return 'Choisissez un type de visualisation valide.';
  if (!columns.includes(body.dimension)) return 'La colonne de regroupement ne correspond pas au fichier.';
  if (!AGGREGATIONS.has(body.aggregation)) return 'Choisissez un calcul valide.';
  if (body.aggregation !== 'count' && !columns.includes(body.metric)) {
    return 'La colonne de valeur ne correspond pas au fichier.';
  }
  return null;
}

router.post('/reports', async (req, res, next) => {
  try {
    const datasetId = parseId(req.body && req.body.datasetId);
    if (!datasetId) return res.status(400).json({ error: 'Identifiant de jeu de données invalide.' });
    const dataset = await getDatasetForUser(datasetId, req.user.id);
    if (!dataset) return res.status(404).json({ error: 'Jeu de données introuvable.' });

    const error = validateReport(req.body, parseJson(dataset.columns_json));
    if (error) return res.status(400).json({ error });

    const [result] = await pool.query(
      `INSERT INTO saved_reports
       (user_id, dataset_id, title, chart_type, dimension_column, metric_column, aggregation)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        datasetId,
        req.body.title.trim(),
        req.body.chartType,
        req.body.dimension,
        req.body.aggregation === 'count' ? null : req.body.metric,
        req.body.aggregation,
      ]
    );
    return res.status(201).json({ id: result.insertId });
  } catch (e) {
    return next(e);
  }
});

router.put('/reports/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const datasetId = parseId(req.body && req.body.datasetId);
    if (!id || !datasetId) return res.status(400).json({ error: 'Identifiant invalide.' });
    const dataset = await getDatasetForUser(datasetId, req.user.id);
    if (!dataset) return res.status(404).json({ error: 'Jeu de données introuvable.' });

    const error = validateReport(req.body, parseJson(dataset.columns_json));
    if (error) return res.status(400).json({ error });

    const [result] = await pool.query(
      `UPDATE saved_reports
       SET title = ?, chart_type = ?, dimension_column = ?, metric_column = ?, aggregation = ?
       WHERE id = ? AND dataset_id = ? AND user_id = ?`,
      [
        req.body.title.trim(),
        req.body.chartType,
        req.body.dimension,
        req.body.aggregation === 'count' ? null : req.body.metric,
        req.body.aggregation,
        id,
        datasetId,
        req.user.id,
      ]
    );
    if (!result.affectedRows) {
      const [matches] = await pool.query(
        'SELECT id FROM saved_reports WHERE id = ? AND dataset_id = ? AND user_id = ?',
        [id, datasetId, req.user.id]
      );
      if (!matches.length) return res.status(404).json({ error: 'Rapport introuvable.' });
    }
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

router.delete('/reports/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Identifiant de rapport invalide.' });
    const [result] = await pool.query(
      'DELETE FROM saved_reports WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Rapport introuvable.' });
    return res.status(204).send();
  } catch (e) {
    return next(e);
  }
});

module.exports = router;
