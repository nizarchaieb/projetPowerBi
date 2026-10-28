import React, { useMemo, useState } from 'react';
import { cleanDataset, inspectDataQuality } from '../workspace/quality';
import ConfirmDialog from './ConfirmDialog';

function IssueList({ title, items, renderItem }) {
  if (!items.length) return null;
  return (
    <section className="quality-issue-group">
      <h3>{title} <span>{items.length}</span></h3>
      <ul>{items.map((item, index) => <li key={`${title}-${item.column || item}-${index}`}>{renderItem(item)}</li>)}</ul>
    </section>
  );
}

export default function DataQualityReport({ dataset, columns, rows, onCreateCleanedCopy }) {
  const [cleaning, setCleaning] = useState(false);
  const [cleanMessage, setCleanMessage] = useState('');
  const [cleanError, setCleanError] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const report = useMemo(() => inspectDataQuality(columns, rows), [columns, rows]);
  const cleaned = useMemo(() => cleanDataset(columns, rows), [columns, rows]);
  const duplicateExamplesCount = report.duplicateExamples.length;
  const status = report.issueCount ? 'Des points à vérifier' : 'Aucun problème détecté';

  async function createCleanedCopy() {
    if (!cleaned.columns.length) {
      setCleanError('Aucune colonne exploitable ne peut être conservée après le nettoyage. Vérifiez le CSV source et corrigez ses en-têtes ou ses valeurs.');
      setCleanMessage('');
      return;
    }
    if (!cleaned.rows.length) {
      setCleanError('Le nettoyage retirerait toutes les lignes car aucune ne contient une date valide. Le fichier original est conservé ; corrigez les dates puis réessayez.');
      setCleanMessage('');
      return;
    }
    if (!cleaned.changesCount) {
      setCleanError('Aucune correction automatique n’est possible pour ce fichier. Vérifiez les colonnes et les valeurs dans le CSV source.');
      setCleanMessage('');
      return;
    }
    const summary = [
      `${cleaned.removedEmptyColumns} colonne(s) entièrement vide(s) supprimée(s)`,
      `${cleaned.removedUnusableColumns} colonne(s) numérique(s) sans valeur exploitable supprimée(s)`,
      `${cleaned.removedDateRows} ligne(s) sans date valide retirée(s)`,
      `${cleaned.removedDuplicateRows} doublon(s) supprimé(s)`,
      `${cleaned.filledCategories} valeur(s) catégorielle(s) remplie(s)`,
      `${cleaned.filledNumbers} valeur(s) numérique(s) remplacée(s) par la médiane`,
      `${cleaned.normalizedCells} format(s) harmonisé(s)`,
    ].join(', ');
    setConfirmation({
      title: `Créer une copie nettoyée de « ${dataset.name} » ?`,
      message: `${summary}. Les catégories vides seront « Non renseigné », les nombres seront remplacés par la médiane de leur colonne, les lignes sans date valide seront retirées et les doublons exacts supprimés. Le fichier original restera inchangé.`,
      summary,
    });
  }

  async function confirmCleanedCopy() {
    const summary = confirmation?.summary || '';
    setCleaning(true);
    setCleanError('');
    setCleanMessage('');
    try {
      const created = await onCreateCleanedCopy(cleaned);
      setCleanMessage(`Copie « ${created.name} » créée et activée. ${summary}.`);
    } catch (error) {
      setCleanError(error.response?.data?.error || error.message || 'Impossible de créer la copie nettoyée.');
    } finally {
      setCleaning(false);
    }
  }

  return (
    <section className={`data-quality-report${report.issueCount ? ' has-issues' : ' is-clean'}`} aria-labelledby="data-quality-title">
      <div className="quality-report-heading">
        <span className="quality-report-icon" aria-hidden="true">{report.issueCount ? '!' : '✓'}</span>
        <div className="quality-report-copy">
          <span className="eyebrow">CONTRÔLE AUTOMATIQUE DU CSV</span>
          <h2 id="data-quality-title">Assistant de qualité des données</h2>
          <p>{status} · {report.rowCount.toLocaleString('fr-FR')} lignes analysées localement</p>
        </div>
        <span className={`quality-status${report.issueCount ? ' warning' : ''}`}>{report.issueCount ? `${report.issueCount} point(s)` : 'Données prêtes'}</span>
      </div>
      <p className="quality-report-note">Contrôles par règles locales (pas d’IA générative) : vos données ne sont pas envoyées à un service externe. Les doublons signalés sont des lignes entièrement identiques.</p>
      {report.issueCount ? (
        <div className="quality-clean-actions">
          <button type="button" className="btn quality-clean-button" onClick={createCleanedCopy} disabled={cleaning}>
            {cleaning ? 'Nettoyage en cours…' : 'Nettoyer toutes les données'}
          </button>
          <span>Catégories : « Non renseigné » · nombres : médiane · lignes sans date valide retirées.</span>
        </div>
      ) : null}
      <ConfirmDialog open={!!confirmation} title={confirmation?.title} message={confirmation?.message} confirmLabel="Créer la copie" onConfirm={confirmCleanedCopy} onCancel={() => setConfirmation(null)} />
      {cleanMessage ? <p className="quality-clean-message" role="status">{cleanMessage}</p> : null}
      {cleanError ? <p className="quality-clean-error" role="alert">{cleanError}</p> : null}
      {report.issueCount ? (
        <details className="quality-report-details">
          <summary>Afficher le diagnostic détaillé</summary>
          <div className="quality-report-grid">
            <IssueList title="Colonnes entièrement vides" items={report.emptyColumns} renderItem={(column) => <><strong>{column}</strong> ne contient aucune valeur.</>} />
            <IssueList title="Valeurs manquantes" items={report.incompleteColumns} renderItem={({ column, missingCount, total }) => <><strong>{column}</strong> : {missingCount.toLocaleString('fr-FR')} cellule(s) vide(s) sur {total.toLocaleString('fr-FR')}.</>} />
            <IssueList title="Dates non reconnues" items={report.invalidDateColumns} renderItem={({ column, invalidCount, total, examples }) => (
              <><strong>{column}</strong> : {invalidCount.toLocaleString('fr-FR')} valeur(s) non interprétable(s) sur {total.toLocaleString('fr-FR')}. Exemples : {examples.map((example) => `ligne ${example.record} « ${example.value} »`).join(', ')}.</>
            )} />
            <IssueList title="Formats de dates mélangés" items={report.inconsistentDateColumns} renderItem={({ column, formats }) => <><strong>{column}</strong> utilise plusieurs formats : {formats.join(' et ')}.</>} />
            <IssueList title="Formats numériques incohérents" items={report.inconsistentNumberColumns} renderItem={({ column, invalidCount, formats, examples }) => (
              <><strong>{column}</strong>{formats.length > 1 ? ` mélange ${formats.join(' et ')}` : ''}{invalidCount ? ` et contient ${invalidCount.toLocaleString('fr-FR')} valeur(s) non numérique(s)` : ''}{examples.length ? ` (ex. ligne ${examples[0].record} : « ${examples[0].value} »)` : ''}.</>
            )} />
            {report.duplicateCount ? (
              <section className="quality-issue-group">
                <h3>Lignes dupliquées <span>{report.duplicateCount.toLocaleString('fr-FR')}</span></h3>
                <p>{duplicateExamplesCount ? `Exemples : ${report.duplicateExamples.map((item) => `ligne ${item.record} répète la ligne ${item.firstRecord}`).join(' ; ')}.` : ''}</p>
              </section>
            ) : null}
          </div>
        </details>
      ) : null}
    </section>
  );
}
