import React from 'react';

const STEPS = [
  {
    num: '1',
    title: 'Power Query — Préparation',
    text: 'Importation du fichier sales_2.csv (1 043 lignes, 13 colonnes). Analyse de la qualité (Column quality, distribution, profile), vérification des types, renommage des colonnes en français, suppression des colonnes redondantes.',
  },
  {
    num: '2',
    title: 'Modèle en étoile — Structuration',
    text: 'Création des dimensions Clients, Produits, Régions (par référence, doublons supprimés) et Dim_Date, puis de la table de faits Ventes. Relations un-à-plusieurs en sens unique, des dimensions vers la table de faits.',
  },
  {
    num: '3',
    title: 'DAX — Indicateurs',
    text: '14 mesures DAX organisées en 4 dossiers d’affichage : indicateurs de base, annulations, chiffre d’affaires et mise en forme. Chaque mesure est calculée dynamiquement selon le contexte de filtre.',
  },
  {
    num: '4',
    title: 'Visuels — Restitution',
    text: 'Trois pages interactives (Suivi des ventes, Analyse des annulations, Détail des commandes), navigation par menu, info-bulles personnalisées, signets et sécurité au niveau des lignes.',
  },
];

export default function Methodologie() {
  return (
    <div className="page">
      <h1>Méthodologie</h1>
      <p className="subtitle">De la donnée brute au tableau de bord : la démarche suivie dans Power BI, reproduite ici en version web.</p>

      <div className="steps">
        {STEPS.map((s) => (
          <div className="step" key={s.num}>
            <div className="step-num">{s.num}</div>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </div>
        ))}
      </div>

      <div className="schema-box">
        <h3>Modèle en étoile — schéma relationnel</h3>
        <svg viewBox="0 0 760 420" width="100%" role="img" aria-label="Schéma en étoile : la table de faits Ventes au centre, reliée aux dimensions Client, Produit, Région et Date.">
          <rect x="280" y="170" width="200" height="80" rx="10" fill="var(--primary)" />
          <text x="380" y="202" textAnchor="middle" fill="var(--text-on-primary)" fontSize="18" fontWeight="800">fact_ventes</text>
          <text x="380" y="226" textAnchor="middle" fill="var(--text-on-primary)" fontSize="12">1 043 lignes</text>

          <rect x="30" y="30" width="200" height="70" rx="10" fill="var(--surface)" stroke="var(--primary)" />
          <text x="130" y="60" textAnchor="middle" fill="var(--text)" fontSize="15" fontWeight="700">dim_client</text>
          <text x="130" y="82" textAnchor="middle" fill="var(--muted)" fontSize="12">8 clients</text>

          <rect x="530" y="30" width="200" height="70" rx="10" fill="var(--surface)" stroke="var(--primary)" />
          <text x="630" y="60" textAnchor="middle" fill="var(--text)" fontSize="15" fontWeight="700">dim_produit</text>
          <text x="630" y="82" textAnchor="middle" fill="var(--muted)" fontSize="12">8 produits</text>

          <rect x="30" y="320" width="200" height="70" rx="10" fill="var(--surface)" stroke="var(--primary)" />
          <text x="130" y="350" textAnchor="middle" fill="var(--text)" fontSize="15" fontWeight="700">dim_region</text>
          <text x="130" y="372" textAnchor="middle" fill="var(--muted)" fontSize="12">4 régions</text>

          <rect x="530" y="320" width="200" height="70" rx="10" fill="var(--surface)" stroke="var(--primary)" />
          <text x="630" y="350" textAnchor="middle" fill="var(--text)" fontSize="15" fontWeight="700">dim_date</text>
          <text x="630" y="372" textAnchor="middle" fill="var(--muted)" fontSize="12">Dates 2023</text>

          <line x1="230" y1="65" x2="280" y2="190" stroke="var(--primary)" strokeWidth="2" />
          <line x1="530" y1="65" x2="480" y2="190" stroke="var(--primary)" strokeWidth="2" />
          <line x1="230" y1="355" x2="280" y2="230" stroke="var(--primary)" strokeWidth="2" />
          <line x1="530" y1="355" x2="480" y2="230" stroke="var(--primary)" strokeWidth="2" />
          <text x="380" y="140" textAnchor="middle" fill="var(--muted)" fontSize="12">Relations 1 : * — filtre unique</text>
        </svg>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>
          La table de faits <strong style={{ color: 'var(--text)' }}>fact_ventes</strong> conserve les mesures numériques
          (quantité, prix unitaire, prix total, statut) et les clés étrangères vers les quatre dimensions.
          Chaque relation est de type un-à-plusieurs, avec une direction de filtre unique des dimensions vers la table de faits.
        </p>
      </div>
    </div>
  );
}
