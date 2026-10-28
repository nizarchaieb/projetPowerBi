import React from 'react';

export default function DashboardSkeleton() {
  return <div className="page dashboard-skeleton" role="status" aria-label="Chargement du tableau de bord" aria-busy="true">
    <span className="skeleton-line skeleton-title" /><span className="skeleton-line skeleton-copy" />
    <div className="skeleton-kpis">{Array.from({ length: 4 }, (_, index) => <span className="skeleton-card" key={index} />)}</div>
    <div className="skeleton-charts">{Array.from({ length: 4 }, (_, index) => <span className="skeleton-card" key={index} />)}</div>
  </div>;
}
