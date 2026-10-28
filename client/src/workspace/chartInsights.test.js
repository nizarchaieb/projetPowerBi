import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeChartData, answerChartQuestion } from './chartInsights.js';

test('analyse les tendances et catégories à partir des graphiques calculés', () => {
  const insights = analyzeChartData({
    byMonth: [{ month: '2025-01', value: 100 }, { month: '2025-02', value: 125 }],
    byDimension: [{ label: 'Nord', value: 80, count: 2 }, { label: 'Sud', value: 40, count: 1 }],
    byStatus: [{ label: 'Livrée', value: 4, count: 4 }, { label: 'Annulée', value: 1, count: 1 }],
    metric: 'Chiffre d’affaires',
    dimension: 'Région',
    rowCount: 5,
  });

  assert.equal(insights.length, 5);
  assert.match(insights[0].detail, /augmenté de 25 %/);
  assert.equal(insights[1].id, 'previous-period');
  assert.match(insights[2].detail, /Nord/);
  assert.deepEqual(insights[2].category, { column: 'Région', label: 'Nord' });
  assert.match(insights[3].detail, /Livrée/);
  assert.match(insights[4].detail, /5 ligne/);
});

test('limite les insights à cinq et affiche le calcul des annulations par région', () => {
  const insights = analyzeChartData({
    byMonth: [
      { month: '2025-01', value: 100 },
      { month: '2025-02', value: 120 },
      { month: '2025-03', value: 90 },
    ],
    byDimension: [{ label: 'Casablanca', value: 50, count: 5 }],
    byStatus: [{ label: 'Annulée', count: 2 }],
    byCancellationRegion: [{ label: 'Nord', cancelled: 4, total: 10, rate: 0.4 }],
    rowCount: 10,
  });

  assert.equal(insights.length, 5);
  const region = insights.find((insight) => insight.id === 'cancellation-region');
  assert.match(region.detail, /40 %/);
  assert.match(region.calculation, /4 \/ 10/);
});

test('répond aux questions suggérées sans inventer de tendance indisponible', () => {
  const insights = analyzeChartData({
    byDimension: [{ label: 'Tunis', value: 10, count: 2 }],
    dimension: 'Ville',
    rowCount: 2,
  });

  assert.match(answerChartQuestion('Quelle catégorie arrive en tête ?', insights), /Tunis/);
  assert.match(answerChartQuestion('Quelle est la tendance ?', insights), /au moins deux périodes/);
  assert.match(answerChartQuestion('Quel statut domine ?', insights), /Aucun statut/);
  assert.match(answerChartQuestion('Explique le graphique', insights), /Je peux expliquer la tendance/);
});
