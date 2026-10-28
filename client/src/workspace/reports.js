export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function numericValue(value) {
  let text = String(value || '').trim().replace(/[\s\u00a0\u202f]/g, '');
  if (!text) return null;
  text = text.replace(/[^\d,.-]/g, '');
  if (!text || !/\d/.test(text)) return null;
  if (text.includes(',') && text.includes('.')) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.')
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(/,/g, '');
  } else if (text.includes(',')) {
    const groups = text.split(',');
    const looksLikeThousands = groups.length > 1
      && groups[0].replace('-', '').length <= 3
      && groups.slice(1).every((group) => group.length === 3);
    text = looksLikeThousands ? groups.join('') : text.replace(',', '.');
  }
  const valueNumber = Number(text);
  return Number.isFinite(valueNumber) ? valueNumber : null;
}

export function inspectColumns(columns, rows) {
  const numeric = [];
  const categorical = [];
  columns.forEach((column, index) => {
    const values = rows.slice(0, 50).map((row) => row[index]).filter((value) => String(value || '').trim());
    const validNumbers = values.filter((value) => numericValue(value) !== null).length;
    if (values.length && validNumbers / values.length >= 0.7) numeric.push(column);
    else categorical.push(column);
  });
  return { numeric, categorical };
}

function bestColumnMatch(text, columns) {
  return columns
    .map((column) => ({ column, normalized: normalizeText(column) }))
    .filter(({ normalized }) => normalized && text.includes(normalized))
    .sort((a, b) => b.normalized.length - a.normalized.length)[0]?.column || null;
}

export function suggestReport(input, columns, rows) {
  const text = normalizeText(input);
  if (!text) return { error: 'Décrivez la statistique ou le graphique que vous voulez créer.' };
  const { numeric, categorical } = inspectColumns(columns, rows);
  if (!categorical.length) return { error: 'Ajoutez une colonne de catégories (texte ou dates) pour regrouper les résultats.' };

  const metric = bestColumnMatch(text, numeric)
    || numeric.find((column) => /(total|montant|prix|revenue|sales|vente|ca|chiffre|amount)/.test(normalizeText(column)))
    || numeric[0];
  const dimension = bestColumnMatch(text, categorical)
    || categorical.find((column) => /(date|mois|annee|region|pays|ville|categorie|produit|client|statut|status|type|segment)/.test(normalizeText(column)))
    || categorical[0];
  const asksCount = /\b(nombre|compte|combien|count|quantite de lignes)\b/.test(text);
  const asksAverage = /\b(moyenne|moyen|average|avg)\b/.test(text);
  const timeDimension = /(date|mois|annee|jour|semaine)/.test(normalizeText(dimension));
  const chartType = /\b(tableau|liste|table)\b/.test(text)
    ? 'table'
    : /\b(repartition|part|proportion|pourcentage|pourcent|camembert)\b/.test(text)
      ? 'pie'
      : /\b(evolution|tendance|temps|chronologique|courbe|ligne)\b/.test(text) || timeDimension
        ? 'line'
        : 'bar';
  const aggregation = asksCount ? 'count' : asksAverage ? 'average' : 'sum';
  if (aggregation !== 'count' && !metric) {
    return { error: 'Je n’ai pas repéré de colonne numérique. Demandez un comptage ou vérifiez votre CSV.' };
  }

  const title = asksCount
    ? `Nombre d’enregistrements par ${dimension}`
    : `${asksAverage ? 'Moyenne' : 'Total'} de ${metric} par ${dimension}`;
  return {
    report: { title, dimension, metric: metric || '', aggregation, chartType },
    message: `Suggestion prête : ${title}. Vérifiez les colonnes et le type de graphique avant l’enregistrement.`,
  };
}

export function calculateReport(report, columns, rows) {
  const dimensionIndex = columns.indexOf(report.dimension);
  const metricIndex = columns.indexOf(report.metric);
  if (dimensionIndex < 0) return [];
  const groups = new Map();

  rows.forEach((row) => {
    const label = String(row[dimensionIndex] || '').trim();
    if (!label) return;
    const group = groups.get(label) || { label, value: 0, count: 0 };
    if (report.aggregation === 'count') {
      group.value += 1;
      group.count += 1;
    } else {
      const value = numericValue(row[metricIndex]);
      if (value !== null) {
        group.value += value;
        group.count += 1;
      }
    }
    groups.set(label, group);
  });

  return Array.from(groups.values())
    .filter((group) => report.aggregation === 'count' || group.count)
    .map((group) => ({
      label: group.label,
      value: report.aggregation === 'average' ? group.value / group.count : group.value,
    }))
    .sort((a, b) => report.chartType === 'line' ? a.label.localeCompare(b.label, 'fr') : b.value - a.value)
    .slice(0, report.chartType === 'pie' ? 8 : 15);
}

export function formatReportValue(value) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}
