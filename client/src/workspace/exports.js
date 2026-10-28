const encoder = new TextEncoder();

function cellText(value) {
  return String(value ?? '').replace(/^[\t\r ]*[=+@-]/, "'$&");
}

export function rowsToCsv(rows, headers = Object.keys(rows[0] || {})) {
  const quote = (value) => `"${cellText(value).replace(/"/g, '""')}"`;
  return `\ufeff${[headers, ...rows.map((row) => headers.map((header) => row[header]))]
    .map((row) => row.map(quote).join(';')).join('\r\n')}`;
}

function xmlEscape(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function columnName(index) {
  let value = index + 1;
  let name = '';
  while (value) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  return crc >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const u16 = (view, index, value) => view.setUint16(index, value, true);
  const u32 = (view, index, value) => view.setUint32(index, value, true);

  files.forEach(({ name, text }) => {
    const filename = encoder.encode(name);
    const data = encoder.encode(text);
    const checksum = crc32(data);
    const localHeader = new Uint8Array(30 + filename.length);
    const localView = new DataView(localHeader.buffer);
    u32(localView, 0, 0x04034b50); u16(localView, 4, 20); u16(localView, 6, 0);
    u16(localView, 8, 0); u16(localView, 10, 0); u16(localView, 12, 0);
    u32(localView, 14, checksum); u32(localView, 18, data.length); u32(localView, 22, data.length);
    u16(localView, 26, filename.length); u16(localView, 28, 0); localHeader.set(filename, 30);
    localParts.push(localHeader, data);

    const central = new Uint8Array(46 + filename.length);
    const centralView = new DataView(central.buffer);
    u32(centralView, 0, 0x02014b50); u16(centralView, 4, 20); u16(centralView, 6, 20);
    u16(centralView, 8, 0); u16(centralView, 10, 0); u16(centralView, 12, 0); u16(centralView, 14, 0);
    u32(centralView, 16, checksum); u32(centralView, 20, data.length); u32(centralView, 24, data.length);
    u16(centralView, 28, filename.length); u16(centralView, 30, 0); u16(centralView, 32, 0);
    u16(centralView, 34, 0); u16(centralView, 36, 0); u32(centralView, 38, 0); u32(centralView, 42, offset);
    central.set(filename, 46); centralParts.push(central);
    offset += localHeader.length + data.length;
  });

  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50); u16(endView, 4, 0); u16(endView, 6, 0);
  u16(endView, 8, files.length); u16(endView, 10, files.length);
  u32(endView, 12, centralSize); u32(endView, 16, offset); u16(endView, 20, 0);
  return new Blob([...localParts, ...centralParts, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function createXlsxBlob(rows, title = 'Rapport', headers = Object.keys(rows[0] || {})) {
  const safeTitle = String(title).replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Rapport';
  const allRows = [headers, ...rows.map((row) => headers.map((header) => row[header]))];
  const sheetRows = allRows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
    const address = `${columnName(columnIndex)}${rowIndex + 1}`;
    return `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const files = [
    { name: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { name: '_rels/.rels', text: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', text: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(safeTitle)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', text: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', text: `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>` },
  ];
  return zipStore(files);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadRows(rows, filename, type, headers) {
  const safeName = filename.replace(/[^\w.-]+/g, '_');
  if (type === 'xlsx') downloadBlob(createXlsxBlob(rows, safeName, headers), `${safeName}.xlsx`);
  else downloadBlob(new Blob([rowsToCsv(rows, headers)], { type: 'text/csv;charset=utf-8' }), `${safeName}.csv`);
}
