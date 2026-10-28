import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import Filters from '../components/Filters';
import SalesAssistant from '../components/SalesAssistant';
import PublishedMeasures from '../components/PublishedMeasures';
import DashboardWidgets from '../components/DashboardWidgets';
import PeriodComparison from '../components/PeriodComparison';
import DashboardSkeleton from '../components/DashboardSkeleton';
import { getKpis, getMensuel, getParRegion, getParProduit, getParClient, getParStatut, getFiltres, getInsights, getPublishedMeasures, fmtNumber, fmtPct, moisLabel } from '../api';
import { downloadMonthlyPdf } from '../workspace/pdfReport';

const COLORS = ['var(--primary)', 'var(--success)', 'var(--info)', 'var(--warning)', 'var(--danger)', 'var(--chart-3)', 'var(--chart-6)', 'var(--chart-8)'];

function statusColor(label, index) {
  const normalized = String(label || '').toLocaleLowerCase('fr-FR');
  if (normalized.includes('annul')) return 'var(--danger)';
  return COLORS[index % COLORS.length];
}

function StatusChart({ data }) {
  const [hidden, setHidden] = useState([]);
  const legend = data.map((item, index) => ({ value: item.label, color: statusColor(item.label, index), type: 'square', index }));
  const visible = data.filter((item) => !hidden.includes(item.label));
  function toggle(label) {
    setHidden((current) => current.includes(label) ? current.filter((value) => value !== label) : [...current, label]);
  }
  return <ChartCard title="Répartition des ventes par statut (CA net)" empty={!data.length}>
    <ResponsiveContainer width="100%" height="100%"><PieChart>
      <Pie data={visible} dataKey="caNet" nameKey="label" innerRadius={60} outerRadius={100} paddingAngle={2}>
        {visible.map((entry) => <Cell key={entry.label} fill={statusColor(entry.label, data.indexOf(entry))} />)}
      </Pie>
      <Tooltip formatter={(value) => fmtNumber(value)} />
      <Legend payload={legend} content={({ payload = [] }) => <ul className="chart-legend" aria-label="Légende interactive des statuts">{payload.map((item) => <li key={item.value}><button type="button" aria-pressed={!hidden.includes(item.value)} onClick={() => toggle(item.value)}><i style={{ background: item.color }} />{item.value}</button></li>)}</ul>} />
    </PieChart></ResponsiveContainer>
  </ChartCard>;
}

function previousMonth(period) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period || '')) return null;
  const date = new Date(`${period}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function Ventes() {
  const [filters, setFilters] = useState({ region: '', categorie: '', statut: '', mois: '' });
  const [options, setOptions] = useState({ regions: [], categories: [], statuts: [], periodes: [] });
  const [kpis, setKpis] = useState(null);
  const [mensuel, setMensuel] = useState([]);
  const [forecastMonthly, setForecastMonthly] = useState([]);
  const [parStatut, setParStatut] = useState([]);
  const [parRegion, setParRegion] = useState([]);
  const [parProduit, setParProduit] = useState([]);
  const [parClient, setParClient] = useState([]);
  const [insights, setInsights] = useState([]);
  const [customMeasures, setCustomMeasures] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getFiltres().then(setOptions).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = {};
    if (filters.region) params.region = filters.region;
    if (filters.categorie) params.categorie = filters.categorie;
    if (filters.statut) params.statut = filters.statut;
    if (filters.mois) params.mois = filters.mois;
    const monthlyParams = { ...params };
    delete monthlyParams.mois;
    Promise.all([
      getKpis(params),
      getMensuel(params),
      getParStatut(params),
      getParRegion(params),
      getParProduit(params),
      getParClient(params),
      getInsights('ventes'),
      getPublishedMeasures(params).catch(() => []),
      getMensuel(monthlyParams),
    ])
      .then(([k, m, s, r, p, c, ins, measures, forecast]) => {
        setKpis(k);
        setMensuel(m.map((x) => ({ ...x, label: moisLabel(x.mois) })));
        setForecastMonthly(forecast);
        setParStatut(s);
        setParRegion(r);
        setParProduit(p);
        setParClient(c);
        setInsights(ins);
        setCustomMeasures(measures);
      })
      .catch(() => setError('Impossible de charger les données. Vérifiez que l’API est démarrée.'))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    const period = filters.mois || options.periodes[0];
    const before = previousMonth(period);
    if (!period || !before || !options.periodes.includes(before)) { setComparison(null); return undefined; }
    let cancelled = false;
    const baseFilters = { ...filters, mois: period };
    Promise.all([getKpis(baseFilters), getKpis({ ...filters, mois: before })])
      .then(([current, previous]) => { if (!cancelled) setComparison({ current, previous, period, before }); })
      .catch(() => { if (!cancelled) setComparison(null); });
    return () => { cancelled = true; };
  }, [filters, options.periodes]);

  async function exportPdf() {
    const period = filters.mois || options.periodes[0];
    if (!period) return;
    setPdfLoading(true);
    setPdfError('');
    const params = { ...filters, mois: period };
    try {
      const [periodKpis, region, product, status] = await Promise.all([
        getKpis(params), getParRegion(params), getParProduit(params), getParStatut(params),
      ]);
      downloadMonthlyPdf({ period: moisLabel(period), kpis: periodKpis, byRegion: region, byProduct: product, byStatus: status });
    } catch (err) {
      setPdfError(err.response?.data?.error || 'Impossible de préparer le rapport PDF.');
    } finally {
      setPdfLoading(false);
    }
  }

  const dashboardWidgets = [
    { id: 'monthly', label: 'Évolution mensuelle', content: <ChartCard title="Évolution mensuelle du CA net" empty={!mensuel.length}><ResponsiveContainer width="100%" height="100%"><LineChart data={mensuel}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="label" stroke="var(--muted)" fontSize={12} /><YAxis stroke="var(--muted)" fontSize={12} tickFormatter={(v) => fmtNumber(v)} /><Tooltip formatter={(v) => fmtNumber(v)} labelStyle={{ color: 'var(--text-on-primary)' }} /><Line type="monotone" dataKey="caNet" name="CA net" stroke="var(--primary)" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></ChartCard> },
    { id: 'status', label: 'Ventes par statut', content: <StatusChart data={parStatut} /> },
    { id: 'region', label: 'CA net par région', content: <ChartCard title="CA net par région" empty={!parRegion.length}><ResponsiveContainer width="100%" height="100%"><BarChart data={parRegion} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis type="number" stroke="var(--muted)" fontSize={12} tickFormatter={(v) => fmtNumber(v)} /><YAxis type="category" dataKey="label" stroke="var(--muted)" fontSize={12} width={70} /><Tooltip formatter={(v) => fmtNumber(v)} /><Bar dataKey="caNet" name="CA net" fill="var(--primary)" /></BarChart></ResponsiveContainer></ChartCard> },
    { id: 'product', label: 'CA net par produit', content: <ChartCard title="CA net par produit" empty={!parProduit.length}><ResponsiveContainer width="100%" height="100%"><BarChart data={parProduit} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis type="number" stroke="var(--muted)" fontSize={12} tickFormatter={(v) => fmtNumber(v)} /><YAxis type="category" dataKey="label" stroke="var(--muted)" fontSize={12} width={90} /><Tooltip formatter={(v) => fmtNumber(v)} /><Bar dataKey="caNet" name="CA net" fill="var(--success)" /></BarChart></ResponsiveContainer></ChartCard> },
    { id: 'client', label: 'CA net par client', content: <ChartCard title="CA net par client" empty={!parClient.length}><ResponsiveContainer width="100%" height="100%"><BarChart data={parClient} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis type="number" stroke="var(--muted)" fontSize={12} tickFormatter={(v) => fmtNumber(v)} /><YAxis type="category" dataKey="label" stroke="var(--muted)" fontSize={12} width={110} /><Tooltip formatter={(v) => fmtNumber(v)} /><Bar dataKey="caNet" name="CA net" fill="var(--info)" /></BarChart></ResponsiveContainer></ChartCard> },
  ];

  if (loading && !kpis) return <DashboardSkeleton />;

  return (
    <div className="page">
      <h1>Suivi des ventes</h1>
      <p className="subtitle">Vue d’ensemble de la performance commerciale du jeu de démonstration. Les indicateurs reflètent les filtres actifs.</p>

      <SalesAssistant options={options} onApply={(next) => setFilters((current) => ({ ...current, ...next }))} />
      <Filters options={options} value={filters} onChange={setFilters} onReset={() => setFilters({ region: '', categorie: '', statut: '', mois: '' })} />
      {error ? <div className="alert error">{error}</div> : null}
      <div className="export-actions"><span>Rapport du mois sélectionné, ou du dernier mois disponible</span><button type="button" className="btn secondary small" disabled={pdfLoading || !options.periodes.length} onClick={exportPdf}>{pdfLoading ? 'Préparation du PDF…' : 'Télécharger le rapport PDF mensuel'}</button></div>
      {pdfError ? <div className="alert error" role="alert">{pdfError}</div> : null}

      {kpis ? (
        <div className="kpi-grid">
          <KpiCard label="Chiffre d’affaires total" value={fmtNumber(kpis.caTotal)} sub="Toutes les lignes, tous statuts" />
          <KpiCard label="CA net (hors annulées)" value={fmtNumber(kpis.caNet)} sub="Total moins le montant annulé" tone="teal" />
          <KpiCard label="Nombre de commandes" value={fmtNumber(kpis.nbCommandes)} sub={`${fmtNumber(kpis.nbLignes)} lignes de commandes`} />
          <KpiCard label="Panier moyen" value={fmtNumber(kpis.panierMoyen)} sub="CA total / nombre de commandes" />
          <KpiCard label="Taux d’annulation" value={fmtPct(kpis.tauxAnnulation)} sub={`${fmtNumber(kpis.nbCommandesAnnulees)} commandes annulées`} tone="red" />
          <KpiCard
            label="Variation mensuelle (CA net)"
            value={kpis.variationMensuelle === null ? '—' : fmtPct(kpis.variationMensuelle)}
            sub="Dernier mois vs mois précédent"
            tone={kpis.variationMensuelle !== null && kpis.variationMensuelle >= 0 ? 'teal' : 'red'}
          />
        </div>
      ) : null}

      {comparison ? <PeriodComparison current={comparison.current} previous={comparison.previous} currentPeriod={moisLabel(comparison.period)} previousPeriod={moisLabel(comparison.before)} /> : null}
      {forecastMonthly.length >= 3 ? <div className="note"><strong>Estimation · moyenne mobile 3 mois :</strong> {fmtNumber(forecastMonthly.slice(-3).reduce((sum, row) => sum + row.caNet, 0) / 3)} de CA net estimé pour la période suivante, calculée sur {forecastMonthly.slice(-3).map((row) => moisLabel(row.mois)).join(', ')}. Cette estimation ignore le filtre du mois et conserve les autres filtres.</div> : null}

      {kpis && !kpis.nbLignes ? <div className="workspace-empty"><h3>Aucune donnée ne correspond aux filtres</h3><p>Réinitialisez les filtres pour retrouver les indicateurs du dataset de démonstration.</p><button type="button" className="btn secondary" onClick={() => setFilters({ region: '', categorie: '', statut: '', mois: '' })}>Réinitialiser les filtres</button></div> : null}

      <DashboardWidgets scope="demo" items={dashboardWidgets} />

      <PublishedMeasures measures={customMeasures} />

      {insights.length ? (
        <div className="insights">
          <h3>Analyses</h3>
          {insights.map((ins) => (
            <div className="insight" key={ins.id}>
              <strong>{ins.title}</strong>
              <p>{ins.text}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
