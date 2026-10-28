import React from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { fmtNumber, fmtPct } from '../api';

const COLORS = ['var(--primary)', 'var(--chart-2)', 'var(--chart-4)', 'var(--chart-3)', 'var(--chart-7)', 'var(--chart-6)'];

function formatMeasureValue(measure, value) {
  return measure.formule === 'ratio' || measure.formule === 'taux_annulation'
    ? fmtPct(value)
    : fmtNumber(value);
}

function MeasureChart({ measure }) {
  const valueLabel = measure.formule === 'ratio' || measure.formule === 'taux_annulation'
    ? measure.formule_label
    : `${measure.formule_label} · ${measure.colonne_label}`;
  const tooltip = (value) => formatMeasureValue(measure, value);
  if (measure.type_graphique === 'table') {
    return <div className="table-wrap"><table className="data-table"><thead><tr><th>{measure.group_by || 'Périmètre'}</th><th>{valueLabel}</th></tr></thead><tbody>
      {measure.data.map((row) => <tr key={row.label}><td>{row.label}</td><td>{tooltip(row.value)}</td></tr>)}
    </tbody></table></div>;
  }
  if (measure.type_graphique === 'pie') {
    return <ResponsiveContainer width="100%" height="100%"><PieChart>
      <Pie data={measure.data} dataKey="value" nameKey="label" innerRadius={48} outerRadius={100}>
        {measure.data.map((entry, index) => <Cell key={entry.label} fill={COLORS[index % COLORS.length]} />)}
      </Pie><Tooltip formatter={tooltip} />
    </PieChart></ResponsiveContainer>;
  }
  if (measure.type_graphique === 'line') {
    return <ResponsiveContainer width="100%" height="100%"><LineChart data={measure.data}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="label" stroke="var(--muted)" />
      <YAxis stroke="var(--muted)" tickFormatter={tooltip} /><Tooltip formatter={tooltip} />
      <Line dataKey="value" name={valueLabel} stroke="var(--primary)" strokeWidth={3} dot={{ r: 3 }} />
    </LineChart></ResponsiveContainer>;
  }
  return <ResponsiveContainer width="100%" height="100%"><BarChart data={measure.data} layout="vertical" margin={{ left: 12, right: 18 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis type="number" stroke="var(--muted)" tickFormatter={tooltip} />
    <YAxis type="category" dataKey="label" stroke="var(--muted)" width={100} tick={{ fontSize: 11 }} />
    <Tooltip formatter={tooltip} /><Bar dataKey="value" name={valueLabel} fill="var(--primary)" />
  </BarChart></ResponsiveContainer>;
}

export default function PublishedMeasures({ measures }) {
  if (!measures.length) return null;
  return <section className="published-measures">
    <div className="workspace-section-heading"><div><span className="eyebrow">MESURES PERSONNALISÉES</span><h2>Indicateurs publiés</h2><p>Calculés sur le jeu de démonstration avec les filtres actifs.</p></div></div>
    <div className="charts-grid">{measures.map((measure) => (
      <article className="chart-card" key={measure.id}>
        <h3>{measure.titre}</h3>
        <div className="chart-body"><MeasureChart measure={measure} /></div>
        <p className="personal-bi-foot">{measure.formule_label}{measure.colonne_label ? ` de ${measure.colonne_label}` : ''}{measure.group_by ? ` par ${measure.group_by}` : ''}. Valeurs calculées depuis les données filtrées du tableau de bord.</p>
      </article>
    ))}</div>
  </section>;
}
