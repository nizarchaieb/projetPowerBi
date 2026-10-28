import { normalizeText } from './reports.js';

export function parseNumeric(value) {
  let text = String(value ?? '').trim().replace(/[\s\u00a0\u202f]/g, '');
  if (!text) return null;
  text = text.replace(/[^\d,.-]/g, '');
  if (!text || !/\d/.test(text)) return null;
  if (text.includes(',') && text.includes('.')) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.')
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(/,/g, '');
  } else if (text.includes(',')) {
    const groups = text.split(',');
    const thousands = groups.length > 1
      && groups[0].replace('-', '').length <= 3
      && groups.slice(1).every((group) => group.length === 3);
    text = thousands ? groups.join('') : text.replace(',', '.');
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function parseDate(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;

  let match = text.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?/);
  if (match) {
    const [, year, month, day = '1'] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return date.getUTCFullYear() === Number(year)
      && date.getUTCMonth() === Number(month) - 1
      && date.getUTCDate() === Number(day) ? date : null;
  }
  match = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (match) {
    const [, first, second, year] = match;
    const dayFirst = new Date(Date.UTC(Number(year), Number(second) - 1, Number(first)));
    if (dayFirst.getUTCFullYear() === Number(year)
      && dayFirst.getUTCMonth() === Number(second) - 1
      && dayFirst.getUTCDate() === Number(first)) return dayFirst;
    const monthFirst = new Date(Date.UTC(Number(year), Number(first) - 1, Number(second)));
    return monthFirst.getUTCFullYear() === Number(year)
      && monthFirst.getUTCMonth() === Number(first) - 1
      && monthFirst.getUTCDate() === Number(second) ? monthFirst : null;
  }
  return null;
}

function findNamedColumn(columns, pattern) {
  return columns.find((column) => pattern.test(normalizeText(column))) || null;
}

export function inspectDataset(columns, rows) {
  const samples = rows.slice(0, 100);
  const numeric = [];
  const dates = [];
  const categorical = [];

  columns.forEach((column, index) => {
    const values = samples.map((row) => row[index]).filter((value) => String(value ?? '').trim());
    const dateRatio = values.length
      ? values.filter((value) => parseDate(value)).length / values.length
      : 0;
    const numberRatio = values.length
      ? values.filter((value) => parseNumeric(value) !== null).length / values.length
      : 0;
    const dateNamed = /(date|jour|mois|annee|year|month)/.test(normalizeText(column));

    if (dateRatio >= 0.7 || (dateNamed && dateRatio >= 0.4)) dates.push(column);
    else if (numberRatio >= 0.7) numeric.push(column);
    else categorical.push(column);
  });

  const status = findNamedColumn(columns, /(statut|status|etat|annulation|cancel)/);
  const identifier = findNamedColumn(columns, /(^| )(id|numero|num|order|commande|transaction|reference)( |$)/);
  const numericMetrics = numeric.filter((column) => column !== identifier);
  const value = columns.find((column) =>
    numeric.includes(column) && /(montant|total|prix|revenue|sales|vente|chiffre|amount|ca|value)/.test(normalizeText(column))
  ) || numericMetrics.find((column) => /(quantite|quantity|nombre|count)/.test(normalizeText(column)))
    || numericMetrics[0] || null;
  const dimension = columns.find((column) =>
    categorical.includes(column) && /(region|pays|ville|categorie|category|produit|product|client|customer|entreprise|company|segment|type)/.test(normalizeText(column))
  ) || categorical[0] || status || null;

  return { numeric, dates, categorical, status, identifier, value, dimension };
}

export function uniqueValues(columns, rows, column) {
  const index = columns.indexOf(column);
  if (index < 0) return [];
  return Array.from(new Set(rows.map((row) => String(row[index] ?? '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'fr'));
}

export function aggregateRows(columns, rows, dimension, metric, rowFilter = () => true) {
  const dimensionIndex = columns.indexOf(dimension);
  const metricIndex = columns.indexOf(metric);
  if (dimensionIndex < 0) return [];
  const groups = new Map();
  rows.forEach((row) => {
    if (!rowFilter(row)) return;
    const label = String(row[dimensionIndex] ?? '').trim();
    if (!label) return;
    const group = groups.get(label) || { label, value: 0, count: 0 };
    const number = metricIndex < 0 ? 1 : parseNumeric(row[metricIndex]);
    if (number !== null) {
      group.value += number;
      group.count += 1;
    }
    groups.set(label, group);
  });
  return Array.from(groups.values())
    .filter((group) => group.count)
    .map((group) => ({ ...group, average: group.value / group.count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);
}

export function aggregateByMonth(columns, rows, dateColumn, metric) {
  const dateIndex = columns.indexOf(dateColumn);
  const metricIndex = columns.indexOf(metric);
  if (dateIndex < 0 || metricIndex < 0) return [];
  const groups = new Map();
  rows.forEach((row) => {
    const date = parseDate(row[dateIndex]);
    const value = parseNumeric(row[metricIndex]);
    if (!date || value === null) return;
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    groups.set(key, (groups.get(key) || 0) + value);
  });
  return Array.from(groups, ([month, value]) => ({ month, value })).sort((a, b) => a.month.localeCompare(b.month));
}

export function findCancellationValue(values) {
  return values.find((value) => /(annul|cancel|void|rembours|refund)/.test(normalizeText(value))) || '';
}

export function formatValue(value) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}
