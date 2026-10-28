'use strict';

// Filtres partagés : region (nom_region), categorie (dim_produit.categorie),
// statut (fact_ventes.statut). Appliqués de façon identique sur toutes les requêtes.
function buildFilter(query) {
  const where = [];
  const params = [];
  if (query.region) {
    where.push('r.nom_region = ?');
    params.push(query.region);
  }
  if (query.categorie) {
    where.push('p.categorie = ?');
    params.push(query.categorie);
  }
  if (query.statut) {
    where.push('f.statut = ?');
    params.push(query.statut);
  }
  if (query.mois) {
    where.push('d.annee_mois = ?');
    params.push(query.mois);
  }
  return {
    clause: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

const FROM =
  'FROM fact_ventes f ' +
  'JOIN dim_region r ON f.id_region = r.id_region ' +
  'JOIN dim_produit p ON f.id_produit = p.id_produit ' +
  'JOIN dim_client c ON f.id_client = c.id_client ' +
  'JOIN dim_date d ON f.date_commande = d.date';

const NET = "SUM(CASE WHEN f.statut <> 'Cancelled' THEN f.prix_total ELSE 0 END)";

module.exports = { buildFilter, FROM, NET };
