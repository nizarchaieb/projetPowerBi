import React from 'react';
import Icon from './Icon';

export default function ChartCard({ title, subtitle, children, empty = false, emptyMessage = 'Aucune donnée disponible pour cette sélection.' }) {
  return (
    <section className="chart-card" aria-label={title}>
      <div className="chart-heading"><div><h3>{title}</h3>{subtitle ? <p>{subtitle}</p> : null}</div><Icon name="chart" className="chart-heading-mark" /></div>
      <div className="chart-body">{empty ? <div className="chart-empty" role="status">{emptyMessage}</div> : children}</div>
    </section>
  );
}
