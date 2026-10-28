function ascii(value) {
  return String(value ?? '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[^\x20-\x7e]/g, '?');
}

function escapePdf(value) {
  return ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function number(value) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function percent(value) {
  return `${(Number(value || 0) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

export function createMonthlyPdf({ period, kpis, byRegion = [], byProduct = [], byStatus = [] }) {
  const commands = [];
  const text = (value, x, y, size = 10, color = '0.14 0.19 0.25') => {
    commands.push(`${color} rg BT /F1 ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`);
  };
  const line = (x1, y1, x2, y2, color = '0.78 0.82 0.86') => {
    commands.push(`${color} RG 0.7 w ${x1} ${y1} m ${x2} ${y2} l S`);
  };
  const chart = (title, data, baseY) => {
    commands.push(`0.96 0.97 0.98 rg 38 ${baseY - 8} 519 139 re f`);
    text(title, 50, baseY + 111, 11, '0.05 0.35 0.36');
    const entries = [...data].sort((a, b) => Number(b.caNet ?? b.value ?? 0) - Number(a.caNet ?? a.value ?? 0)).slice(0, 5);
    const max = Math.max(1, ...entries.map((entry) => Number(entry.caNet ?? entry.value ?? 0)));
    if (!entries.length) text('Aucune donnee disponible pour cette periode.', 52, baseY + 68, 9, '0.38 0.43 0.48');
    entries.forEach((entry, index) => {
      const y = baseY + 84 - index * 16;
      const label = ascii(entry.label).slice(0, 22);
      const value = Number(entry.caNet ?? entry.value ?? 0);
      text(label, 52, y, 8);
      commands.push(`0.16 0.72 0.66 rg 190 ${y - 2} ${Math.max(1, 260 * value / max)} 9 re f`);
      text(number(value), 460, y, 8);
    });
  };

  text('VENTEPILOT - RAPPORT MENSUEL', 38, 800, 17, '0.05 0.35 0.36');
  text(`Periode : ${period}`, 38, 780, 10);
  text('Indicateurs et graphiques calcules sur les filtres actifs du dashboard.', 38, 764, 9, '0.38 0.43 0.48');
  const kpiCards = [
    ['CA total', number(kpis.caTotal)],
    ['CA net (hors annulees)', number(kpis.caNet)],
    ['Montant annule', number(kpis.montantAnnule)],
    ['Commandes annulees', `${number(kpis.nbCommandesAnnulees)} / ${number(kpis.nbCommandes)}`],
  ];
  kpiCards.forEach(([label, value], index) => {
    const x = 38 + index * 132;
    text(label, x, 735, 8, '0.38 0.43 0.48');
    text(value, x, 716, 11, '0.08 0.14 0.2');
  });
  line(38, 700, 557, 700);

  chart('CA net par region', byRegion, 553);
  chart('CA net par produit', byProduct, 404);
  chart('CA net par statut', byStatus, 255);

  text('INSIGHTS ET CALCULS', 40, 225, 11, '0.05 0.35 0.36');
  const cancellationRate = kpis.nbCommandes ? kpis.nbCommandesAnnulees / kpis.nbCommandes : 0;
  const insightLines = [
    `CA total ${number(kpis.caTotal)} = CA net ${number(kpis.caNet)} + montant annule ${number(kpis.montantAnnule)}.`,
    `Taux de commandes annulees : ${number(kpis.nbCommandesAnnulees)} / ${number(kpis.nbCommandes)} = ${percent(cancellationRate)}.`,
    `Panier moyen total : CA total ${number(kpis.caTotal)} / ${number(kpis.nbCommandes)} commandes = ${number(kpis.panierMoyen)}.`,
  ];
  insightLines.forEach((insight, index) => text(insight, 42, 205 - index * 17, 8));
  text('Source : dataset de demonstration VentePilot. Les montants totaux incluent les commandes annulees.', 40, 36, 7, '0.38 0.43 0.48');

  const stream = `${commands.join('\n')}\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function downloadMonthlyPdf(report) {
  const blob = createMonthlyPdf(report);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rapport_ventepilot_${String(report.period).replace(/[^\w-]/g, '_')}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
