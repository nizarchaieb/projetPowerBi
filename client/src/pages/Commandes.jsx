import React, { useEffect, useState } from 'react';
import Loader from '../components/Loader';
import { getCommandes, getFiltres, fmtNumber } from '../api';
import { downloadRows } from '../workspace/exports';

export default function Commandes() {
  const [options, setOptions] = useState({ regions: [], categories: [], statuts: [], entreprises: [], periodes: [] });
  const [filters, setFilters] = useState({ region: '', entreprise: '', statut: '', mois: '', q: '' });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    getFiltres().then(setOptions).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { page, pageSize };
    if (filters.region) params.region = filters.region;
    if (filters.entreprise) params.entreprise = filters.entreprise;
    if (filters.statut) params.statut = filters.statut;
    if (filters.mois) params.mois = filters.mois;
    if (filters.q) params.q = filters.q;
    getCommandes(params)
      .then((r) => { setData(r.data); setTotal(r.total); setError(''); })
      .catch(() => setError('Impossible de charger les commandes. Vérifiez que l’API est démarrée.'))
      .finally(() => setLoading(false));
  }, [filters, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const update = (key, val) => { setFilters({ ...filters, [key]: val }); setPage(1); };

  async function exportOrders(type) {
    setExporting(true);
    setExportError('');
    try {
      const rows = [];
      let exportPage = 1;
      let filteredTotal = Infinity;
      const headers = ['id_commande', 'date', 'entreprise', 'produit', 'region', 'quantite', 'montant', 'statut'];
      while (rows.length < filteredTotal && exportPage <= 1000) {
        const response = await getCommandes({ ...filters, page: exportPage, pageSize: 100 });
        rows.push(...response.data);
        filteredTotal = response.total;
        exportPage += 1;
      }
      downloadRows(rows, `commandes_${filters.mois || 'toutes_periodes'}`, type, headers);
    } catch (err) {
      setExportError(err.response?.data?.error || 'Impossible de préparer cet export.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="page">
      <h1>Détail des commandes</h1>
      <p className="subtitle">Détail ligne à ligne des commandes correspondant aux filtres actifs · {fmtNumber(total)} ligne(s).</p>

      <div className="filters">
        <label>
          Région
          <select value={filters.region} onChange={(e) => update('region', e.target.value)}>
            <option value="">Toutes les régions</option>
            {(options.regions || []).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label>
          Mois
          <select value={filters.mois} onChange={(e) => update('mois', e.target.value)}>
            <option value="">Toute l’année</option>
            {(options.periodes || []).map((period) => {
              const [year, month] = period.split('-');
              const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' })
                .format(new Date(Date.UTC(Number(year), Number(month) - 1, 1)));
              return <option key={period} value={period}>{label.charAt(0).toLocaleUpperCase('fr-FR') + label.slice(1)} {year}</option>;
            })}
          </select>
        </label>
        <label>
          Entreprise
          <select value={filters.entreprise} onChange={(e) => update('entreprise', e.target.value)}>
            <option value="">Toutes les entreprises</option>
            {(options.entreprises || []).map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </label>
        <label>
          Statut
          <select value={filters.statut} onChange={(e) => update('statut', e.target.value)}>
            <option value="">Tous les statuts</option>
            {(options.statuts || []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>
          Recherche
          <input type="text" placeholder="N° commande, produit, client…" value={filters.q} onChange={(e) => update('q', e.target.value)} />
        </label>
        <button type="button" className="btn secondary" onClick={() => { setFilters({ region: '', entreprise: '', statut: '', mois: '', q: '' }); setPage(1); }}>Réinitialiser</button>
      </div>

      {error ? <div className="alert error">{error}</div> : null}
      {exportError ? <div className="alert error" role="alert">{exportError}</div> : null}
      {loading ? <Loader /> : (
        <>
          <div className="export-actions"><span>Exporter toutes les lignes correspondant aux filtres actifs</span><button type="button" className="btn secondary small" disabled={exporting || !total} onClick={() => exportOrders('xlsx')}>{exporting ? 'Préparation…' : 'Excel (.xlsx)'}</button><button type="button" className="btn secondary small" disabled={exporting || !total} onClick={() => exportOrders('csv')}>CSV</button></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>N° commande</th><th>Date</th><th>Entreprise</th><th>Produit</th><th>Région</th><th>Quantité</th><th>Montant</th><th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={`${row.id_commande}-${row.produit}-${i}`}>
                    <td>{row.id_commande}</td>
                    <td>{row.date}</td>
                    <td>{row.entreprise}</td>
                    <td>{row.produit}</td>
                    <td>{row.region}</td>
                    <td>{fmtNumber(row.quantite)}</td>
                    <td>{fmtNumber(row.montant)}</td>
                    <td>{row.statut}</td>
                  </tr>
                ))}
                {data.length === 0 ? (
                  <tr><td colSpan="8">Aucune ligne ne correspond aux filtres.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button type="button" className="btn secondary small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</button>
            <span>Page {page} / {totalPages} — {fmtNumber(total)} ligne(s)</span>
            <button type="button" className="btn secondary small" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Suivant</button>
          </div>
        </>
      )}
    </div>
  );
}
