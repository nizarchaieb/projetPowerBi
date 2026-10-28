import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';
import {
  createDataset, createSavedReport, deleteDataset, deleteSavedReport,
  getDatasetRows, getDatasets, getSavedReports, updateSavedReport,
} from '../api';
import Loader from '../components/Loader';
import Icon from '../components/Icon';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { parseCsvFile, parseCsvFileAsText } from '../workspace/csv';
import { calculateReport, formatReportValue, inspectColumns, suggestReport } from '../workspace/reports';
import { getActiveDatasetId, setActiveDatasetId } from '../workspace/activeDataset';

const EMPTY_REPORT = { title: '', dimension: '', metric: '', aggregation: 'sum', chartType: 'bar' };
const COLORS = ['var(--primary)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)'];

function errorMessage(error, fallback) {
  return error.response?.data?.error || error.message || fallback;
}

function ReportChart({ report, columns, rows }) {
  const data = useMemo(() => calculateReport(report, columns, rows), [report, columns, rows]);
  const numberFormatter = (value) => formatReportValue(value);
  return (
    <section className="workspace-report">
      <div className="workspace-report-heading">
        <div><span className="eyebrow">{report.aggregation === 'count' ? 'ENREGISTREMENTS' : report.aggregation === 'average' ? 'MOYENNE' : 'TOTAL'} · {report.dimension}</span><h3>{report.title}</h3></div>
        <div className="workspace-report-actions">
          <button type="button" className="btn secondary small" onClick={() => report.onEdit(report)}>Modifier</button>
          <button type="button" className="btn danger small" onClick={() => report.onAskDelete(report)}>Supprimer</button>
        </div>
      </div>
      {!data.length ? <p className="workspace-no-data">Aucune valeur exploitable pour cette configuration.</p> : null}
      {data.length && report.chartType === 'table' ? (
        <div className="table-wrap">
          <table className="data-table"><thead><tr><th>{report.dimension}</th><th>{report.aggregation === 'count' ? 'Nombre' : report.metric}</th></tr></thead>
            <tbody>{data.map((item) => <tr key={item.label}><td>{item.label}</td><td>{numberFormatter(item.value)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : null}
      {data.length && report.chartType === 'bar' ? (
        <div className="workspace-chart"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 32 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" stroke="var(--muted)" fontSize={11} angle={-20} textAnchor="end" interval={0} />
            <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={numberFormatter} />
            <Tooltip formatter={numberFormatter} labelStyle={{ color: 'var(--text-on-primary)' }} />
            <Bar dataKey="value" name={report.aggregation === 'count' ? 'Nombre' : report.metric} fill="var(--primary)" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer></div>
      ) : null}
      {data.length && report.chartType === 'line' ? (
        <div className="workspace-chart"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 32 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" stroke="var(--muted)" fontSize={11} angle={-20} textAnchor="end" interval="preserveStartEnd" />
            <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={numberFormatter} />
            <Tooltip formatter={numberFormatter} labelStyle={{ color: 'var(--text-on-primary)' }} />
            <Line type="monotone" dataKey="value" name={report.aggregation === 'count' ? 'Nombre' : report.metric} stroke="var(--primary)" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer></div>
      ) : null}
      {data.length && report.chartType === 'pie' ? (
        <div className="workspace-chart"><ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={data} dataKey="value" nameKey="label" innerRadius={58} outerRadius={108} paddingAngle={2}>
            {data.map((item, index) => <Cell key={item.label} fill={COLORS[index % COLORS.length]} />)}
          </Pie><Tooltip formatter={numberFormatter} /></PieChart>
        </ResponsiveContainer></div>
      ) : null}
      <p className="workspace-report-foot">{report.aggregation === 'count' ? 'Nombre de lignes' : `${report.aggregation === 'average' ? 'Moyenne' : 'Somme'} · ${report.metric}`} · {data.length} groupe{data.length === 1 ? '' : 's'} affiché{data.length === 1 ? '' : 's'}</p>
    </section>
  );
}

export default function Workspace() {
  const fileInput = useRef(null);
  const [datasets, setDatasets] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [rows, setRows] = useState([]);
  const [reports, setReports] = useState([]);
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [draggingFile, setDraggingFile] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [assistantQuery, setAssistantQuery] = useState('');
  const [assistantMessage, setAssistantMessage] = useState('');
  const [reportForm, setReportForm] = useState(EMPTY_REPORT);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const dataset = datasets.find((item) => String(item.id) === String(selectedId));
  const columns = dataset?.columns || [];
  const columnTypes = useMemo(() => inspectColumns(columns, rows), [columns, rows]);

  useEffect(() => {
    getDatasets()
      .then((items) => {
        setDatasets(items);
        const preferred = getActiveDatasetId();
        const activeId = items.some((item) => String(item.id) === preferred)
          ? preferred
          : String(items[0]?.id || '');
        setSelectedId(activeId);
        setActiveDatasetId(activeId);
      })
      .catch((err) => setError(errorMessage(err, 'Impossible de charger vos fichiers.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setRows([]);
      setReports([]);
      return undefined;
    }
    let cancelled = false;
    setRows([]);
    setReports([]);
    setEditingId(null);
    setReportForm(EMPTY_REPORT);
    Promise.all([getDatasetRows(selectedId), getSavedReports(selectedId)])
      .then(([dataRows, savedReports]) => {
        if (!cancelled) {
          setRows(dataRows);
          setReports(savedReports);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Impossible de charger les données sélectionnées.'));
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  async function uploadCsv(event) {
    event.preventDefault();
    const file = selectedFile || fileInput.current?.files?.[0];
    if (!file) {
      setError('Choisissez un fichier CSV avant de continuer.');
      return;
    }
    setUploading(true);
    setError('');
    setNotice('');
    try {
      const parsed = parseCsvFile(file, await parseCsvFileAsText(file));
      const created = await createDataset({
        name: uploadName.trim() || file.name.replace(/\.csv$/i, ''),
        fileName: file.name,
        ...parsed,
      });
      setDatasets((current) => [created, ...current]);
      setSelectedId(String(created.id));
      setActiveDatasetId(created.id);
      setUploadName('');
      setSelectedFile(null);
      setCsvPreview(null);
      event.target.reset();
      setNotice(`Fichier importé : ${created.rowCount.toLocaleString('fr-FR')} lignes et ${created.columns.length} colonnes.`);
    } catch (err) {
      setError(errorMessage(err, 'Échec de l’importation du fichier.'));
    } finally {
      setUploading(false);
    }
  }

  async function selectCsv(file) {
    if (!file) return;
    setSelectedFile(file);
    setCsvPreview(null);
    setError('');
    try {
      const parsed = parseCsvFile(file, await parseCsvFileAsText(file));
      setCsvPreview({ columns: parsed.columns, rows: parsed.rows.length });
    } catch (err) {
      setCsvPreview(null);
      setError(errorMessage(err, 'Impossible de lire ce fichier CSV.'));
    }
  }

  async function removeDataset(item) {
    setError('');
    try {
      await deleteDataset(item.id);
      const remaining = datasets.filter((entry) => entry.id !== item.id);
      setDatasets(remaining);
      if (String(item.id) === String(selectedId)) {
        const nextId = remaining.length ? String(remaining[0].id) : '';
        setSelectedId(nextId);
        setActiveDatasetId(nextId);
      }
      setNotice(`Le jeu de données « ${item.name} » et ses rapports ont été supprimés.`);
    } catch (err) {
      setError(errorMessage(err, 'Impossible de supprimer ce fichier.'));
    }
  }

  function requestReport(event) {
    event.preventDefault();
    const result = suggestReport(assistantQuery, columns, rows);
    if (result.error) {
      setAssistantMessage(result.error);
      return;
    }
    setReportForm(result.report);
    setEditingId(null);
    setAssistantMessage(result.message);
  }

  async function saveReport(event) {
    event.preventDefault();
    if (!dataset) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = { ...reportForm, datasetId: dataset.id };
      if (editingId) {
        await updateSavedReport(editingId, payload);
        setReports((current) => current.map((report) => report.id === editingId ? { ...report, ...payload } : report));
        setNotice('Le rapport a été mis à jour.');
      } else {
        await createSavedReport(payload);
        setReports(await getSavedReports(dataset.id));
        setNotice('Le rapport a été enregistré dans votre espace.');
      }
      setEditingId(null);
      setReportForm(EMPTY_REPORT);
    } catch (err) {
      setError(errorMessage(err, 'Impossible d’enregistrer ce rapport.'));
    } finally {
      setSaving(false);
    }
  }

  function editReport(report) {
    setEditingId(report.id);
    setReportForm({
      title: report.title,
      dimension: report.dimension,
      metric: report.metric || '',
      aggregation: report.aggregation,
      chartType: report.chartType,
    });
    setAssistantMessage('Modifiez les réglages ci-dessous, puis enregistrez le rapport.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removeReport(id) {
    setError('');
    try {
      await deleteSavedReport(id);
      setReports((current) => current.filter((report) => report.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setReportForm(EMPTY_REPORT);
      }
      setNotice('Le rapport a été supprimé.');
    } catch (err) {
      setError(errorMessage(err, 'Impossible de supprimer ce rapport.'));
    }
  }

  if (loading) return <div className="page"><Loader /></div>;

  return (
    <div className="page workspace-page">
      <header className="workspace-hero">
        <div><span className="eyebrow">ESPACE ANALYTIQUE PERSONNEL</span><h1>Vos données, vos indicateurs</h1><p>Importez un fichier CSV, décrivez votre besoin à l’assistant, puis gardez vos rapports personnalisés.</p></div>
        <div className="workspace-privacy"><Icon name="shield" /><div><strong>Espace privé</strong><small>Vos fichiers ne sont visibles que par votre compte.</small></div></div>
      </header>

      {error ? <div className="alert error" role="alert">{error}</div> : null}
      {notice ? <div className="alert success" role="status">{notice}</div> : null}

      <section className="workspace-panel workspace-import">
        <div className="workspace-section-heading"><div><span className="eyebrow">ÉTAPE 1 · IMPORTER</span><h2>Ajouter un fichier de données</h2><p>CSV UTF-8, jusqu’à 5 Mo, 5 000 lignes et 100 colonnes. Les en-têtes sont détectés automatiquement.</p></div></div>
        <form className="workspace-upload-form" onSubmit={uploadCsv}>
          <div className="form-field"><label htmlFor="workspace-name">Nom de ce jeu de données</label><input id="workspace-name" value={uploadName} onChange={(event) => setUploadName(event.target.value)} maxLength={120} placeholder="Ex. : Ventes du premier trimestre" /></div>
          <div className={`workspace-dropzone${draggingFile ? ' is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDraggingFile(true); }} onDragLeave={() => setDraggingFile(false)} onDrop={(event) => { event.preventDefault(); setDraggingFile(false); selectCsv(event.dataTransfer.files?.[0]); }}>
            <span className="dropzone-icon"><Icon name="upload" size={22} /></span><strong>Glissez votre fichier CSV ici</strong><span>ou</span><label className="btn secondary small" htmlFor="workspace-file">Parcourir les fichiers</label>
            <input ref={fileInput} id="workspace-file" className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => selectCsv(event.target.files?.[0])} aria-label="Choisir un fichier CSV" />
            <small>CSV UTF-8 · 5 Mo maximum · 5 000 lignes maximum</small>
            {selectedFile ? <p className="dropzone-selected" role="status">Sélectionné : <strong>{selectedFile.name}</strong></p> : null}
          </div>
          {csvPreview ? <div className="csv-preview"><div><strong>Aperçu détecté</strong><span>{csvPreview.rows.toLocaleString('fr-FR')} lignes · {csvPreview.columns.length} colonnes</span></div><div className="csv-preview-columns">{csvPreview.columns.slice(0, 8).map((column) => <span className="status-pill" key={column}>{column}</span>)}{csvPreview.columns.length > 8 ? <span className="status-pill">+{csvPreview.columns.length - 8}</span> : null}</div></div> : null}
          {uploading ? <div className="upload-progress" role="progressbar" aria-label="Import du fichier en cours"><span /></div> : null}
          <button type="submit" className="btn" disabled={uploading || !selectedFile}>{uploading ? 'Import en cours…' : 'Importer le CSV'}</button>
        </form>
        <p className="workspace-format-note">Les fichiers sont conservés dans votre espace. L’assistant de configuration s’exécute dans votre navigateur ; aucun service d’IA externe n’est utilisé.</p>
      </section>

      {datasets.length ? (
        <>
          <section className="workspace-panel workspace-datasets">
            <div className="workspace-section-heading"><div><span className="eyebrow">VOS FICHIERS</span><h2>Jeux de données</h2></div><span className="admin-count">{datasets.length} fichier{datasets.length === 1 ? '' : 's'}</span></div>
            <div className="workspace-dataset-list">
              {datasets.map((item) => (
                <article className={`workspace-dataset${String(item.id) === String(selectedId) ? ' selected' : ''}`} key={item.id}>
                  <button type="button" className="workspace-dataset-select" onClick={() => { setSelectedId(String(item.id)); setActiveDatasetId(item.id); setError(''); setNotice(''); }}>
                    <span className="workspace-dataset-icon"><Icon name="orders" /></span><span className="workspace-dataset-copy"><strong>{item.name}</strong><small>{item.fileName} · {item.rowCount.toLocaleString('fr-FR')} lignes · {item.columns.length} colonnes</small></span>
                  </button>
                  <button type="button" className="btn danger small" onClick={() => setConfirmation({ title: 'Supprimer ce jeu de données ?', message: `« ${item.name} » et tous ses rapports enregistrés seront supprimés. Cette action est irréversible.`, onConfirm: () => removeDataset(item) })} aria-label={`Supprimer ${item.name}`}>Supprimer</button>
                </article>
              ))}
            </div>
          </section>

          {dataset ? (
            <>
              <section className="workspace-summary">
                <div><span>LIGNES</span><strong>{dataset.rowCount.toLocaleString('fr-FR')}</strong></div>
                <div><span>COLONNES</span><strong>{columns.length.toLocaleString('fr-FR')}</strong></div>
                <div><span>CHAMPS NUMÉRIQUES</span><strong>{columnTypes.numeric.length.toLocaleString('fr-FR')}</strong></div>
                <div><span>RAPPORTS ENREGISTRÉS</span><strong>{reports.length.toLocaleString('fr-FR')}</strong></div>
              </section>
              <div className="personal-bi-next"><Link className="btn" to="/bi">Ouvrir le tableau de bord de ce fichier</Link></div>

              <section className="workspace-panel workspace-assistant">
                <div className="workspace-section-heading"><div><span className="eyebrow">ÉTAPE 2 · CONFIGURER</span><h2>Décrivez la statistique souhaitée</h2><p>Demandez par exemple « chiffre d’affaires par région en barres » ou « moyenne des quantités par produit ».</p></div><span className="assistant-mark"><Icon name="sparkle" /></span></div>
                <form className="workspace-chat-form" onSubmit={requestReport}>
                  <label className="sr-only" htmlFor="workspace-query">Décrivez le rapport souhaité</label>
                  <input id="workspace-query" value={assistantQuery} onChange={(event) => setAssistantQuery(event.target.value)} placeholder="Ex. : somme de montant par région en graphique en barres" />
                  <button className="btn" type="submit" disabled={!assistantQuery.trim()}>Préparer le rapport</button>
                </form>
                <p className="workspace-assistant-message" role="status">{assistantMessage || `Colonnes disponibles : ${columns.slice(0, 8).join(', ')}${columns.length > 8 ? ', …' : ''}`}</p>
                <form className="workspace-report-form" onSubmit={saveReport}>
                  <div className="workspace-form-grid">
                    <div className="form-field"><label htmlFor="report-title">Titre du rapport</label><input id="report-title" value={reportForm.title} maxLength={120} onChange={(event) => setReportForm({ ...reportForm, title: event.target.value })} required /></div>
                    <div className="form-field"><label htmlFor="report-dimension">Regrouper par</label><select id="report-dimension" value={reportForm.dimension} onChange={(event) => setReportForm({ ...reportForm, dimension: event.target.value })} required><option value="" disabled>Choisir une colonne</option>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></div>
                    <div className="form-field"><label htmlFor="report-aggregation">Calcul</label><select id="report-aggregation" value={reportForm.aggregation} onChange={(event) => setReportForm({ ...reportForm, aggregation: event.target.value })}><option value="sum">Somme</option><option value="average">Moyenne</option><option value="count">Nombre de lignes</option></select></div>
                    <div className="form-field"><label htmlFor="report-metric">Valeur à calculer</label><select id="report-metric" value={reportForm.metric} onChange={(event) => setReportForm({ ...reportForm, metric: event.target.value })} disabled={reportForm.aggregation === 'count'} required={reportForm.aggregation !== 'count'}><option value="">Choisir une colonne numérique</option>{columnTypes.numeric.map((column) => <option key={column} value={column}>{column}</option>)}</select></div>
                    <div className="form-field"><label htmlFor="report-chart">Visualisation</label><select id="report-chart" value={reportForm.chartType} onChange={(event) => setReportForm({ ...reportForm, chartType: event.target.value })}><option value="bar">Barres</option><option value="line">Courbe</option><option value="pie">Répartition</option><option value="table">Tableau</option></select></div>
                  </div>
                  <div className="admin-form-actions"><button type="submit" className="btn" disabled={saving || !columns.length}>{saving ? 'Enregistrement…' : editingId ? 'Enregistrer les modifications' : 'Enregistrer ce rapport'}</button>{editingId ? <button type="button" className="btn secondary" onClick={() => { setEditingId(null); setReportForm(EMPTY_REPORT); }}>Annuler</button> : null}</div>
                </form>
              </section>

              <section className="workspace-saved">
                <div className="workspace-section-heading"><div><span className="eyebrow">ÉTAPE 3 · CONSULTER</span><h2>Vos rapports</h2><p>Les changements faits à la configuration sont enregistrés pour le fichier sélectionné.</p></div></div>
                {reports.length ? <div className="workspace-report-grid">{reports.map((report) => <ReportChart key={report.id} report={{ ...report, onEdit: editReport, onAskDelete: (item) => setConfirmation({ title: 'Supprimer ce rapport ?', message: `Le rapport « ${item.title} » sera supprimé définitivement.`, onConfirm: () => removeReport(item.id) }) }} columns={columns} rows={rows} />)}</div> : <div className="workspace-empty"><span><Icon name="dashboard" /></span><h3>Pas encore de rapport enregistré</h3><p>Décrivez une statistique ci-dessus, vérifiez sa configuration, puis enregistrez-la.</p></div>}
              </section>
            </>
          ) : null}
        </>
      ) : (
        <EmptyState title="Votre espace est prêt" description="Importez votre premier fichier CSV pour créer un tableau de bord adapté à vos propres données." />
      )}
      <ConfirmDialog open={!!confirmation} title={confirmation?.title} message={confirmation?.message} danger confirmLabel="Supprimer" onConfirm={confirmation?.onConfirm || (() => {})} onCancel={() => setConfirmation(null)} />
    </div>
  );
}
