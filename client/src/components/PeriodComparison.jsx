import React from 'react';
import { fmtNumber, fmtPct } from '../api';
import KpiCard from './KpiCard';

const METRICS = [
  { key: 'caTotal', label: 'CA total', format: fmtNumber },
  { key: 'caNet', label: 'CA net', format: fmtNumber },
  { key: 'nbCommandes', label: 'Commandes', format: fmtNumber },
  { key: 'tauxAnnulation', label: 'Taux d’annulation', format: fmtPct },
];

export default function PeriodComparison({ current, previous, currentPeriod, previousPeriod }) {
  if (!current || !previous) return null;
  return <section className="period-comparison" aria-label="Comparaison de périodes">
    <div className="workspace-section-heading"><div><span className="eyebrow">COMPARAISON DE PÉRIODES</span><h2>{currentPeriod} vs {previousPeriod}</h2><p>Variation relative : (valeur actuelle − valeur précédente) / valeur précédente.</p></div></div>
    <div className="kpi-grid">{METRICS.map((metric) => {
      const currentValue = Number(current[metric.key]) || 0;
      const previousValue = Number(previous[metric.key]) || 0;
      const variation = previousValue ? ((currentValue - previousValue) / Math.abs(previousValue)) : null;
      const arrow = variation === null ? '—' : variation > 0 ? '↑' : variation < 0 ? '↓' : '→';
      const text = variation === null ? 'Base précédente nulle' : `${arrow} ${fmtPct(variation)}`;
      const tone = variation === null ? '' : (metric.key === 'tauxAnnulation' ? (variation > 0 ? 'red' : 'teal') : (variation >= 0 ? 'teal' : 'red'));
      return <KpiCard key={metric.key} label={metric.label} value={metric.format(currentValue)} sub={`${text} · précédent : ${metric.format(previousValue)}`} tone={tone} />;
    })}</div>
  </section>;
}
