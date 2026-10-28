const MONTHS = [
  ['janvier', ['janvier', 'janv']],
  ['février', ['fevrier', 'février', 'fevrier', 'fevr']],
  ['mars', ['mars']],
  ['avril', ['avril', 'avr']],
  ['mai', ['mai']],
  ['juin', ['juin']],
  ['juillet', ['juillet', 'juil']],
  ['août', ['aout', 'août']],
  ['septembre', ['septembre', 'sept']],
  ['octobre', ['octobre', 'oct']],
  ['novembre', ['novembre', 'nov']],
  ['décembre', ['decembre', 'décembre', 'dec', 'déc']],
];

function normalize(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/[’']/g, ' ')
    .replace(/[^\p{L}\p{N}-]+/gu, ' ')
    .trim();
}

function hasTerm(text, term) {
  const normalizedTerm = normalize(term);
  return new RegExp(`(^|\\s)${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s)`, 'u').test(text);
}

function findOption(text, options, aliases) {
  for (const [value, names] of aliases) {
    const option = options.find((item) => normalize(item) === normalize(value));
    if (option && names.some((name) => hasTerm(text, name))) return option;
  }
  return null;
}

export function parseSalesRequest(input, options) {
  const text = normalize(input);
  const filters = {};
  const applied = [];
  const resetRequested = /\b(tout|toutes|reinitialise|reinitialiser|efface)\b/u.test(text);

  const region = findOption(text, options.regions || [], [
    ['North', ['north', 'nord']],
    ['South', ['south', 'sud']],
    ['East', ['east', 'est']],
    ['West', ['west', 'ouest']],
  ]);
  if (region) {
    filters.region = region;
    applied.push(`Région : ${region}`);
  }

  const category = findOption(text, options.categories || [], [
    ['Electronics', ['electronics', 'electronique', 'electroniques']],
    ['Accessories', ['accessories', 'accessoire', 'accessoires']],
  ]);
  if (category) {
    filters.categorie = category;
    applied.push(`Catégorie : ${category}`);
  }

  const status = findOption(text, options.statuts || [], [
    ['Cancelled', ['cancelled', 'canceled', 'annule', 'annulee', 'annulees', 'annulation', 'annulations']],
    ['Delivered', ['delivered', 'livre', 'livree', 'livrees', 'livraison', 'livraisons']],
    ['Pending', ['pending', 'attente', 'en attente']],
    ['Shipped', ['shipped', 'expedie', 'expediee', 'expediees', 'expedition']],
  ]);
  if (status) {
    filters.statut = status;
    applied.push(`Statut : ${status}`);
  }

  const periods = options.periodes || [];
  const month = MONTHS.find(([, names]) => names.some((name) => hasTerm(text, name)));
  if (month) {
    const monthNumber = String(MONTHS.indexOf(month) + 1).padStart(2, '0');
    const yearMatch = text.match(/\b(20\d{2})\b/u);
    const candidates = periods.filter((period) => period.slice(5, 7) === monthNumber);
    const period = yearMatch
      ? candidates.find((candidate) => candidate.startsWith(`${yearMatch[1]}-`))
      : candidates.sort().at(-1);
    if (!period) {
      return { error: `Aucune donnée disponible pour ${month[0]}${yearMatch ? ` ${yearMatch[1]}` : ''}.` };
    }
    filters.mois = period;
    applied.push(`Période : ${month[0]} ${period.slice(0, 4)}`);
  }

  if (resetRequested && applied.length === 0) {
    return { filters: { region: '', categorie: '', statut: '', mois: '' }, message: 'Tous les filtres ont été réinitialisés.' };
  }
  if (applied.length === 0) {
    return { error: 'Je n’ai pas reconnu de région, période, catégorie ou statut. Essayez « ventes du Sud en décembre ». ' };
  }

  return {
    filters,
    message: `Filtres appliqués : ${applied.join(' · ')}.`,
  };
}
