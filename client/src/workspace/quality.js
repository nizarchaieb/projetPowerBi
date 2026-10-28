import { normalizeText } from './reports.js';
import { parseDate, parseNumeric } from './analysis.js';

const DATE_COLUMN_PATTERN = /\b(date|jour|mois|annee|year|month|time|temps)\b/;
const NUMERIC_COLUMN_PATTERN = /\b(amount|montant|total|prix|price|revenue|sales|vente|chiffre|ca|value|valeur|cost|cout|profit|benefice|quantity|quantite|age|score|count|nombre|rate|taux)\b/;
const IDENTIFIER_COLUMN_PATTERN = /\b(id|identifier|identifiant|reference|ref|numero|num|order|commande|transaction|code)\b/;

function columnType(column, values) {
  const normalized = normalizeText(column);
  const compact = normalized.replace(/\s/g, '');
  const dateNamed = DATE_COLUMN_PATTERN.test(normalized)
    || ['date', 'orderdate', 'createdat', 'updatedat', 'datetime'].some((term) => compact.includes(term));
  const validDates = values.filter((value) => parseDate(value));
  const isDate = dateNamed || (values.length > 0 && validDates.length / values.length >= 0.3);
  if (isDate) return 'date';

  const identifierNamed = IDENTIFIER_COLUMN_PATTERN.test(normalized)
    || /(?:id|identifier|identifiant|reference|ref|numero|num|code)$/.test(compact);
  if (identifierNamed) return 'category';

  const validNumbers = values.filter((value) => parseNumeric(value) !== null);
  const isNumeric = NUMERIC_COLUMN_PATTERN.test(normalized)
    || ['quantity', 'unitprice', 'totalprice', 'unitcost', 'totalcost', 'revenue', 'profit', 'amount'].some((term) => compact.includes(term))
    || (values.length > 0 && validNumbers.length / values.length >= 0.7);
  return isNumeric ? 'number' : 'category';
}

function dateFormat(value) {
  const text = String(value ?? '').trim();
  if (/^\d{4}[-/.]\d{1,2}(?:[-/.]\d{1,2})?(?:[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(text)) return 'Année-mois-jour';
  if (/^\d{1,2}[/.]\d{1,2}[/.]\d{4}$/.test(text)) {
    return text.includes('.') ? 'Jour/mois/année (points)' : 'Jour/mois/année (barres obliques)';
  }
  return 'Autre format';
}

function numberFormat(value) {
  const text = String(value ?? '').trim().replace(/[\s\u00a0\u202f]/g, '').replace(/[^\d,.-]/g, '');
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) return comma > dot ? 'Virgule décimale' : 'Point décimal';
  if (comma >= 0 && text.length - comma - 1 !== 3) return 'Virgule décimale';
  if (dot >= 0 && text.length - dot - 1 !== 3) return 'Point décimal';
  return null;
}

function normalizeDateValue(value) {
  const text = String(value ?? '').trim();
  const date = parseDate(text);
  if (!date || !(/^\d{4}[-/.]\d{1,2}(?:[-/.]\d{1,2})?(?:[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(text)
    || /^\d{1,2}[/.]\d{1,2}[/.]\d{4}$/.test(text))) return null;
  return date.toISOString().slice(0, 10);
}

export function inspectDataQuality(columns, rows) {
  const emptyColumns = [];
  const incompleteColumns = [];
  const invalidDateColumns = [];
  const inconsistentDateColumns = [];
  const inconsistentNumberColumns = [];
  const duplicateRows = [];
  const seenRows = new Map();

  rows.forEach((row, index) => {
    const key = JSON.stringify(columns.map((_, columnIndex) => String(row[columnIndex] ?? '').trim()));
    if (seenRows.has(key)) {
      if (duplicateRows.length < 5) {
        duplicateRows.push({ record: index + 2, firstRecord: seenRows.get(key) + 2 });
      }
    } else {
      seenRows.set(key, index);
    }
  });

  columns.forEach((column, columnIndex) => {
    const values = rows.map((row) => String(row[columnIndex] ?? '').trim());
    const type = columnType(column, values.filter(Boolean));
    const filledValues = values.filter(Boolean);
    const missingCount = values.length - filledValues.length;
    if (!filledValues.length) emptyColumns.push(column);
    else if (missingCount) incompleteColumns.push({ column, missingCount, total: rows.length });

    const validDates = filledValues.filter((value) => parseDate(value));
    const dateCandidate = type === 'date';

    if (dateCandidate) {
      const invalid = values
        .map((value, index) => ({ value, record: index + 2 }))
        .filter(({ value }) => value && !parseDate(value));
      if (invalid.length) {
        invalidDateColumns.push({
          column,
          invalidCount: invalid.length,
          total: filledValues.length,
          examples: invalid.slice(0, 3),
        });
      }
      const formats = Array.from(new Set(validDates.map(dateFormat)));
      if (formats.length > 1) inconsistentDateColumns.push({ column, formats });
    }

    const validNumbers = filledValues.filter((value) => parseNumeric(value) !== null);
    const numberCandidate = type === 'number';
    if (numberCandidate) {
      const invalid = values
        .map((value, index) => ({ value, record: index + 2 }))
        .filter(({ value }) => value && parseNumeric(value) === null);
      const formats = Array.from(new Set(validNumbers.map(numberFormat).filter(Boolean)));
      if (invalid.length || formats.length > 1) {
        inconsistentNumberColumns.push({
          column,
          invalidCount: invalid.length,
          formats,
          examples: invalid.slice(0, 3),
        });
      }
    }
  });

  const totalDuplicates = Math.max(0, rows.length - seenRows.size);
  const issueCount = emptyColumns.length
    + incompleteColumns.length
    + invalidDateColumns.length
    + inconsistentDateColumns.length
    + inconsistentNumberColumns.length
    + (totalDuplicates ? 1 : 0);

  return {
    rowCount: rows.length,
    columnCount: columns.length,
    issueCount,
    emptyColumns,
    incompleteColumns,
    invalidDateColumns,
    inconsistentDateColumns,
    inconsistentNumberColumns,
    duplicateCount: totalDuplicates,
    duplicateExamples: duplicateRows,
  };
}

export function cleanDataset(columns, rows) {
  const report = inspectDataQuality(columns, rows);
  const removedColumns = new Set(report.emptyColumns);
  const removedUnusableColumns = new Set();
  if (columns.length && removedColumns.size === columns.length) removedColumns.delete(columns[0]);
  const types = new Map(columns.map((column, index) => [
    column,
    columnType(column, rows.map((row) => String(row[index] ?? '').trim()).filter(Boolean)),
  ]));
  const dateIndexes = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => types.get(column) === 'date' && !removedColumns.has(column))
    .map(({ index }) => index);
  const validDateRows = rows.filter((row) => dateIndexes.every((index) => normalizeDateValue(row[index])));
  const removedDateRows = rows.length - validDateRows.length;

  columns.forEach((column, index) => {
    if (types.get(column) !== 'number' || removedColumns.has(column)) return;
    const hasNumericValue = validDateRows.some((row) => parseNumeric(row[index]) !== null);
    if (!hasNumericValue) {
      removedColumns.add(column);
      removedUnusableColumns.add(column);
    }
  });
  const keepIndexes = columns.map((column, index) => ({ column, index }))
    .filter(({ column }) => !removedColumns.has(column));
  const numericMedians = new Map();
  keepIndexes.forEach(({ column, index }) => {
    if (types.get(column) !== 'number') return;
    const values = validDateRows.map((row) => parseNumeric(row[index])).filter((value) => value !== null).sort((a, b) => a - b);
    if (!values.length) return;
    const middle = Math.floor(values.length / 2);
    const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    numericMedians.set(column, median);
  });
  const seenRows = new Set();
  let removedDuplicateRows = 0;
  let normalizedDates = 0;
  let normalizedNumbers = 0;
  let normalizedText = 0;
  let filledCategories = 0;
  let filledNumbers = 0;
  const cleanedRows = [];

  validDateRows.forEach((row) => {
    const cleanedRow = keepIndexes.map(({ column, index }) => {
      const original = String(row[index] ?? '');
      const trimmed = original.trim();
      let value = trimmed;
      const type = types.get(column);
      if (type === 'date') {
        value = normalizeDateValue(trimmed);
        if (value !== trimmed) normalizedDates += 1;
      } else if (type === 'number') {
        const parsed = parseNumeric(trimmed);
        if (parsed !== null) {
          value = String(parsed);
          if (value !== trimmed) normalizedNumbers += 1;
        } else if (numericMedians.has(column)) {
          value = String(numericMedians.get(column));
          filledNumbers += 1;
        }
      } else if (!trimmed) {
        value = 'Non renseigné';
        filledCategories += 1;
      } else if (trimmed !== original) {
        normalizedText += 1;
      }
      return value;
    });
    const key = JSON.stringify(cleanedRow);
    if (seenRows.has(key)) {
      removedDuplicateRows += 1;
      return;
    }
    seenRows.add(key);
    cleanedRows.push(cleanedRow);
  });

  const cleanedColumns = keepIndexes.map(({ column }) => column);
  const normalizedCells = normalizedDates + normalizedNumbers + normalizedText;
  const changesCount = removedColumns.size + removedDuplicateRows + removedDateRows
    + normalizedCells + filledCategories + filledNumbers;
  return {
    columns: cleanedColumns,
    rows: cleanedRows,
    removedColumns: removedColumns.size,
    removedEmptyColumns: report.emptyColumns.filter((column) => removedColumns.has(column)).length,
    removedUnusableColumns: removedUnusableColumns.size,
    removedDuplicateRows,
    removedDateRows,
    filledCategories,
    filledNumbers,
    normalizedCells,
    changesCount,
  };
}
