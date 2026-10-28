import React from 'react';

// Mesures reproduites EXACTEMENT depuis l'Annexe B du rapport de stage.
// Note : le rapport précise que les formules des dossiers « Chiffre d'affaires »
// et « Mise en forme » ont été reconstituées d'après leur usage et doivent être
// vérifiées dans l'éditeur DAX du modèle Power BI.
const GROUPES = [
  {
    dossier: 'Dossier 1 — Base',
    mesures: [
      { nom: 'Total ventes', formule: 'Total ventes = SUM(Ventes[Prix total])', desc: 'Chiffre d’affaires total, toutes lignes et tous statuts confondus.' },
      { nom: 'Nombre de commandes', formule: 'Nombre de commandes = DISTINCTCOUNT(Ventes[Id commande])', desc: 'Nombre de commandes distinctes : chaque commande n’est comptée qu’une seule fois, quel que soit son nombre de lignes.' },
      { nom: 'Quantité vendue', formule: 'Quantité vendue = SUM(Ventes[Quantité])', desc: 'Nombre total d’unités vendues (3 109 unités sur le jeu de données).' },
      { nom: 'Commande moyenne', formule: 'Commande moyenne = DIVIDE([Total ventes], [Nombre de commandes])', desc: 'Panier moyen par commande (4 796). DIVIDE gère la division par zéro.' },
    ],
  },
  {
    dossier: 'Dossier 2 — Annulations',
    mesures: [
      { nom: 'Commandes annulées', formule: 'Commandes annulées = CALCULATE(DISTINCTCOUNT(Ventes[Id commande]), Ventes[Statut commande] = "Annulée")', desc: 'Commandes distinctes dont le statut est « Annulée » : 123 commandes. CALCULATE modifie le contexte de filtre.' },
      { nom: 'Montant annulé', formule: 'Montant annulé = CALCULATE(SUM(Ventes[Prix total]), Ventes[Statut commande] = "Annulée")', desc: 'Chiffre d’affaires perdu à cause des annulations : 550 142.' },
      { nom: 'Taux annulation', formule: 'Taux annulation = DIVIDE([Commandes annulées], [Nombre de commandes])', desc: 'Part des commandes annulées : 24,6 % (123 sur 500).' },
    ],
  },
  {
    dossier: 'Dossier 3 — Chiffre d’affaires',
    mesures: [
      { nom: 'CA net', formule: 'CA net = CALCULATE(SUM(Ventes[Prix total]), Ventes[Statut commande] <> "Annulée")', desc: 'Chiffre d’affaires hors commandes annulées : 1 847 828.' },
      { nom: 'CA net cumulé', formule: 'CA net cumulé = CALCULATE([CA net], DATESYTD(Dim_Date[Date]))', desc: 'CA net cumulé depuis le début de l’année (DATESYTD).' },
      { nom: 'CA net mois précédent', formule: 'CA net mois précédent = CALCULATE([CA net], PREVIOUSMONTH(Dim_Date[Date]))', desc: 'CA net du mois précédent, utilisé pour la variation mensuelle.' },
      { nom: 'Part du CA net', formule: 'Part du CA net = DIVIDE([CA net], CALCULATE([CA net], ALLSELECTED()))', desc: 'Part du CA net dans le total sélectionné (proportions).' },
      { nom: 'Variation mensuelle', formule: 'Variation mensuelle = DIVIDE([CA net] - [CA net mois précédent], [CA net mois précédent])', desc: 'Évolution du CA net du mois courant par rapport au mois précédent.' },
    ],
  },
  {
    dossier: 'Dossier 4 — Mise en forme',
    mesures: [
      { nom: 'Couleur taux annulation', formule: 'Couleur taux annulation = IF([Taux annulation] > 0,25, "#E74C3C", "#2ECC71")', desc: 'Couleur dynamique : rouge au-dessus de 25 % de taux d’annulation, vert en dessous.' },
      { nom: 'Titre dynamique', formule: 'Titre dynamique = "Suivi des ventes — " & FORMAT([CA net], "#,##0")', desc: 'Titre du rapport intégrant le CA net courant, mis à jour selon les filtres.' },
    ],
  },
];

export default function Dax() {
  return (
    <div className="page">
      <h1>Mesures DAX</h1>
      <p className="subtitle">Les 14 mesures du modèle Power BI, organisées en 4 dossiers d’affichage — formules reproduites depuis l’Annexe B du rapport de stage.</p>
      <div className="note">
        Note : les formules des dossiers « Chiffre d’affaires » et « Mise en forme » ont été reconstituées
        d’après leur usage dans le rapport ; elles doivent être vérifiées dans l’éditeur DAX du modèle Power BI.
      </div>
      {GROUPES.map((g) => (
        <div className="dax-group" key={g.dossier}>
          <h2>{g.dossier}</h2>
          {g.mesures.map((m) => (
            <div className="dax-card" key={m.nom}>
              <h3>{m.nom}</h3>
              <code>{m.formule}</code>
              <p>{m.desc}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
