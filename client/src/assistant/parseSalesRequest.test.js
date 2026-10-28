import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSalesRequest } from './parseSalesRequest.js';

const options = {
  regions: ['East', 'North', 'South', 'West'],
  categories: ['Accessories', 'Electronics'],
  statuts: ['Cancelled', 'Delivered', 'Pending', 'Shipped'],
  periodes: ['2023-01', '2023-11', '2023-12'],
};

test('understands a French sales request with a region and month', () => {
  const result = parseSalesRequest('Montre-moi les ventes du Sud en décembre', options);
  assert.deepEqual(result.filters, { region: 'South', mois: '2023-12' });
});

test('understands filters even when French accents are omitted', () => {
  const result = parseSalesRequest('ventes livrees a l Est en fevrier', {
    ...options,
    periodes: ['2023-02'],
  });
  assert.deepEqual(result.filters, { region: 'East', statut: 'Delivered', mois: '2023-02' });
});

test('uses an explicitly requested year', () => {
  const result = parseSalesRequest('annulations en decembre 2023', options);
  assert.equal(result.filters.statut, 'Cancelled');
  assert.equal(result.filters.mois, '2023-12');
});

test('rejects unavailable periods instead of silently filtering another month', () => {
  const result = parseSalesRequest('ventes en avril', options);
  assert.match(result.error, /Aucune donnée disponible/u);
});

test('provides a reset action when all filters are requested', () => {
  const result = parseSalesRequest('réinitialise tous les filtres', options);
  assert.deepEqual(result.filters, { region: '', categorie: '', statut: '', mois: '' });
});

test('asks for clarification when no supported filter is recognized', () => {
  const result = parseSalesRequest('compare avec le budget', options);
  assert.match(result.error, /Je n’ai pas reconnu/u);
});
