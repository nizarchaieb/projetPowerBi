import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return <section className="not-found page"><div className="not-found-mark" aria-hidden="true">404</div><span className="eyebrow">PAGE INTROUVABLE</span><h1>Cette page n’existe pas.</h1><p>Vérifiez l’adresse ou revenez à l’accueil pour continuer votre visite.</p><div className="home-actions"><Link className="btn" to="/">Retour à l’accueil</Link><Link className="btn secondary" to="/demo">Voir la démonstration</Link></div></section>;
}
