import test from 'node:test';
import assert from 'node:assert/strict';
import { createXlsxBlob, rowsToCsv } from './exports.js';

test('exporte le CSV avec BOM, séparateurs et échappement des formules', () => {
  const csv = rowsToCsv([{ name: 'A;B', value: '=1+1' }]);
  assert.ok(csv.startsWith('\ufeff'));
  assert.match(csv, /"A;B"/);
  assert.match(csv, /"'=1\+1"/);
});

test('génère un classeur XLSX ZIP avec les données en texte', async () => {
  const blob = createXlsxBlob([{ ville: 'Tunis & Sfax', total: 120 }], 'Ventes');
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
  const content = new TextDecoder().decode(bytes);
  assert.match(content, /Tunis &amp; Sfax/);
  assert.match(content, /xl\/worksheets\/sheet1.xml/);
});
