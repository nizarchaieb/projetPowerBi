import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';
import { createDataset, getDatasetRows, getDatasets, getSavedReports } from '../api';
import ChartCard from '../components/ChartCard';
import DataQualityReport from '../components/DataQualityReport';
import KpiCard from '../components/KpiCard';
import DashboardSkeleton from '../components/DashboardSkeleton';
import PersonalChartAssistant from '../components/PersonalChartAssistant';
import DashboardWidgets from '../components/DashboardWidgets';
import Icon from '../components/Icon';
import { normalizeText, calculateReport, formatReportValue } from '../workspace/reports';
import { getActiveDatasetId, setActiveDatasetId } from '../workspace/activeDataset';
import { analyzeChartData } from '../workspace/chartInsights';
import { downloadRows } from '../workspace/exports';
import {
  aggregateByMonth, aggregateRows, findCancellationValue, formatValue, inspectDataset,
  parseDate, parseNumeric, uniqueValues,
} from '../workspace/analysis';

const TITLES = {
  overview: 'Mon tableau de bord',
  cancellations: 'Analyse des annulations',
  orders: 'Commandes et données',
  methodology: 'Méthodologie de vos données',
  dax: 'Mesures et formules',
};

function usePersonalDataset() {
  const [datasets, setDatasets] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [rows, setRows] = useState([]);
  const [reports, setReports] = useState([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getDatasets()
      .then((items) => {
        if (cancelled) return;
        setDatasets(items);
        const preferred = getActiveDatasetId();
        const nextId = items.some((item) => String(item.id) === preferred)
          ? preferred
          : String(items[0]?.id || '');
        setSelectedId(nextId);
        setRowsLoading(Boolean(nextId));
        setActiveDatasetId(nextId);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || 'Impossible de charger vos fichiers.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setRows([]);
      setReports([]);
      setRowsLoading(false);
      return undefined;
    }
    let cancelled = false;
    setRows([]);
    setReports([]);
    setRowsLoading(true);
    Promise.all([getDatasetRows(selectedId), getSavedReports(selectedId)])
      .then(([data, savedReports]) => {
        if (!cancelled) {
          setRows(data);
          setReports(savedReports);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || 'Impossible de charger les données sélectionnées.');
      })
      .finally(() => {
        if (!cancelled) setRowsLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  function selectDataset(id) {
    const value = String(id);
    setSelectedId(value);
    setRows([]);
    setRowsLoading(Boolean(value));
    setActiveDatasetId(value);
    setError('');
  }

  function addDataset(dataset, datasetRows) {
    setDatasets((current) => [dataset, ...current]);
    setSelectedId(String(dataset.id));
    setRows(datasetRows);
    setReports([]);
    setActiveDatasetId(dataset.id);
    setError('');
  }

  return { datasets, dataset: datasets.find((item) => String(item.id) === selectedId), selectedId, rows, reports, loading, rowsLoading, error, selectDataset, addDataset };
}

function EmptyWorkspace() {
  return (
    <section className="workspace-empty workspace-empty-start">
      <span><Icon name="upload" /></span>
      <h2>Importez vos données pour commencer</h2>
      <p>Cette page affichera vos propres indicateurs dès que vous aurez ajouté un fichier CSV dans Mon espace BI.</p>
      <Link className="btn" to="/workspace">Importer un CSV</Link>
    </section>
  );
}

function DatasetHeader({ page, datasets, selectedId, selectDataset, dataset }) {
  return (
    <>
      <header className="personal-bi-heading">
        <div><span className="eyebrow">VOTRE ESPACE ANALYTIQUE PRIVÉ</span><h1>{TITLES[page]}</h1>
          <p className="subtitle">{dataset ? `${dataset.name} · ${dataset.rowCount.toLocaleString('fr-FR')} lignes` : 'Sélectionnez votre jeu de données personnel.'}</p>
        </div>
        <div className="form-field personal-bi-picker">
          <label htmlFor="personal-dataset">Jeu de données actif</label>
          <select id="personal-dataset" value={selectedId} onChange={(event) => selectDataset(event.target.value)}>
            {datasets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      </header>
      {dataset ? <div className="personal-bi-source">Analyse privée de <strong>{dataset.fileName}</strong> · ces résultats ne proviennent pas du dashboard de démonstration.</div> : null}
    </>
  );
}

const CHART_COLORS = ['var(--primary)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)'];
const MONTH_TERMS = [
  ['01', ['janvier', 'janv', 'january', 'jan']],
  ['02', ['fevrier', 'février', 'fev', 'févr', 'february', 'feb']],
  ['03', ['mars', 'march']],
  ['04', ['avril', 'avr', 'april']],
  ['05', ['mai', 'may']],
  ['06', ['juin', 'june']],
  ['07', ['juillet', 'juil', 'july', 'jul']],
  ['08', ['aout', 'août', 'august', 'aug']],
  ['09', ['septembre', 'sept', 'september']],
  ['10', ['octobre', 'oct', 'october']],
  ['11', ['novembre', 'nov', 'november']],
  ['12', ['decembre', 'décembre', 'dec', 'déc', 'december']],
];

function monthLabel(month) {
  const [year, number] = month.split('-');
  return `${new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(year), Number(number) - 1, 1)))} ${year}`;
}

function filterRequest(input, columns, rows, analysis) {
  const text = normalizeText(input);
  if (!text) return { error: 'Précisez une valeur de filtre présente dans vos données.' };
  if (/\b(tout|toutes|reinitialise|reinitialiser|efface|reset)\b/.test(text)) {
    return { filters: {}, message: 'Tous les filtres ont été réinitialisés.' };
  }

  const filters = {};
  const applied = [];
  const categoricalColumns = [...new Set([...analysis.categorical, analysis.status, analysis.dimension].filter(Boolean))];
  const candidates = categoricalColumns.flatMap((column) => uniqueValues(columns, rows, column)
    .map((value) => ({ column, value, normalized: normalizeText(value) })))
    .filter((item) => item.normalized && text.includes(item.normalized))
    .sort((a, b) => b.normalized.length - a.normalized.length);
  const usedColumns = new Set();
  candidates.forEach((candidate) => {
    if (usedColumns.has(candidate.column)) return;
    filters[candidate.column] = candidate.value;
    usedColumns.add(candidate.column);
    applied.push(`${candidate.column} : ${candidate.value}`);
  });

  const monthTerm = MONTH_TERMS.find(([, terms]) => terms.some((term) => text.includes(normalizeText(term))));
  if (monthTerm && analysis.dates.length) {
    const year = text.match(/\b(19|20)\d{2}\b/)?.[0];
    analysis.dates.forEach((column) => {
      const index = columns.indexOf(column);
      const months = new Set(rows.map((row) => {
        const date = parseDate(row[index]);
        return date ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}` : '';
      }).filter((month) => month.endsWith(`-${monthTerm[0]}`) && (!year || month.startsWith(`${year}-`))));
      if (months.size === 1) {
        filters[`__month:${column}`] = Array.from(months)[0];
        applied.push(`${column} : ${monthLabel(Array.from(months)[0])}`);
      } else if (months.size > 1) {
        applied.push(`${column} : ${monthTerm[1][0]} (${months.size} années disponibles ; utilisez une année pour préciser)`);
      }
    });
  }

  return applied.length
    ? { filters, message: `Filtres appliqués : ${applied.join(' · ')}.` }
    : { error: 'Je n’ai reconnu aucune valeur catégorielle ou période de ce fichier. Choisissez une valeur dans les filtres ci-dessous ou demandez une catégorie et une période présentes dans le CSV.' };
}

function DatasetFilterAssistant({ columns, rows, analysis, filters, onChange }) {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const categoricalColumns = [...new Set([...analysis.categorical, analysis.status, analysis.dimension].filter(Boolean))];
  const dateMonths = analysis.dates.flatMap((column) => {
    const index = columns.indexOf(column);
    return Array.from(new Set(rows.map((row) => {
      const date = parseDate(row[index]);
      return date ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}` : '';
    }).filter(Boolean))).map((month) => ({ column, month }));
  });

    useEffect(() => () => {
      if (recognitionRef.current) recognitionRef.current.abort();
    }, []);

    function applyRequest(value) {
      const result = filterRequest(value, columns, rows, analysis);
      setIsError(Boolean(result.error));
      setMessage(result.error || result.message);
      if (result.filters) onChange(result.filters);
    }

    function startListening() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setIsError(true);
        setMessage('La reconnaissance vocale n’est pas disponible dans ce navigateur. Essayez Chrome ou saisissez votre demande.');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognitionRef.current = recognition;
      recognition.onstart = () => {
        setListening(true);
        setIsError(false);
        setMessage('Je vous écoute…');
      };
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        applyRequest(transcript);
      };
      recognition.onerror = (event) => {
        setIsError(true);
        setMessage(event.error === 'not-allowed'
          ? 'Autorisez le microphone dans votre navigateur, puis réessayez.'
          : 'La reconnaissance vocale a échoué. Vous pouvez saisir votre demande.');
      };
      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
      };
      try {
        recognition.start();
      } catch {
        recognitionRef.current = null;
        setListening(false);
        setIsError(true);
        setMessage('Impossible de démarrer le microphone. Vérifiez ses autorisations et réessayez.');
      }
    }

    return (
      <section className="sales-assistant personal-filter-assistant" aria-labelledby="sales-assistant-title">
      <div className="assistant-heading">
        <div className="assistant-mark"><Icon name="sparkle" /></div>
        <div><span className="eyebrow">ASSISTANT DE FILTRAGE</span><h2 id="sales-assistant-title">Posez une question sur vos ventes</h2>
          <p>Décrivez une valeur de vos données, par exemple une région, un statut ou un mois.</p>
        </div>
      </div>
      <form className="assistant-form" onSubmit={(event) => { event.preventDefault(); applyRequest(query); }}>
        <label className="sr-only" htmlFor="personal-filter-query">Votre demande de filtre</label>
        <input id="personal-filter-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex. : montre les ventes du Nord en décembre 2025" aria-describedby="personal-filter-message" />
        <button type="button" className={`assistant-mic${listening ? ' listening' : ''}`} onClick={startListening} disabled={listening} aria-label={listening ? 'Écoute en cours' : 'Dicter une demande'} aria-pressed={listening}>
          {listening ? 'Écoute…' : '🎙 Dicter'}
        </button>
        <button type="submit" className="btn" disabled={!query.trim()}>Appliquer</button>
      </form>
      <div className="assistant-foot"><span id="personal-filter-message" className={isError ? 'assistant-feedback error-text' : 'assistant-feedback'} aria-live="polite">{message || 'L’assistant filtre uniquement les valeurs trouvées dans le fichier sélectionné.'}</span><span className="assistant-private">La reconnaissance vocale dépend de votre navigateur.</span></div>
      <details className="personal-bi-filters">
        <summary>Filtres détaillés <span>{Object.values(filters).filter(Boolean).length ? `${Object.values(filters).filter(Boolean).length} actif(s)` : 'facultatifs'}</span></summary>
        <div className="personal-bi-filter-grid">
          {categoricalColumns.map((column) => (
            <label key={column}>{column}<select value={filters[column] || ''} onChange={(event) => onChange({ ...filters, [column]: event.target.value })}>
              <option value="">Toutes les valeurs</option>{uniqueValues(columns, rows, column).map((value) => <option key={value} value={value}>{value}</option>)}
            </select></label>
          ))}
          {analysis.dates.map((column) => (
            <label key={column}>{column}<select value={filters[`__month:${column}`] || ''} onChange={(event) => onChange({ ...filters, [`__month:${column}`]: event.target.value })}>
              <option value="">Toutes les périodes</option>{dateMonths.filter((entry) => entry.column === column).map((entry) => <option key={entry.month} value={entry.month}>{monthLabel(entry.month)}</option>)}
            </select></label>
          ))}
          <button type="button" className="btn secondary" onClick={() => { onChange({}); setQuery(''); setMessage('Tous les filtres ont été réinitialisés.'); setIsError(false); }}>Réinitialiser</button>
        </div>
      </details>
    </section>
  );
}

function SavedReportCard({ report, columns, rows }) {
  const data = calculateReport(report, columns, rows);
  const formatter = (value) => formatReportValue(value);
  const tick = (label) => String(label).length > 17 ? `${String(label).slice(0, 16)}…` : label;
  const valueHeader = report.aggregation === 'count' ? 'Nombre' : report.metric;
  const exportData = data.map((item) => ({ [report.dimension]: item.label, [valueHeader]: item.value }));
  return (
    <article className="chart-card"><h3>{report.title}</h3><div className="chart-body">
      {data.length === 0 ? <p className="workspace-no-data">Aucune donnée ne correspond à ce rapport et aux filtres actifs.</p> : null}
      {data.length && report.chartType === 'table' ? <div className="table-wrap personal-report-table"><table className="data-table"><thead><tr><th>{report.dimension}</th><th>{report.aggregation === 'count' ? 'Nombre' : report.metric}</th></tr></thead><tbody>{data.map((item) => <tr key={item.label}><td>{item.label}</td><td>{formatter(item.value)}</td></tr>)}</tbody></table></div> : null}
      {data.length && report.chartType === 'bar' ? <ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ top: 6, right: 14, left: 12, bottom: 6 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis type="number" stroke="var(--muted)" tickFormatter={formatter} /><YAxis type="category" dataKey="label" stroke="var(--muted)" width={125} interval={0} tick={{ fontSize: 10 }} tickFormatter={tick} /><Tooltip formatter={formatter} /><Bar dataKey="value" name={report.metric || 'Nombre'} fill="var(--primary)" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer> : null}
      {data.length && report.chartType === 'line' ? <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 6, right: 14, left: 12, bottom: 24 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="label" stroke="var(--muted)" interval="preserveStartEnd" tick={{ fontSize: 10 }} tickFormatter={tick} /><YAxis stroke="var(--muted)" tickFormatter={formatter} /><Tooltip formatter={formatter} /><Line dataKey="value" name={report.metric || 'Nombre'} stroke="var(--primary)" strokeWidth={3} dot={{ r: 2 }} /></LineChart></ResponsiveContainer> : null}
      {data.length && report.chartType === 'pie' ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="label" innerRadius={48} outerRadius={92} paddingAngle={2}>{data.map((item, index) => <Cell key={item.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip formatter={formatter} /></PieChart></ResponsiveContainer> : null}
    </div><div className="report-export-actions"><button type="button" className="btn secondary small" disabled={!data.length} onClick={() => downloadRows(exportData, report.title, 'xlsx', [report.dimension, valueHeader])}>Excel (.xlsx)</button><button type="button" className="btn secondary small" disabled={!data.length} onClick={() => downloadRows(exportData, report.title, 'csv', [report.dimension, valueHeader])}>CSV</button></div></article>
  );
}

function PersonalOverview({ dataset, rows, columns, analysis, reports }) {
  const [filters, setFilters] = useState({});
  useEffect(() => setFilters({}), [dataset.id]);
  const filteredRows = useMemo(() => rows.filter((row) => Object.entries(filters).every(([key, value]) => {
    if (!value) return true;
    if (key.startsWith('__month:')) {
      const column = key.slice('__month:'.length);
      const date = parseDate(row[columns.indexOf(column)]);
      return date && `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}` === value;
    }
    return String(row[columns.indexOf(key)] ?? '').trim().toLocaleLowerCase('fr') === value.toLocaleLowerCase('fr');
  })), [rows, filters, columns]);
  const metricIndex = columns.indexOf(analysis.value);
  const values = metricIndex < 0 ? [] : filteredRows.map((row) => parseNumeric(row[metricIndex])).filter((value) => value !== null);
  const total = values.reduce((sum, value) => sum + value, 0);
  const mean = values.length ? total / values.length : 0;
  const uniqueIds = analysis.identifier
    ? new Set(filteredRows.map((row) => row[columns.indexOf(analysis.identifier)]).filter(Boolean)).size
    : null;
  const byDimension = analysis.dimension
    ? aggregateRows(columns, filteredRows, analysis.dimension, analysis.value)
    : [];
  const byMonth = analysis.dates[0] && analysis.value
    ? aggregateByMonth(columns, filteredRows, analysis.dates[0], analysis.value)
    : [];
  const byStatus = analysis.status ? aggregateRows(columns, filteredRows, analysis.status, null) : [];
  const regionColumn = columns.find((column) => /\bregion\b/.test(normalizeText(column)));
  const cancellationValue = analysis.status ? findCancellationValue(uniqueValues(columns, filteredRows, analysis.status)) : '';
  const statusIndex = columns.indexOf(analysis.status);
  const byCancellationRegion = regionColumn && cancellationValue && statusIndex >= 0
    ? aggregateRows(columns, filteredRows, regionColumn, null).map((group) => {
      const cancelled = aggregateRows(columns, filteredRows, regionColumn, null, (row) =>
        String(row[statusIndex] ?? '').trim().toLocaleLowerCase('fr') === cancellationValue.toLocaleLowerCase('fr')
      ).find((item) => item.label === group.label)?.count || 0;
      return { label: group.label, cancelled, total: group.count, rate: group.count ? cancelled / group.count : 0 };
    })
    .filter((group) => group.total > 0)
    .sort((a, b) => b.rate - a.rate)
    : [];
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const chartInsights = analyzeChartData({
    byMonth,
    byDimension,
    byStatus,
    byCancellationRegion,
    metric: analysis.value,
    dimension: analysis.dimension,
    rowCount: filteredRows.length,
  });
  const personalWidgets = [
    byMonth.length ? { id: 'month', label: 'Évolution mensuelle', content: <ChartCard title={`Évolution mensuelle · ${analysis.value}`}><ResponsiveContainer width="100%" height="100%"><LineChart data={byMonth}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="month" tickFormatter={monthLabel} stroke="var(--muted)" interval="preserveStartEnd" /><YAxis stroke="var(--muted)" tickFormatter={formatValue} /><Tooltip labelFormatter={monthLabel} formatter={formatValue} /><Line dataKey="value" name={analysis.value} stroke="var(--primary)" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></ChartCard> } : null,
    byDimension.length ? { id: 'dimension', label: `Résultats par ${analysis.dimension}`, content: <ChartCard title={`${analysis.value ? 'Total' : 'Nombre de lignes'} par ${analysis.dimension}`}><ResponsiveContainer width="100%" height="100%"><BarChart data={byDimension} layout="vertical" margin={{ left: 12, right: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis type="number" stroke="var(--muted)" tickFormatter={formatValue} /><YAxis type="category" dataKey="label" stroke="var(--muted)" width={130} interval={0} tick={{ fontSize: 10 }} tickFormatter={(label) => String(label).length > 18 ? `${String(label).slice(0, 17)}…` : label} /><Tooltip formatter={formatValue} /><Bar dataKey={analysis.value ? 'value' : 'count'} name={analysis.value || 'Lignes'} fill="var(--primary)" /></BarChart></ResponsiveContainer></ChartCard> } : null,
    byStatus.length ? { id: 'status', label: `Lignes par ${analysis.status}`, content: <ChartCard title={`Nombre de lignes par ${analysis.status}`}><ResponsiveContainer width="100%" height="100%"><BarChart data={byStatus}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="label" stroke="var(--muted)" /><YAxis stroke="var(--muted)" /><Tooltip /><Bar dataKey="value" name="Lignes" fill="var(--chart-2)" /></BarChart></ResponsiveContainer></ChartCard> } : null,
  ].filter(Boolean);

  return (
    <>
      <DatasetFilterAssistant columns={columns} rows={rows} analysis={analysis} filters={filters} onChange={setFilters} />
      <div className="kpi-grid">
        <KpiCard label="Lignes filtrées" value={formatValue(filteredRows.length)} sub={`${formatValue(rows.length)} lignes dans le fichier`} />
        {uniqueIds !== null ? <KpiCard label="Valeurs distinctes" value={formatValue(uniqueIds)} sub={`Identifiant : ${analysis.identifier}`} /> : null}
        {analysis.value ? <KpiCard label={`Total · ${analysis.value}`} value={formatValue(total)} sub={`${values.length.toLocaleString('fr-FR')} valeurs numériques exploitables`} tone="teal" /> : null}
        {analysis.value ? <KpiCard label={`Moyenne · ${analysis.value}`} value={formatValue(mean)} sub="Moyenne des valeurs numériques" /> : null}
      </div>
      {!analysis.value ? <div className="note">Aucune colonne numérique n’a été détectée. Les indicateurs de somme et de moyenne seront disponibles si le fichier contient des nombres.</div> : null}
      <PersonalChartAssistant
        insights={chartInsights}
        onFilterCategory={(column, value) => setFilters((current) => ({ ...current, [column]: value }))}
        onResetFilters={() => setFilters({})}
      />
      <DashboardWidgets scope="personal" items={personalWidgets} />
      {!byMonth.length && !byDimension.length && !byStatus.length ? <div className="workspace-empty"><h3>Aucun graphique disponible avec ces filtres</h3><p>Réinitialisez les filtres pour afficher les données du fichier.</p><button type="button" className="btn secondary" onClick={() => setFilters({})}>Réinitialiser les filtres</button></div> : null}
      {analysis.dimension ? <p className="personal-bi-foot">Les graphiques regroupent les lignes du fichier par « {analysis.dimension} ». Les colonnes utilisées sont détectées depuis ses en-têtes et valeurs.</p> : null}
      <section className="personal-saved-reports">
        <div className="workspace-section-heading"><div><span className="eyebrow">RAPPORTS PERSONNALISÉS</span><h2>Vos rapports enregistrés</h2><p>Les rapports de « {dataset.name} » sont affichés ici et suivent les filtres sélectionnés.</p></div><span className="admin-count">{reports.length}</span></div>
        {reports.length ? <div className="charts-grid personal-saved-report-grid">{reports.map((report) => <SavedReportCard key={report.id} report={report} columns={columns} rows={filteredRows} />)}</div> : <div className="workspace-empty"><h3>Aucun rapport enregistré pour ce fichier</h3><p>Créez un rapport dans Mon espace BI pour le retrouver ici.</p><Link className="btn" to="/workspace">Créer un rapport</Link></div>}
      </section>
      <div className="personal-bi-next"><Link className="btn secondary" to="/bi/commandes">Consulter les données</Link><Link className="btn" to="/workspace">Créer un rapport personnalisé</Link></div>
      {activeFilters ? <p className="personal-bi-foot">{activeFilters} filtre(s) appliqué(s) au dashboard et aux rapports enregistrés.</p> : null}
    </>
  );
}

function PersonalCancellations({ columns, rows, analysis }) {
  const status = analysis.status;
  const values = useMemo(() => uniqueValues(columns, rows, status), [columns, rows, status]);
  const [statusValue, setStatusValue] = useState('');
  useEffect(() => {
    setStatusValue(findCancellationValue(values));
  }, [values]);
  const statusIndex = columns.indexOf(status);
  const cancelledRows = statusIndex < 0 || !statusValue ? [] : rows.filter((row) =>
    String(row[statusIndex] ?? '').trim().toLocaleLowerCase('fr') === statusValue.toLocaleLowerCase('fr')
  );
  const cancelledValueIndex = columns.indexOf(analysis.value);
  const cancelledAmount = cancelledValueIndex < 0 ? null : cancelledRows.reduce((sum, row) => sum + (parseNumeric(row[cancelledValueIndex]) || 0), 0);
  const share = rows.length ? cancelledRows.length / rows.length : 0;
  const byDimension = analysis.dimension
    ? aggregateRows(columns, cancelledRows, analysis.dimension, analysis.value)
    : [];

  if (!status) {
    return <div className="note">Aucune colonne de statut ou d’annulation n’a été détectée dans ce CSV. Cette page ne peut pas calculer des annulations sans inventer de résultat. Colonnes disponibles : {columns.join(', ')}.</div>;
  }

  return (
    <>
      <div className="filters">
        <label>Colonne de statut<select value={status} disabled><option>{status}</option></select></label>
        <label>Valeur considérée comme annulée<select value={statusValue} onChange={(event) => setStatusValue(event.target.value)}><option value="">Choisir la valeur d’annulation</option>{values.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      </div>
      {!findCancellationValue(values) ? <div className="note">Aucune valeur n’indique clairement une annulation. Vérifiez la valeur sélectionnée avant d’interpréter ces résultats.</div> : null}
      {!statusValue ? <div className="note">Choisissez la valeur du statut qui représente une annulation pour afficher les indicateurs.</div> : (
        <>
          <div className="kpi-grid">
            <KpiCard label="Lignes correspondant au statut" value={formatValue(cancelledRows.length)} sub={`Valeur « ${statusValue} » dans ${status}`} tone="red" />
            <KpiCard label="Part des lignes" value={`${(share * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`} sub={`${formatValue(cancelledRows.length)} sur ${formatValue(rows.length)} lignes`} tone="red" />
            {cancelledAmount !== null ? <KpiCard label={`Total · ${analysis.value}`} value={formatValue(cancelledAmount)} sub="Montant pour le statut sélectionné" /> : null}
          </div>
          {byDimension.length ? <div className="charts-grid"><ChartCard title={`Valeurs annulées par ${analysis.dimension}`}>
            <ResponsiveContainer width="100%" height="100%"><BarChart data={byDimension} layout="vertical" margin={{ left: 24 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis type="number" stroke="var(--muted)" tickFormatter={formatValue} /><YAxis type="category" dataKey="label" stroke="var(--muted)" width={100} /><Tooltip formatter={formatValue} /><Bar dataKey="value" name={analysis.value || 'Lignes'} fill="var(--danger)" /></BarChart></ResponsiveContainer>
          </ChartCard></div> : null}
          <p className="personal-bi-foot">La part correspond aux lignes CSV ayant exactement la valeur de statut choisie ; elle ne représente pas un taux de commandes distinctes.</p>
        </>
      )}
    </>
  );
}

function PersonalOrders({ dataset, columns, rows }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('fr');
    return term ? rows.filter((row) => row.some((value) => String(value).toLocaleLowerCase('fr').includes(term))) : rows;
  }, [rows, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [search, dataset.id]);

  return (
    <>
      <div className="personal-bi-table-tools"><label htmlFor="personal-search">Rechercher dans les lignes</label><input id="personal-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Saisir une valeur…" /><span>{formatValue(filtered.length)} ligne(s)</span><button type="button" className="btn secondary small" disabled={!filtered.length} onClick={() => downloadRows(filtered.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]]))), `${dataset.name}_commandes`, 'xlsx', columns)}>Excel (.xlsx)</button><button type="button" className="btn secondary small" disabled={!filtered.length} onClick={() => downloadRows(filtered.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]]))), `${dataset.name}_commandes`, 'csv', columns)}>CSV</button></div>
      <div className="table-wrap"><table className="data-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{pageRows.map((row, rowIndex) => <tr key={`${page}-${rowIndex}`}>{columns.map((column, index) => <td key={column}>{row[index]}</td>)}</tr>)}
          {!pageRows.length ? <tr><td colSpan={columns.length}>Aucune ligne ne correspond à la recherche.</td></tr> : null}
        </tbody>
      </table></div>
      <div className="pagination"><button type="button" className="btn secondary small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</button><span>Page {page} / {pageCount}</span><button type="button" className="btn secondary small" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Suivant</button></div>
    </>
  );
}

function StarSchemaModel({ dataset, rows, columns, analysis }) {
  const dimensions = [
    ...analysis.categorical
      .filter((column) => column !== analysis.identifier)
      .map((column) => ({ column, label: `Dim_${column}`, type: 'Catégorie' })),
    ...analysis.dates.map((column) => ({ column, label: `Dim_Date_${column}`, type: 'Calendrier' })),
  ].map((dimension) => ({
    ...dimension,
    distinct: uniqueValues(columns, rows, dimension.column).length,
  }));

  const left = dimensions.filter((_, index) => index % 2 === 0);
  const right = dimensions.filter((_, index) => index % 2 === 1);
  const rowCount = Math.max(left.length, right.length, 1);
  const factName = `Fact_${dataset.name}`.replace(/\s+/g, '_');
  const measures = analysis.numeric.filter((column) => column !== analysis.identifier);

  return (
    <section className="schema-box personal-star-schema">
      <div className="personal-model-heading">
        <div><span className="eyebrow">MODÈLE ADAPTÉ AU CSV</span><h2>Modèle en étoile recommandé</h2></div>
        <span className="personal-model-grain">Grain : 1 ligne CSV = 1 enregistrement</span>
      </div>
      <p className="personal-model-intro">
        Proposition générée depuis les colonnes et les valeurs de « {dataset.name} » ({formatValue(rows.length)} lignes).
        Les dimensions sont reliées à la table de faits par leur colonne source.
      </p>
      {dimensions.length ? (
        <div className="personal-star-grid" style={{ '--model-rows': rowCount }}>
          <div className="personal-model-side personal-model-left">
            {left.map((dimension, index) => <article className="personal-model-table" key={dimension.label} style={{ gridRow: index + 1 }}>
              <span className="personal-model-type">{dimension.type}</span>
              <h3>{dimension.label}</h3>
              <strong className="personal-model-key">PK candidate · {dimension.column}</strong>
              <p>{dimension.column}{dimension.type === 'Calendrier' ? ' · année · trimestre · mois · jour' : ''}</p>
              <small>{formatValue(dimension.distinct)} valeur(s) distincte(s)</small>
              <span className="personal-model-connector" aria-label={`Relation ${dimension.label} vers ${factName}`}>1 ─── *</span>
            </article>)}
          </div>

          <article className="personal-model-table personal-model-fact" style={{ gridRow: `1 / span ${rowCount}` }}>
            <span className="personal-model-type">Table centrale · faits</span>
            <h3>{factName}</h3>
            {analysis.identifier ? <p><strong>Identifiant métier :</strong> {analysis.identifier}</p> : null}
            {dimensions.map((dimension) => <p key={dimension.label}><strong>FK proposée :</strong> {dimension.column}</p>)}
            {measures.length ? <p><strong>Mesures :</strong> {measures.join(', ')}</p> : <p><strong>Mesure :</strong> nombre d’enregistrements</p>}
            <small>{formatValue(rows.length)} ligne(s) de faits · {measures.length} mesure(s) détectée(s)</small>
          </article>

          <div className="personal-model-side personal-model-right">
            {right.map((dimension, index) => <article className="personal-model-table" key={dimension.label} style={{ gridRow: index + 1 }}>
              <span className="personal-model-type">{dimension.type}</span>
              <h3>{dimension.label}</h3>
              <strong className="personal-model-key">PK candidate · {dimension.column}</strong>
              <p>{dimension.column}{dimension.type === 'Calendrier' ? ' · année · trimestre · mois · jour' : ''}</p>
              <small>{formatValue(dimension.distinct)} valeur(s) distincte(s)</small>
              <span className="personal-model-connector" aria-label={`Relation ${dimension.label} vers ${factName}`}>* ─── 1</span>
            </article>)}
          </div>
        </div>
      ) : (
        <div className="personal-model-table personal-model-fact-only">
          <span className="personal-model-type">Table de faits proposée</span>
          <h3>{factName}</h3>
          <p>Aucune colonne catégorielle ou date n’a été détectée pour construire des dimensions.</p>
          {analysis.identifier ? <p><strong>Identifiant :</strong> {analysis.identifier}</p> : null}
          <p><strong>Mesures :</strong> {measures.length ? measures.join(', ') : 'nombre d’enregistrements'}</p>
        </div>
      )}
      <div className="personal-model-legend">
        <span><strong>PK candidate</strong> : colonne qui pourrait identifier une ligne de dimension.</span>
        <span><strong>FK proposée</strong> : valeur source à conserver dans la table de faits.</span>
        <span><strong>1 → *</strong> : une valeur de dimension peut correspondre à plusieurs lignes de faits.</span>
      </div>
      <div className="note personal-model-warning">
        Modèle logique recommandé, pas encore matérialisé : le CSV est conservé dans son format d’origine.
        Avant de créer ces tables, il faut valider l’unicité des clés proposées et la qualité des relations.
      </div>
    </section>
  );
}

function PersonalMethodology({ dataset, rows, columns, analysis }) {
  return (
    <>
      <div className="note">Cette méthodologie et le modèle proposé sont calculés depuis le CSV sélectionné, sans utiliser le fichier de démonstration.</div>
      <div className="steps">
        <article className="step"><div className="step-num">1</div><h3>Fichier source</h3><p>{dataset.fileName} contient {formatValue(rows.length)} lignes et {formatValue(columns.length)} colonnes. Les données importées restent liées à votre compte.</p></article>
        <article className="step"><div className="step-num">2</div><h3>Colonnes détectées</h3><p>{analysis.numeric.length} numérique(s), {analysis.dates.length} date(s) et {analysis.categorical.length} catégorielle(s). Les types sont estimés depuis les valeurs du fichier.</p></article>
        <article className="step"><div className="step-num">3</div><h3>Modèle proposé</h3><p>Les champs catégoriels et dates deviennent des dimensions candidates. Les valeurs numériques deviennent des mesures dans une table de faits, au grain d’une ligne CSV.</p></article>
        <article className="step"><div className="step-num">4</div><h3>Validation nécessaire</h3><p>La détection est indicative. Vérifiez les clés, les doublons, les dates, les statuts et les montants avant de transformer ce modèle logique en tables physiques.</p></article>
      </div>
      <StarSchemaModel dataset={dataset} rows={rows} columns={columns} analysis={analysis} />
      <section className="schema-box"><h3>Colonnes de « {dataset.name} »</h3><div className="personal-bi-columns">{columns.map((column) => {
        const type = analysis.numeric.includes(column) ? 'Numérique' : analysis.dates.includes(column) ? 'Date' : 'Catégorie';
        return <span key={column}><strong>{column}</strong><small>{type}</small></span>;
      })}</div></section>
    </>
  );
}

function daxColumn(table, column) {
  return `'${table.replace(/'/g, "''")}'[${column.replace(/]/g, ']]')}]`;
}

function PersonalMeasures({ dataset, columns, rows, analysis }) {
  const table = dataset.name.replace(/'/g, "''");
  const measures = [
    { name: 'Nombre de lignes', formula: `Nombre de lignes = COUNTROWS('${table}')`, description: 'Compte les enregistrements actuellement présents dans le CSV.' },
  ];
  if (analysis.value) {
    const field = daxColumn(dataset.name, analysis.value);
    measures.push(
      { name: `Total ${analysis.value}`, formula: `Total ${analysis.value} = SUM(${field})`, description: `Somme de la colonne numérique « ${analysis.value} ».` },
      { name: `Moyenne ${analysis.value}`, formula: `Moyenne ${analysis.value} = AVERAGE(${field})`, description: `Moyenne de la colonne « ${analysis.value} » ; les valeurs vides ne contribuent pas.` },
    );
  }
  if (analysis.identifier) {
    measures.push({ name: 'Valeurs distinctes', formula: `Valeurs distinctes = DISTINCTCOUNT(${daxColumn(dataset.name, analysis.identifier)})`, description: `Compte les identifiants distincts dans « ${analysis.identifier} ».` });
  }
  const cancellationValue = analysis.status
    ? findCancellationValue(uniqueValues(columns, rows, analysis.status))
    : '';
  if (analysis.status && cancellationValue) {
    measures.push({
      name: 'Lignes annulées',
      formula: `Lignes annulées = CALCULATE(COUNTROWS('${table}'), ${daxColumn(dataset.name, analysis.status)} = "${cancellationValue.replace(/"/g, '""')}")`,
      description: `Compte les lignes dont « ${analysis.status} » vaut « ${cancellationValue} ».`,
    });
  }
  return (
    <>
      <div className="note">Ces formules sont des exemples DAX basés sur les colonnes et les valeurs détectées dans votre fichier. Elles décrivent les calculs du dashboard web ; elles ne sont pas exécutées dans Power BI par ce site.</div>
      <div className="dax-group"><h2>Mesures proposées pour « {dataset.name} »</h2>{measures.map((measure) => <article className="dax-card" key={measure.name}><h3>{measure.name}</h3><code>{measure.formula}</code><p>{measure.description}</p></article>)}</div>
      {!analysis.value && !analysis.identifier ? <p className="subtitle">Aucune colonne numérique ou identifiant n’a été détecté. La mesure de nombre de lignes reste disponible.</p> : null}
    </>
  );
}

export default function PersonalBI({ page = 'overview' }) {
  const state = usePersonalDataset();
  const { dataset, rows, loading, error } = state;
  const columns = dataset?.columns || [];
  const analysis = useMemo(() => inspectDataset(columns, rows), [columns, rows]);

  if (loading || state.rowsLoading) return <DashboardSkeleton />;
  return (
    <div className="page personal-bi-page">
      <DatasetHeader page={page} datasets={state.datasets} selectedId={state.selectedId} selectDataset={state.selectDataset} dataset={dataset} />
      {error ? <div className="alert error" role="alert">{error}</div> : null}
      {!dataset ? <EmptyWorkspace /> : null}
      {dataset ? <DataQualityReport dataset={dataset} columns={columns} rows={rows} onCreateCleanedCopy={async (cleaned) => {
        const name = `${dataset.name} (nettoyé)`.slice(0, 120);
        const sourceName = dataset.fileName.replace(/\.csv$/i, '');
        const created = await createDataset({
          name,
          fileName: `${sourceName}_nettoye.csv`.slice(0, 255),
          columns: cleaned.columns,
          rows: cleaned.rows,
        });
        state.addDataset(created, cleaned.rows);
        return { ...created, ...cleaned };
      }} /> : null}
      {dataset && page === 'overview' ? <PersonalOverview dataset={dataset} rows={rows} columns={columns} analysis={analysis} reports={state.reports} /> : null}
      {dataset && page === 'cancellations' ? <PersonalCancellations columns={columns} rows={rows} analysis={analysis} /> : null}
      {dataset && page === 'orders' ? <PersonalOrders dataset={dataset} columns={columns} rows={rows} /> : null}
      {dataset && page === 'methodology' ? <PersonalMethodology dataset={dataset} rows={rows} columns={columns} analysis={analysis} /> : null}
      {dataset && page === 'dax' ? <PersonalMeasures dataset={dataset} columns={columns} rows={rows} analysis={analysis} /> : null}
    </div>
  );
}
