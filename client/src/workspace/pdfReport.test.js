import test from 'node:test';
import assert from 'node:assert/strict';
import { createMonthlyPdf } from './pdfReport.js';

test('construit un PDF mensuel avec les KPIs, graphiques et calculs', async () => {
  const pdf = createMonthlyPdf({
    period: '2023-12',
    kpis: { caTotal: 247826, caNet: 164134, montantAnnule: 83692, nbCommandes: 50, nbCommandesAnnulees: 10, panierMoyen: 4956.52 },
    byRegion: [{ label: 'South', caNet: 40000 }],
    byProduct: [{ label: 'Headphones', caNet: 30000 }],
    byStatus: [{ label: 'Delivered', caNet: 90000 }],
  });
  const content = await pdf.text();
  assert.match(content, /^%PDF-1\.4/);
  assert.match(content, /CA total 247 ?826 = CA net 164 ?134 \+ montant annule 83 ?692/);
  assert.match(content, /Headphones/);
  assert.match(content, /%%EOF$/);
});
