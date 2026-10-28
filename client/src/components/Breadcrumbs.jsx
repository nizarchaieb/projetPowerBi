import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const LABELS = { demo: 'Démonstration', annulations: 'Annulations', commandes: 'Commandes', methodologie: 'Méthodologie', dax: 'Mesures DAX', workspace: 'Mon espace BI', bi: 'Tableau de bord', settings: 'Paramètres', admin: 'Administration', contact: 'Contact', login: 'Connexion', register: 'Demander un accès' };

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  if (pathname === '/') return null;
  const parts = pathname.split('/').filter(Boolean);
  let path = '';
  return <nav className="breadcrumbs" aria-label="Fil d’Ariane"><Link to="/">Accueil</Link>{parts.map((part, index) => { path += `/${part}`; const label = LABELS[part] || part; return <React.Fragment key={path}><span aria-hidden="true">/</span>{index === parts.length - 1 ? <span aria-current="page">{label}</span> : <Link to={path}>{label}</Link>}</React.Fragment>; })}</nav>;
}
