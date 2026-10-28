import React, { useEffect, useRef, useState } from 'react';
import { getDemoLayout, getPersonalLayout, getUser, saveDemoLayout, savePersonalLayout } from '../api';

export default function DashboardWidgets({ scope, items }) {
  const admin = scope === 'demo' && getUser()?.role === 'admin';
  const editable = scope === 'personal' || admin;
  const [layout, setLayout] = useState({ order: items.map((item) => item.id), hidden: [] });
  const [manageOpen, setManageOpen] = useState(false);
  const [error, setError] = useState('');
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    const load = scope === 'personal' ? getPersonalLayout() : getDemoLayout(admin);
    load.then((saved) => {
      if (!cancelled) {
        setLayout({
          order: [...saved.order.filter((id) => items.some((item) => item.id === id)), ...items.map((item) => item.id).filter((id) => !saved.order.includes(id))],
          hidden: saved.hidden.filter((id) => items.some((item) => item.id === id)),
        });
      }
    }).catch(() => {
      if (!cancelled) setError('La disposition enregistrée n’a pas pu être chargée.');
    });
    return () => { cancelled = true; };
  }, [scope, admin]);

  function persist(next) {
    setLayout(next);
    if (!editable) return;
    setError('');
    const save = scope === 'personal' ? savePersonalLayout : saveDemoLayout;
    saveQueue.current = saveQueue.current.then(() => save(next)).catch(() => {
      setError('La disposition n’a pas pu être enregistrée. Vérifiez la connexion et la migration 004.');
    });
  }

  function move(id, offset) {
    const available = items.map((item) => item.id);
    const order = layout.order.filter((value) => available.includes(value));
    const unavailable = layout.order.filter((value) => !available.includes(value));
    const index = order.indexOf(id);
    const target = index + offset;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    persist({ ...layout, order: [...order, ...unavailable] });
  }

  function toggle(id) {
    const hidden = layout.hidden.includes(id)
      ? layout.hidden.filter((value) => value !== id)
      : [...layout.hidden, id];
    persist({ ...layout, hidden });
  }

  const orderedItems = layout.order.map((id) => items.find((item) => item.id === id)).filter(Boolean);
  return <section className="dashboard-widgets">
    {editable ? <div className="widget-toolbar"><button className="btn secondary small" type="button" aria-expanded={manageOpen} onClick={() => setManageOpen(!manageOpen)}>{manageOpen ? 'Fermer la disposition' : 'Organiser les graphiques'}</button></div> : null}
    {manageOpen ? <div className="widget-manager"><strong>Ordre et visibilité</strong>{orderedItems.map((item, index) => (
      <div className="widget-manager-row" key={item.id}>
        <label><input type="checkbox" checked={!layout.hidden.includes(item.id)} onChange={() => toggle(item.id)} /> {item.label}</label>
        <div><button type="button" className="btn secondary small" disabled={index === 0} aria-label={`Monter ${item.label}`} onClick={() => move(item.id, -1)}>↑</button><button type="button" className="btn secondary small" disabled={index === orderedItems.length - 1} aria-label={`Descendre ${item.label}`} onClick={() => move(item.id, 1)}>↓</button></div>
      </div>
    ))}</div> : null}
    {error ? <div className="alert error" role="status">{error}</div> : null}
    <div className="charts-grid">{orderedItems.filter((item) => !layout.hidden.includes(item.id)).map((item) => <React.Fragment key={item.id}>{item.content}</React.Fragment>)}</div>
  </section>;
}
