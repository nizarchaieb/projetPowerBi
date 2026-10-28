import React from 'react';

// Filtres partagés (équivalents des segments Power BI).
export default function Filters({ options, value, onChange, onReset }) {
  const update = (key, val) => onChange({ ...value, [key]: val });
  const definitions = [
    ['region', 'Région', options.regions], ['mois', 'Mois', options.periodes],
    ['categorie', 'Catégorie', options.categories], ['statut', 'Statut', options.statuts],
  ];
  const activeFilters = definitions.filter(([key]) => value[key]).map(([key, label, choices]) => ({ key, label, choice: choices?.find((item) => item === value[key]) || value[key] }));
  return (
    <section className="filters-panel" aria-label="Filtres du tableau de bord">
    <div className="filters">
      <label>
        Région
        <select value={value.region || ''} onChange={(e) => update('region', e.target.value)}>
          <option value="">Toutes les régions</option>
          {(options.regions || []).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </label>
      <label>
        Mois
        <select value={value.mois || ''} onChange={(e) => update('mois', e.target.value)}>
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
        Catégorie
        <select value={value.categorie || ''} onChange={(e) => update('categorie', e.target.value)}>
          <option value="">Toutes les catégories</option>
          {(options.categories || []).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        Statut
        <select value={value.statut || ''} onChange={(e) => update('statut', e.target.value)}>
          <option value="">Tous les statuts</option>
          {(options.statuts || []).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <button type="button" className="btn secondary" onClick={onReset}>Réinitialiser</button>
    </div>
    {activeFilters.length ? <div className="active-filters" aria-label="Filtres actifs"><span>Filtres appliqués</span>{activeFilters.map((filter) => <button type="button" className="filter-chip" key={filter.key} onClick={() => update(filter.key, '')}>{filter.label} : <strong>{filter.choice}</strong><span aria-hidden="true">×</span><span className="sr-only"> — retirer ce filtre</span></button>)}</div> : null}
    </section>
  );
}
