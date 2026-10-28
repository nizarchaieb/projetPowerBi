import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Treemap,
} from 'recharts';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import Filters from '../components/Filters';
import SalesAssistant from '../components/SalesAssistant';
import Loader from '../components/Loader';
import { getKpis, getAnnulationsParRegion, getAnnulationsParProduit, getAnnulationsParClient, getAnnulationsMensuel, getAnnulationsParCategorie, getFiltres, getInsights, fmtNumber, fmtPct, moisLabel } from '../api';

export default function Annulations() {
  const [filters, setFilters] = useState({ region: '', categorie: '', statut: '', mois: '' });
  const [options, setOptions] = useState({ regions: [], categories: [], statuts: [], periodes: [] });
  const [kpis, setKpis] = useState(null);
  const [mensuel, setMensuel] = useState([]);
  const [parRegion, setParRegion] = useState([]);
  const [parProduit, setParProduit] = useState([]);
  const [parClient, setParClient] = useState([]);
  const [parCategorie, setParCategorie] = useState([]);
  const [insights, setInsights] = useState([]);
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
    Promise.all([
      getKpis(params),
      getAnnulationsMensuel(params),
      getAnnulationsParRegion(params),
      getAnnulationsParProduit(params),
      getAnnulationsParClient(params),
      getAnnulationsParCategorie(params),
      getInsights('annulations'),
    ])
      .then(([k, m, r, p, c, cat, ins]) => {
        setKpis(k);
        setMensuel(m.map((x) => ({ ...x, label: moisLabel(x.mois), taux: Math.round(x.tauxAnnulation * 1000) / 10 })));
        setParRegion(r.map((x) => ({ ...x, taux: Math.round(x.tauxAnnulation * 1000) / 10 })));
        setParProduit(p.map((x) => ({ ...x, taux: Math.round(x.tauxAnnulation * 1000) / 10 })));
        setParClient(c.map((x) => ({ ...x, taux: Math.round(x.tauxAnnulation * 1000) / 10 })));
        setParCategorie(cat.map((x) => ({ name: x.categorie, size: x.montantAnnule })));
        setInsights(ins);
      })
      .catch(() => setError('Impossible de charger les données. Vérifiez que l’API est démarrée.'))
      .finally(() => setLoading(false));
  }, [filters]);

  if (loading && !kpis) return <div className="page"><Loader /></div>;

  return (
    <div className="page">
      <h1>Analyse des annulations</h1>
      <p className="subtitle">{kpis ? `${fmtNumber(kpis.nbCommandesAnnulees)} commandes annulées sur ${fmtNumber(kpis.nbCommandes)} (${fmtPct(kpis.tauxAnnulation)}), soit ${fmtNumber(kpis.nbLignesAnnulees)} lignes sur ${fmtNumber(kpis.nbLignes)}.` : 'Analyse des annulations du jeu de démonstration selon les filtres actifs.'}</p>

      <SalesAssistant
        context="annulations"
        options={options}
        onApply={(next) => setFilters((current) => ({ ...current, ...next }))}
      />
      <Filters options={options} value={filters} onChange={setFilters} onReset={() => setFilters({ region: '', categorie: '', statut: '', mois: '' })} />
      {error ? <div className="alert error">{error}</div> : null}

      {kpis ? (
        <div className="kpi-grid">
          <KpiCard label="Commandes annulées" value={fmtNumber(kpis.nbCommandesAnnulees)} sub={`sur ${fmtNumber(kpis.nbCommandes)} commandes`} tone="red" />
          <KpiCard label="Montant annulé" value={fmtNumber(kpis.montantAnnule)} sub="Chiffre d’affaires perdu" tone="red" />
          <KpiCard label="Taux d’annulation" value={fmtPct(kpis.tauxAnnulation)} sub="Commandes annulées / commandes totales" tone="red" />
          <KpiCard label="Lignes annulées" value={fmtNumber(kpis.nbLignesAnnulees)} sub={`sur ${fmtNumber(kpis.nbLignes)} lignes`} tone="red" />
        </div>
      ) : null}

      <div className="charts-grid">
        <ChartCard title="Évolution mensuelle du taux d’annulation (%)" empty={!mensuel.length}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mensuel}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted)" fontSize={12} />
              <YAxis stroke="var(--muted)" fontSize={12} domain={[0, 50]} />
              <Tooltip formatter={(v) => `${v} %`} />
              <Line type="monotone" dataKey="taux" name="Taux d’annulation (%)" stroke="var(--danger)" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Montant annulé par catégorie" empty={!parCategorie.length}>
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={parCategorie}
              dataKey="size"
              nameKey="name"
              stroke="var(--bg)"
              fill="var(--danger)"
              content={<TreemapContent />}
            />
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Taux d’annulation par région (%)" empty={!parRegion.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={parRegion} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" stroke="var(--muted)" fontSize={12} domain={[0, 50]} />
              <YAxis type="category" dataKey="label" stroke="var(--muted)" fontSize={12} width={70} />
              <Tooltip formatter={(v) => `${v} %`} />
              <Bar dataKey="taux" name="Taux d’annulation (%)" fill="var(--danger)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Taux d’annulation par produit (%)" empty={!parProduit.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={parProduit} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" stroke="var(--muted)" fontSize={12} domain={[0, 50]} />
              <YAxis type="category" dataKey="label" stroke="var(--muted)" fontSize={12} width={90} />
              <Tooltip formatter={(v) => `${v} %`} />
              <Bar dataKey="taux" name="Taux d’annulation (%)" fill="var(--danger)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Taux d’annulation par client (%)" empty={!parClient.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={parClient} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" stroke="var(--muted)" fontSize={12} domain={[0, 50]} />
              <YAxis type="category" dataKey="label" stroke="var(--muted)" fontSize={12} width={110} />
              <Tooltip formatter={(v) => `${v} %`} />
              <Bar dataKey="taux" name="Taux d’annulation (%)" fill="var(--danger)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

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

function TreemapContent(props) {
  const { x, y, width, height, name, size } = props;
  if (!name) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill="var(--danger)" stroke="var(--bg)" />
      {width > 90 && height > 44 ? (
        <text x={x + 8} y={y + 22} fill="var(--text-on-primary)" fontSize={13} fontWeight={700}>{name}</text>
      ) : null}
      {width > 90 && height > 64 ? (
        <text x={x + 8} y={y + 42} fill="var(--text-on-primary)" fontSize={12}>{fmtNumber(size)}</text>
      ) : null}
    </g>
  );
}
