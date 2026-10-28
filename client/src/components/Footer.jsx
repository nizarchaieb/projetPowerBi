import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer app-footer">
      <div className="footer-brand"><strong>VentePilot</strong><small>Intelligence commerciale</small></div>
      <nav className="footer-links" aria-label="Liens de pied de page"><Link to="/demo">Démonstration</Link><Link to="/contact">Contact</Link><Link to="/login">Connexion</Link></nav>
      <small className="footer-version">VentePilot · Espace d’analyse commerciale</small>
    </footer>
  );
}
