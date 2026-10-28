import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanDataset, inspectDataQuality } from './quality.js';

test('détecte les colonnes vides, valeurs manquantes, formats incorrects et doublons', () => {
  const columns = ['Order Date', 'Amount', 'Empty', 'Region'];
  const rows = [
    ['2025-01-01', '1,25', '', 'Tunis'],
    ['2025-01-01', '1,25', '', 'Tunis'],
    ['31/01/2025', '1.25', '', 'Sousse'],
    ['2025-02-30', 'unknown', '', ''],
  ];

  const report = inspectDataQuality(columns, rows);

  assert.deepEqual(report.emptyColumns, ['Empty']);
  assert.deepEqual(report.incompleteColumns, [{ column: 'Region', missingCount: 1, total: 4 }]);
  assert.equal(report.invalidDateColumns[0].column, 'Order Date');
  assert.equal(report.invalidDateColumns[0].invalidCount, 1);
  assert.deepEqual(report.inconsistentDateColumns[0].formats, [
    'Année-mois-jour',
    'Jour/mois/année (barres obliques)',
  ]);
  assert.equal(report.inconsistentNumberColumns[0].column, 'Amount');
  assert.equal(report.inconsistentNumberColumns[0].invalidCount, 1);
  assert.deepEqual(report.inconsistentNumberColumns[0].formats, ['Virgule décimale', 'Point décimal']);
  assert.equal(report.duplicateCount, 1);
  assert.deepEqual(report.duplicateExamples[0], { record: 3, firstRecord: 2 });
  assert.equal(report.issueCount, 6);
});

test('ne signale pas de problème pour un jeu de données cohérent', () => {
  const report = inspectDataQuality(
    ['Date de vente', 'Chiffre d’affaires', 'Ville'],
    [
      ['2025-01-01', '125.50', 'Tunis'],
      ['2025-01-02', '90.00', 'Sousse'],
    ],
  );

  assert.equal(report.issueCount, 0);
  assert.equal(report.duplicateCount, 0);
  assert.deepEqual(report.emptyColumns, []);
  assert.deepEqual(report.invalidDateColumns, []);
  assert.deepEqual(report.inconsistentNumberColumns, []);
});

test('remplit les valeurs manquantes, normalise les formats et retire les lignes sans date valide', () => {
  const columns = ['Date de vente', 'Montant', 'Vide', 'Ville'];
  const rows = [
    ['2025-01-01', '1,25', '', ' Tunis '],
    ['01/01/2025', '1.25', '', 'Tunis'],
    ['2025-02-30', 'unknown', '', ''],
  ];

  const cleaned = cleanDataset(columns, rows);

  assert.deepEqual(cleaned.columns, ['Date de vente', 'Montant', 'Ville']);
  assert.deepEqual(cleaned.rows, [['2025-01-01', '1.25', 'Tunis']]);
  assert.equal(cleaned.removedColumns, 1);
  assert.equal(cleaned.removedDateRows, 1);
  assert.equal(cleaned.removedDuplicateRows, 1);
  assert.equal(cleaned.normalizedCells, 3);
  assert.equal(cleaned.changesCount, 6);
});

test('préserve une colonne lorsqu’elle est la seule colonne du CSV', () => {
  const cleaned = cleanDataset(['Champ vide'], [[''], ['']]);

  assert.deepEqual(cleaned.columns, ['Champ vide']);
  assert.deepEqual(cleaned.rows, [['Non renseigné']]);
  assert.equal(cleaned.removedColumns, 0);
  assert.equal(cleaned.removedDuplicateRows, 1);
});

test('ne normalise pas les formats des colonnes identifiantes', () => {
  const cleaned = cleanDataset(
    ['Order ID'],
    [['001.0'], ['1,000']],
  );

  assert.deepEqual(cleaned.rows, [['001.0'], ['1,000']]);
});

test('nettoie les cellules vides seules et résout toutes les alertes ciblées', () => {
  const columns = ['CompanyName', 'Category', 'RegionID', 'RegionName', 'OrderDate', 'Quantity', 'UnitPrice', 'TotalPrice', 'OrderStatus'];
  const rows = [
    ['Alpha', 'A', '001', 'Tunis', '2024-01-01', '2', '10.00', '20.00', 'Completed'],
    ['', '', '', '', '2024-01-02', '', '5,00', '10,00', ''],
    ['Beta', 'B', '003', 'Sousse', '', '4', '6.00', '24.00', 'Completed'],
    ['Gamma', 'C', '004', 'Sfax', '2024-02-30', '8', '9.00', '72.00', 'Completed'],
  ];

  const cleaned = cleanDataset(columns, rows);
  const report = inspectDataQuality(cleaned.columns, cleaned.rows);

  assert.equal(cleaned.removedDateRows, 2);
  assert.equal(cleaned.filledCategories, 5);
  assert.equal(cleaned.filledNumbers, 1);
  assert.deepEqual(cleaned.rows[1], [
    'Non renseigné',
    'Non renseigné',
    'Non renseigné',
    'Non renseigné',
    '2024-01-02',
    '2',
    '5',
    '10',
    'Non renseigné',
  ]);
  assert.equal(report.issueCount, 0);
});
