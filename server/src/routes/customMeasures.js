'use strict';

const express = require('express');
const pool = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { FROM, buildFilter } = require('./helpers');
const { writeAudit } = require('../audit');

const router = express.Router();
const FORMULAS = ['sum', 'average', 'count', 'ratio', 'taux_annulation'];
const NUMERIC_COLUMNS = ['prix_total', 'prix_unitaire', 'quantite'];
const COLUMNS = [...NUMERIC_COLUMNS, 'id_commande'];
const SQL_COLUMNS = {
  prix_total: 'f.prix_total', prix_unitaire: 'f.prix_unitaire',
  quantite: 'f.quantite', id_commande: 'f.id_commande',
};
const GROUPS = {
  region: 'r.nom_region',
  produit: 'p.nom_produit',
  client: 'c.nom_client',
  mois: 'd.annee_mois',
};
const CHARTS = ['bar', 'line', 'pie', 'table'];
const FORMULA_LABELS = {
  sum: 'Somme', average: 'Moyenne', count: 'Nombre de lignes',
  ratio: 'Part du total', taux_annulation: 'Taux d’annulation des commandes',
};
const COLUMN_LABELS = {
  prix_total: 'Montant total', prix_unitaire: 'Prix unitaire',
  quantite: 'Quantité', id_commande: 'Commande',
};

function validateMeasure(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some((key) => !['titre', 'formule', 'colonne', 'group_by', 'type_graphique', 'ordre', 'visible'].includes(key))) {
    return { error: 'La configuration de la mesure est invalide.' };
  }
  const titre = typeof input.titre === 'string' ? input.titre.trim() : '';
  const formule = input.formule;
  const colonne = input.colonne;
  const groupBy = input.group_by === undefined || input.group_by === '' || input.group_by === null ? null : input.group_by;
  const typeGraphique = input.type_graphique;
  const ordre = input.ordre === undefined ? 0 : input.ordre;
  const visible = input.visible === undefined ? false : input.visible;

  if (!titre || titre.length > 120) return { error: 'Le titre est requis (120 caractères maximum).' };
  if (!FORMULAS.includes(formule)) return { error: 'Formule invalide.' };
  if (!COLUMNS.includes(colonne)) return { error: 'Colonne invalide.' };
  if ((formule === 'sum' || formule === 'average' || formule === 'ratio') && !NUMERIC_COLUMNS.includes(colonne)) {
    return { error: 'Cette formule exige une colonne numérique autorisée.' };
  }
  if (formule === 'taux_annulation' && colonne !== 'id_commande') {
    return { error: 'Le taux d’annulation utilise la colonne commande.' };
  }
  if (groupBy !== null && !Object.hasOwn(GROUPS, groupBy)) return { error: 'Regroupement invalide.' };
  if (formule === 'ratio' && !groupBy) return { error: 'La part du total exige un regroupement.' };
  if (!CHARTS.includes(typeGraphique)) return { error: 'Type de graphique invalide.' };
  if (!Number.isSafeInteger(ordre) || ordre < 0 || ordre > 10000) return { error: 'Ordre invalide.' };
  if (typeof visible !== 'boolean') return { error: 'Visibilité invalide.' };

  return { value: { titre, formule, colonne, group_by: groupBy, type_graphique: typeGraphique, ordre, visible: Boolean(visible) } };
}

function buildMeasureQuery(measure, filters = {}) {
  const column = SQL_COLUMNS[measure.colonne];
  if (!column || !FORMULAS.includes(measure.formule)) throw new Error('Configuration de mesure invalide.');
  let expression;
  if (measure.formule === 'sum') expression = `SUM(${column})`;
  else if (measure.formule === 'average') expression = `AVG(${column})`;
  else if (measure.formule === 'count') expression = `COUNT(${column})`;
  else if (measure.formule === 'ratio') expression = `SUM(${column}) / NULLIF(SUM(SUM(${column})) OVER (), 0)`;
  else expression = "COUNT(DISTINCT CASE WHEN f.statut = 'Cancelled' THEN f.id_commande END) / NULLIF(COUNT(DISTINCT f.id_commande), 0)";

  const group = measure.group_by ? GROUPS[measure.group_by] : null;
  const { clause, params } = buildFilter(filters);
  return {
    sql: `SELECT ${group || "'Total'"} AS label, ${expression} AS value
      ${FROM} ${clause}${group ? ` GROUP BY ${group}` : ''}
      ORDER BY ${measure.group_by === 'mois' ? 'label ASC' : 'value DESC'} LIMIT 100`,
    params,
  };
}

function publicMeasure(row) {
  return {
    id: row.id,
    titre: row.titre,
    formule: row.formule,
    formule_label: FORMULA_LABELS[row.formule],
    colonne: row.colonne,
    colonne_label: COLUMN_LABELS[row.colonne],
    group_by: row.group_by,
    type_graphique: row.type_graphique,
    ordre: row.ordre,
    visible: Boolean(row.visible),
  };
}

async function calculateMeasure(measure, filters = {}) {
  const query = buildMeasureQuery(measure, filters);
  const [rows] = await pool.query(query.sql, query.params);
  return { ...publicMeasure(measure), data: rows.map((row) => ({ label: row.label, value: Number(row.value) || 0 })) };
}

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM custom_measures WHERE visible = 1 ORDER BY ordre ASC, id ASC');
    const measures = await Promise.all(rows.map((measure) => calculateMeasure(measure, req.query)));
    return res.json(measures);
  } catch (error) { return next(error); }
});

router.get('/admin', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM custom_measures ORDER BY ordre ASC, id ASC');
    const measures = await Promise.all(rows.map(calculateMeasure));
    return res.json(measures);
  } catch (error) { return next(error); }
});

router.post('/preview', verifyToken, requireAdmin, async (req, res, next) => {
  const validated = validateMeasure(req.body);
  if (validated.error) return res.status(400).json({ error: validated.error });
  try {
    return res.json(await calculateMeasure(validated.value));
  } catch (error) { return next(error); }
});

router.post('/', verifyToken, requireAdmin, async (req, res, next) => {
  const validated = validateMeasure(req.body);
  if (validated.error) return res.status(400).json({ error: validated.error });
  try {
    const measure = validated.value;
    const [result] = await pool.query(
      `INSERT INTO custom_measures (admin_id, titre, formule, colonne, group_by, type_graphique, ordre, visible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, measure.titre, measure.formule, measure.colonne, measure.group_by, measure.type_graphique, measure.ordre, measure.visible ? 1 : 0]
    );
    if (measure.visible) await writeAudit(pool, req.user.id, 'measure.published', 'custom_measure', result.insertId, { titre: measure.titre });
    const [rows] = await pool.query('SELECT * FROM custom_measures WHERE id = ?', [result.insertId]);
    return res.status(201).json(await calculateMeasure(rows[0]));
  } catch (error) { return next(error); }
});

router.put('/:id', verifyToken, requireAdmin, async (req, res, next) => {
  if (!/^\d+$/.test(req.params.id) || Number(req.params.id) > 2147483647) return res.status(400).json({ error: 'Identifiant invalide.' });
  const validated = validateMeasure(req.body);
  if (validated.error) return res.status(400).json({ error: validated.error });
  try {
    const measure = validated.value;
    const [existingRows] = await pool.query('SELECT visible FROM custom_measures WHERE id = ?', [req.params.id]);
    if (!existingRows.length) return res.status(404).json({ error: 'Mesure introuvable.' });
    await pool.query(
      `UPDATE custom_measures SET titre = ?, formule = ?, colonne = ?, group_by = ?, type_graphique = ?, ordre = ?, visible = ? WHERE id = ?`,
      [measure.titre, measure.formule, measure.colonne, measure.group_by, measure.type_graphique, measure.ordre, measure.visible ? 1 : 0, req.params.id]
    );
    if (Boolean(existingRows[0].visible) !== measure.visible) {
      await writeAudit(pool, req.user.id, measure.visible ? 'measure.published' : 'measure.hidden', 'custom_measure', req.params.id, { titre: measure.titre });
    }
    const [rows] = await pool.query('SELECT * FROM custom_measures WHERE id = ?', [req.params.id]);
    return res.json(await calculateMeasure(rows[0]));
  } catch (error) { return next(error); }
});

module.exports = { router, validateMeasure, buildMeasureQuery };
