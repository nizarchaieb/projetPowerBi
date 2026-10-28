import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtNumber, getKpis, getMensuel, moisLabel } from '../api';
import Icon from '../components/Icon';
import ErrorState from '../components/ErrorState';

const FEATURES = [
  ['chart', 'Pilotez vos ventes', 'Suivez chiffre d’affaires, commandes et tendances dans des vues lisibles.'],
  ['dashboard', 'Explorez vos performances', 'Comparez régions, produits, clients et périodes à partir des données disponibles.'],
  ['orders', 'Analysez vos propres fichiers', 'Importez un CSV et construisez des rapports dans votre espace privé.'],
];
const STEPS = [
  ['01', 'Demandez un accès', 'Créez votre demande de compte. L’administrateur active l’accès.'],
  ['02', 'Importez un CSV', 'Ajoutez un fichier de données et vérifiez ses colonnes.'],
  ['03', 'Analysez', 'Consultez les indicateurs et enregistrez vos rapports.'],
];

export default function Home() {
  const [demo, setDemo] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [demoError, setDemoError] = useState(false);
  function loadDemo() {
    setDemoError(false);
    setDemo(null);
    getKpis().then(setDemo).catch(() => setDemoError(true));
    getMensuel().then(setMonthly).catch(() => setMonthly([]));
  }
  useEffect(() => { loadDemo(); }, []);
  const maxMonthly = Math.max(1, ...monthly.map((item) => Number(item.caNet) || 0));

  return (
    <div className="company-home">
      <section className="home-hero">
        <div className="home-hero-copy">
          <div className="home-brand-lockup">
            <img src="/ventepilot-logo.png" alt="VentePilot" />
            <span className="eyebrow">INTELLIGENCE COMMERCIALE</span>
          </div>
          <h1>Une vision claire pour piloter vos ventes.</h1>
          <p>Explorez les tableaux de bord de démonstration, puis analysez vos propres fichiers dans un espace BI privé.</p>
          <div className="home-actions">
            <Link className="btn" to="/demo">Explorer la démonstration <span aria-hidden="true">→</span></Link>
            <Link className="btn secondary" to="/register">Demander un accès</Link>
          </div>
          <div className="home-trust"><span className="trust-dot" /> Démonstration publique · espace BI après validation</div>
        </div>
        <section className="home-preview" aria-labelledby="home-preview-title">
          <div className="home-preview-heading"><span><span className="eyebrow">APERÇU DE LA DÉMO</span><h2 id="home-preview-title">Performance commerciale</h2></span><Link to="/demo" aria-label="Ouvrir le tableau de bord de démonstration">Ouvrir <span aria-hidden="true">↗</span></Link></div>
          {demo ? <div className="home-preview-kpis"><article><span>CA net</span><strong>{fmtNumber(demo.caNet)}</strong><small>Hors commandes annulées</small></article><article><span>Commandes</span><strong>{fmtNumber(demo.nbCommandes)}</strong><small>Sur le jeu de démonstration</small></article></div> : demoError ? <ErrorState title="Démo momentanément indisponible" message="Les indicateurs n’ont pas pu être chargés." onRetry={loadDemo} retryLabel="Réessayer" /> : <div className="home-preview-kpis" aria-label="Chargement des indicateurs"><article className="skeleton-card" /><article className="skeleton-card" /></div>}
          <div className="home-preview-chart"><div className="preview-chart-title"><strong>Évolution mensuelle du CA net</strong><span>Jeu de démonstration</span></div>{monthly.length ? <><div className="preview-chart-lines" aria-hidden="true"><i /><i /><i /><i /><i /></div><div className="preview-chart-bars" role="img" aria-label={`Chiffre d’affaires net mensuel pour ${monthly.length} mois`}>{monthly.map((item) => <i key={item.mois} title={`${moisLabel(item.mois)} : ${fmtNumber(item.caNet)}`} style={{ height: `${Math.max(4, (Number(item.caNet) / maxMonthly) * 100)}%` }} />)}</div><ul className="sr-only">{monthly.map((item) => <li key={item.mois}>{moisLabel(item.mois)} : {fmtNumber(item.caNet)} de chiffre d’affaires net</li>)}</ul><div className="preview-chart-labels"><span>{moisLabel(monthly[0].mois)}</span><span>{moisLabel(monthly[Math.floor((monthly.length - 1) / 2)].mois)}</span><span>{moisLabel(monthly[monthly.length - 1].mois)}</span></div></> : <p className="home-preview-state">Les séries mensuelles seront visibles quand le service de démonstration sera disponible.</p>}</div>
          <p className="home-preview-note">Les indicateurs affichés proviennent du jeu de données de démonstration.</p>
        </section>
      </section>

      <section className="home-services" aria-labelledby="features-title">
        <div className="section-heading"><span className="eyebrow">UNE PLATEFORME, UNE VISION</span><h2 id="features-title">Votre activité, dans un espace unique.</h2><p>Des outils pour comprendre la performance et décider avec méthode.</p></div>
        <div className="service-grid">{FEATURES.map(([icon, title, text]) => <article className="service-card" key={title}><span className="service-icon"><Icon name={icon} /></span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="home-process" aria-labelledby="process-title"><div className="section-heading"><span className="eyebrow">VOTRE PARCOURS</span><h2 id="process-title">De vos données à vos décisions.</h2></div><div className="process-grid">{STEPS.map(([num, title, text]) => <article className="process-step" key={num}><span>{num}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>

      <section className="home-security"><div className="security-mark" aria-hidden="true">✓</div><div><span className="eyebrow">CONFIDENTIALITÉ</span><h2>Vos données restent dans votre espace.</h2><p>Les fichiers et rapports importés sont associés à votre compte. L’accès aux espaces personnels est protégé par authentification.</p></div><Link className="btn secondary" to="/contact">Nous contacter</Link></section>

      <section className="home-faq" aria-labelledby="faq-title"><div className="section-heading"><span className="eyebrow">QUESTIONS FRÉQUENTES</span><h2 id="faq-title">Avant de commencer</h2></div><details><summary>Faut-il un compte pour voir les tableaux de bord ?</summary><p>Non. Les tableaux de démonstration sont accessibles publiquement. Un compte est nécessaire pour importer vos fichiers et créer des rapports personnels.</p></details><details><summary>Quels fichiers puis-je importer ?</summary><p>L’espace BI accepte les fichiers CSV dans les limites indiquées sur la page d’import.</p></details><details><summary>Quand mon compte est-il activé ?</summary><p>Après l’envoi de votre demande, un administrateur doit approuver votre compte.</p></details></section>

      <section className="home-cta"><div><span className="eyebrow">À VOUS DE CHOISIR</span><h2>Découvrez VentePilot avec vos données ou la démo.</h2></div><div className="home-actions"><Link className="btn secondary" to="/demo">Voir la démonstration</Link><Link className="btn" to="/register">Demander un accès <span aria-hidden="true">→</span></Link></div></section>
    </div>
  );
}
