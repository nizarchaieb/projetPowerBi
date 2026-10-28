const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_COLUMNS = 100;
const MAX_ROWS = 5000;

function firstRecordDelimiter(text) {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') i += 1;
      else quoted = !quoted;
    } else if (!quoted && (char === '\n' || char === '\r')) {
      break;
    } else if (!quoted && Object.prototype.hasOwnProperty.call(counts, char)) {
      counts[char] += 1;
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseRecords(text, delimiter) {
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        field += char;
      }
      continue;
    }

    if (char === delimiter) {
      record.push(field);
      field = '';
      closedQuote = false;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      closedQuote = false;
    } else if (char === '"') {
      if (field !== '' || closedQuote) {
        throw new Error('Le CSV contient un guillemet inattendu dans un champ.');
      }
      quoted = true;
    } else if (closedQuote && char !== ' ' && char !== '\t') {
      throw new Error('Le CSV contient du texte après la fermeture d’un champ entre guillemets.');
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('Le CSV contient un champ entre guillemets qui n’est pas fermé.');
  if (field !== '' || record.length) {
    record.push(field);
    records.push(record);
  }
  return records;
}

export function parseCsvFile(file, text) {
  if (!file || !file.name.toLocaleLowerCase('fr-FR').endsWith('.csv')) {
    throw new Error('Sélectionnez un fichier avec l’extension .csv.');
  }
  if (file.size > MAX_FILE_BYTES) throw new Error('Le fichier dépasse la limite de 5 Mo.');

  const content = String(text || '').replace(/^\uFEFF/, '');
  const records = parseRecords(content, firstRecordDelimiter(content));
  while (records.length && records[records.length - 1].every((value) => !value.trim())) records.pop();
  if (records.length < 2) throw new Error('Le fichier doit contenir une ligne d’en-tête et au moins une ligne de données.');

  const rawHeaders = records.shift();
  if (rawHeaders.length > MAX_COLUMNS) throw new Error(`Le fichier dépasse la limite de ${MAX_COLUMNS} colonnes.`);
  const usedHeaders = new Set();
  const columns = rawHeaders.map((header, index) => {
    const base = header.trim() || `Colonne ${index + 1}`;
    if (base.length > 255) throw new Error(`Le nom de la colonne ${index + 1} dépasse 255 caractères.`);
    let name = base;
    let suffix = 2;
    while (usedHeaders.has(name.toLocaleLowerCase('fr-FR'))) {
      name = `${base} (${suffix})`;
      suffix += 1;
    }
    usedHeaders.add(name.toLocaleLowerCase('fr-FR'));
    return name;
  });

  const contentRecords = records.filter((record) => record.some((value) => value.trim()));
  if (contentRecords.some((record) => record.length > columns.length)) {
    throw new Error('Certaines lignes contiennent plus de valeurs que l’en-tête CSV.');
  }
  const rows = contentRecords.map((record) => columns.map((_, index) => {
    const value = String(record[index] || '').trim();
    if (value.length > 10000) throw new Error('Une valeur du fichier dépasse 10 000 caractères.');
    return value;
  }));
  if (!rows.length) throw new Error('Le fichier ne contient aucune ligne exploitable.');
  if (rows.length > MAX_ROWS) throw new Error(`Le fichier dépasse la limite de ${MAX_ROWS} lignes.`);
  return { columns, rows };
}

export function parseCsvFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Impossible de lire le fichier sélectionné.'));
    reader.readAsText(file, 'UTF-8');
  });
}
