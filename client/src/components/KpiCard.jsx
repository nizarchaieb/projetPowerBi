import React from 'react';

export default function KpiCard({ label, value, sub, tone, info, change }) {
  return (
    <article className="kpi-card">
      <div className="kpi-label">{label}{info ? <span className="kpi-info" tabIndex="0" aria-label={info} title={info}>i</span> : null}</div>
      <div className={`kpi-value ${tone || ''}`} aria-label={`${label} : ${value}`}>{value}</div>
      {change !== undefined && change !== null ? <div className={`kpi-change${Number(change) < 0 ? ' negative' : ''}`}><span aria-hidden="true">{Number(change) < 0 ? '↓' : '↑'}</span> {change}</div> : null}
      {sub ? <div className="kpi-sub">{sub}</div> : null}
    </article>
  );
}
