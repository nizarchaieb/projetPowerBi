import { formatValue } from './analysis.js';

export function analyzeChartData({ byMonth = [], byDimension = [], byStatus = [], byCancellationRegion = [], metric, dimension, rowCount = 0 }) {
  const insights = [];

  if (byMonth.length >= 2) {
    const first = byMonth[0];
    const latest = byMonth[byMonth.length - 1];
    const difference = latest.value - first.value;
    const direction = difference > 0 ? 'augmenté' : difference < 0 ? 'diminué' : 'est resté stable';
    const change = first.value > 0
      ? `${formatValue(Math.abs((difference / first.value) * 100))} %`
      : formatValue(Math.abs(difference));
    insights.push({
      id: 'trend',
      title: 'Évolution dans le temps',
      detail: `${metric || 'L’indicateur'} ${direction} de ${change} entre ${first.month} et ${latest.month}.`,
      calculation: first.value > 0
        ? `(${formatValue(latest.value)} − ${formatValue(first.value)}) / ${formatValue(first.value)} × 100`
        : `Écart absolu : ${formatValue(latest.value)} − ${formatValue(first.value)}`,
    });
    const previous = byMonth[byMonth.length - 2];
    const previousDifference = latest.value - previous.value;
    const previousChange = previous.value !== 0
      ? `${formatValue(Math.abs((previousDifference / previous.value) * 100))} %`
      : formatValue(Math.abs(previousDifference));
    const previousDirection = previousDifference > 0 ? 'augmenté' : previousDifference < 0 ? 'diminué' : 'est resté stable';
    insights.push({
      id: 'previous-period',
      title: 'Comparaison avec la période précédente',
      detail: `${metric || 'L’indicateur'} a ${previousDirection} de ${previousChange} entre ${previous.month} (${formatValue(previous.value)}) et ${latest.month} (${formatValue(latest.value)}).`,
      calculation: previous.value !== 0
        ? `(${formatValue(latest.value)} − ${formatValue(previous.value)}) / ${formatValue(previous.value)} × 100`
        : `Écart absolu : ${formatValue(latest.value)} − ${formatValue(previous.value)}`,
    });
  }

  if (byDimension.length) {
    const leader = byDimension[0];
    const runnerUp = byDimension[1];
    const value = metric ? leader.value : leader.count;
    const unit = metric ? `pour « ${leader.label} »` : `dans « ${leader.label} »`;
    const comparison = runnerUp
      ? ` La valeur suivante est « ${runnerUp.label} » (${formatValue(metric ? runnerUp.value : runnerUp.count)}).`
      : '';
    insights.push({
      id: 'category',
      title: 'Catégorie en tête',
      detail: `${formatValue(value)} ${metric ? `pour ${metric}` : 'ligne(s)'} ${unit}.${comparison}`,
      category: { column: dimension, label: leader.label },
      calculation: `${formatValue(value)} · groupe : ${leader.label}${runnerUp ? ` ; groupe suivant : ${runnerUp.label} (${formatValue(metric ? runnerUp.value : runnerUp.count)})` : ''}`,
    });
  }

  if (byStatus.length) {
    const mostCommon = byStatus.reduce((best, item) => item.count > best.count ? item : best);
    insights.push({
      id: 'status',
      title: 'Statut le plus fréquent',
      detail: `« ${mostCommon.label} » apparaît sur ${formatValue(mostCommon.count)} ligne(s) dans les données filtrées.`,
      calculation: `${formatValue(mostCommon.count)} ligne(s) avec le statut « ${mostCommon.label} »`,
    });
  }

  if (byCancellationRegion.length) {
    const worst = byCancellationRegion.reduce((best, item) => item.rate > best.rate ? item : best);
    insights.push({
      id: 'cancellation-region',
      title: 'Annulations par région',
      detail: `${worst.label} présente le taux de lignes annulées le plus élevé : ${formatValue(worst.rate * 100)} % (${formatValue(worst.cancelled)} sur ${formatValue(worst.total)} lignes).`,
      calculation: `${formatValue(worst.cancelled)} / ${formatValue(worst.total)} × 100`,
    });
  }

  insights.push({
    id: 'scope',
    title: 'Périmètre analysé',
    detail: `${formatValue(rowCount)} ligne(s) sont prises en compte par les graphiques et les filtres actuels.`,
    calculation: `Nombre de lignes après filtres : ${formatValue(rowCount)}`,
  });

  return insights.slice(0, 5);
}

export function answerChartQuestion(question, insights) {
  const text = String(question || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
  if (/\b(tendance|evolution|evolue|temps|mois|hausse|baisse)\b/.test(text)) {
    return insights.find((insight) => insight.id === 'trend')?.detail
      || 'Il faut au moins deux périodes datées pour comparer une évolution. Vérifiez qu’une colonne de date a été détectée.';
  }
  if (/\b(statut|annulation|annule|commande)\b/.test(text)) {
    return insights.find((insight) => insight.id === 'status')?.detail
      || 'Aucun statut n’a été détecté dans ce fichier. Consultez la page des commandes pour vérifier les colonnes disponibles.';
  }
  if (/\b(categorie|region|produit|top|domine|meilleur|meilleure|plus eleve)\b/.test(text)) {
    return insights.find((insight) => insight.id === 'category')?.detail
      || 'Aucune catégorie exploitable ne permet de comparer les résultats pour le moment.';
  }
  if (/\b(ligne|donnee|volume|combien|perimetre)\b/.test(text)) {
    return insights.find((insight) => insight.id === 'scope')?.detail
      || 'Aucune ligne n’est actuellement disponible dans le périmètre sélectionné.';
  }
  return 'Je peux expliquer la tendance, la catégorie principale, le statut le plus fréquent ou le nombre de lignes. Essayez l’une des suggestions ci-dessous.';
}
