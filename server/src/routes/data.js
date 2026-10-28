'use strict';

const express = require('express');
const pool = require('../db');
const { buildFilter, FROM, NET } = require('./helpers');

const router = express.Router();
router.use((req, res, next) => {
  if (req.query.mois && !/^20\d{2}-(0[1-9]|1[0-2])$/.test(req.query.mois)) {
    return res.status(400).json({ error: 'La période doit être au format AAAA-MM.' });
  }
  return next();
});

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// GET /api/kpis — tous les indicateurs, calculés en SQL depuis MySQL.
// Équivalents DAX : Total ventes (SUM), Nombre de commandes (DISTINCTCOUNT),
// Commande moyenne (DIVIDE), Taux annulation (DIVIDE), CA net (CALCULATE),
// Variation mensuelle (DIVIDE([CA net] - [CA net mois précédent], [CA net mois précédent])).
router.get('/kpis', async (req, res, next) => {
  try {
    const { clause, params } = buildFilter(req.query);
    const [rows] = await pool.query(
      `SELECT
        SUM(f.prix_total) AS caTotal,
        ${NET} AS caNet,
        SUM(CASE WHEN f.statut = 'Cancelled' THEN f.prix_total ELSE 0 END) AS montantAnnule,
        COUNT(DISTINCT f.id_commande) AS nbCommandes,
        COUNT(*) AS nbLignes,
        SUM(f.quantite) AS quantiteVendue,
        COUNT(DISTINCT CASE WHEN f.statut = 'Cancelled' THEN f.id_commande END) AS nbCommandesAnnulees,
        SUM(CASE WHEN f.statut = 'Cancelled' THEN 1 ELSE 0 END) AS nbLignesAnnulees
       ${FROM} ${clause}`,
      params
    );
    const r = rows[0] || {};
    const caTotal = num(r.caTotal);
    const caNet = num(r.caNet);
    const nbCommandes = num(r.nbCommandes);
    const nbCommandesAnnulees = num(r.nbCommandesAnnulees);

    // Variation mensuelle : CA net du dernier mois vs mois précédent (calcul dynamique).
    const [mensuel] = await pool.query(
      `SELECT d.annee_mois AS mois, ${NET} AS caNet ${FROM} ${clause}
       GROUP BY d.annee_mois ORDER BY d.annee_mois DESC LIMIT 2`,
      params
    );
    let variationMensuelle = null;
    if (mensuel.length === 2) {
      const dernier = num(mensuel[0].caNet);
      const precedent = num(mensuel[1].caNet);
      if (precedent !== 0) variationMensuelle = (dernier - precedent) / precedent;
    }

    return res.json({
      caTotal,
      caNet,
      montantAnnule: num(r.montantAnnule),
      nbCommandes,
      nbLignes: num(r.nbLignes),
      panierMoyen: nbCommandes ? caTotal / nbCommandes : 0,
      tauxAnnulation: nbCommandes ? nbCommandesAnnulees / nbCommandes : 0,
      nbCommandesAnnulees,
      nbLignesAnnulees: num(r.nbLignesAnnulees),
      quantiteVendue: num(r.quantiteVendue),
      variationMensuelle,
    });
  } catch (e) {
    return next(e);
  }
});

// GET /api/ventes/mensuel — CA net et CA total par mois (2023).
router.get('/ventes/mensuel', async (req, res, next) => {
  try {
    const { clause, params } = buildFilter(req.query);
    const [rows] = await pool.query(
      `SELECT d.annee_mois AS mois, ${NET} AS caNet, SUM(f.prix_total) AS caTotal
       ${FROM} ${clause}
       GROUP BY d.annee_mois ORDER BY d.annee_mois`,
      params
    );
    return res.json(rows.map((r) => ({ mois: r.mois, caNet: num(r.caNet), caTotal: num(r.caTotal) })));
  } catch (e) {
    return next(e);
  }
});

// GET /api/ventes/par-region | par-produit | par-client — CA net par axe.
for (const [suffix, col] of [
  ['par-region', 'r.nom_region'],
  ['par-produit', 'p.nom_produit'],
  ['par-client', 'c.nom_client'],
]) {
  router.get(`/ventes/${suffix}`, async (req, res, next) => {
    try {
      const { clause, params } = buildFilter(req.query);
      const [rows] = await pool.query(
        `SELECT ${col} AS label, ${NET} AS caNet ${FROM} ${clause}
         GROUP BY ${col} ORDER BY caNet DESC`,
        params
      );
      return res.json(rows.map((r) => ({ label: r.label, caNet: num(r.caNet) })));
    } catch (e) {
      return next(e);
    }
  });
}

// GET /api/ventes/par-statut — répartition par statut (CA net + nombre de lignes).
router.get('/ventes/par-statut', async (req, res, next) => {
  try {
    const { clause, params } = buildFilter(req.query);
    const [rows] = await pool.query(
      `SELECT f.statut AS label, ${NET} AS caNet, COUNT(*) AS lignes
       ${FROM} ${clause}
       GROUP BY f.statut ORDER BY caNet DESC`,
      params
    );
    return res.json(rows.map((r) => ({ label: r.label, caNet: num(r.caNet), lignes: num(r.lignes) })));
  } catch (e) {
    return next(e);
  }
});

// --- Annulations ---

const TAUX =
  "COUNT(DISTINCT CASE WHEN f.statut = 'Cancelled' THEN f.id_commande END) / NULLIF(COUNT(DISTINCT f.id_commande), 0) AS tauxAnnulation";
const MONTANT_ANNULE =
  "SUM(CASE WHEN f.statut = 'Cancelled' THEN f.prix_total ELSE 0 END) AS montantAnnule";
const NB_ANNULEES =
  "COUNT(DISTINCT CASE WHEN f.statut = 'Cancelled' THEN f.id_commande END) AS nbCommandesAnnulees";

for (const [suffix, col] of [
  ['par-region', 'r.nom_region'],
  ['par-produit', 'p.nom_produit'],
  ['par-client', 'c.nom_client'],
]) {
  router.get(`/annulations/${suffix}`, async (req, res, next) => {
    try {
      const { clause, params } = buildFilter(req.query);
      const [rows] = await pool.query(
        `SELECT ${col} AS label, ${TAUX}, ${MONTANT_ANNULE}, ${NB_ANNULEES}
         ${FROM} ${clause}
         GROUP BY ${col} ORDER BY tauxAnnulation DESC`,
        params
      );
      return res.json(rows.map((r) => ({
        label: r.label,
        tauxAnnulation: num(r.tauxAnnulation),
        montantAnnule: num(r.montantAnnule),
        nbCommandesAnnulees: num(r.nbCommandesAnnulees),
      })));
    } catch (e) {
      return next(e);
    }
  });
}

// GET /api/annulations/mensuel — taux d'annulation par mois.
router.get('/annulations/mensuel', async (req, res, next) => {
  try {
    const { clause, params } = buildFilter(req.query);
    const [rows] = await pool.query(
      `SELECT d.annee_mois AS mois, ${TAUX} ${FROM} ${clause}
       GROUP BY d.annee_mois ORDER BY d.annee_mois`,
      params
    );
    return res.json(rows.map((r) => ({ mois: r.mois, tauxAnnulation: num(r.tauxAnnulation) })));
  } catch (e) {
    return next(e);
  }
});

// GET /api/annulations/par-categorie — montant annulé par catégorie (treemap).
router.get('/annulations/par-categorie', async (req, res, next) => {
  try {
    const { clause, params } = buildFilter(req.query);
    const [rows] = await pool.query(
      `SELECT p.categorie AS categorie, ${MONTANT_ANNULE}
       ${FROM} ${clause}
       GROUP BY p.categorie ORDER BY montantAnnule DESC`,
      params
    );
    return res.json(rows.map((r) => ({ categorie: r.categorie, montantAnnule: num(r.montantAnnule) })));
  } catch (e) {
    return next(e);
  }
});

// GET /api/commandes — tableau paginé et filtrable des 1 043 lignes.
router.get('/commandes', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const where = [];
    const params = [];
    if (req.query.region) {
      where.push('r.nom_region = ?');
      params.push(req.query.region);
    }
    if (req.query.entreprise) {
      where.push('c.nom_client = ?');
      params.push(req.query.entreprise);
    }
    if (req.query.statut) {
      where.push('f.statut = ?');
      params.push(req.query.statut);
    }
    if (req.query.mois) {
      where.push('d.annee_mois = ?');
      params.push(req.query.mois);
    }
    if (req.query.q) {
      where.push('(f.id_commande LIKE ? OR p.nom_produit LIKE ? OR c.nom_client LIKE ?)');
      const like = `%${req.query.q}%`;
      params.push(like, like, like);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total ${FROM} ${clause}`,
      params
    );
    const total = num(countRows[0] && countRows[0].total);

    const [rows] = await pool.query(
      `SELECT f.id_commande AS id_commande,
              DATE_FORMAT(f.date_commande, '%Y-%m-%d') AS date,
              c.nom_client AS entreprise,
              p.nom_produit AS produit,
              r.nom_region AS region,
              f.quantite AS quantite,
              f.prix_total AS montant,
              f.statut AS statut
       ${FROM} ${clause}
       ORDER BY f.date_commande DESC, f.id_commande ASC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    return res.json({
      data: rows.map((r) => ({ ...r, quantite: num(r.quantite), montant: num(r.montant) })),
      total,
      page,
      pageSize,
    });
  } catch (e) {
    return next(e);
  }
});

// GET /api/filtres — valeurs disponibles pour les filtres (régions, catégories, statuts, entreprises).
router.get('/filtres', async (req, res, next) => {
  try {
    const [regions] = await pool.query('SELECT nom_region AS value FROM dim_region ORDER BY nom_region');
    const [categories] = await pool.query('SELECT DISTINCT categorie AS value FROM dim_produit ORDER BY categorie');
    const [statuts] = await pool.query('SELECT DISTINCT statut AS value FROM fact_ventes ORDER BY statut');
    const [entreprises] = await pool.query('SELECT nom_client AS value FROM dim_client ORDER BY nom_client');
    const [periodes] = await pool.query(
      'SELECT DISTINCT annee_mois AS value FROM dim_date ORDER BY annee_mois DESC'
    );
    return res.json({
      regions: regions.map((r) => r.value),
      categories: categories.map((r) => r.value),
      statuts: statuts.map((r) => r.value),
      entreprises: entreprises.map((r) => r.value),
      periodes: periodes.map((r) => r.value),
    });
  } catch (e) {
    return next(e);
  }
});

module.exports = router;
