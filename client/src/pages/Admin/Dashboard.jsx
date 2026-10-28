import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInsights, createInsight, updateInsight, deleteInsight, getMessages, markMessageRead, deleteMessage, getUsers, updateUserApproval, resetUserPassword, getAuditLogs, getKpis, getAdminMeasures, previewMeasure, createMeasure, updateMeasure, fmtNumber, fmtPct, setToken } from '../../api';
import Loader from '../../components/Loader';
import Icon from '../../components/Icon';
import ConfirmDialog from '../../components/ConfirmDialog';

const EMPTY = { page: 'ventes', title: '', text: '', sort_order: 0 };
const EMPTY_MEASURE = { titre: '', formule: 'sum', colonne: 'prix_total', group_by: 'region', type_graphique: 'bar', ordre: 0, visible: false };

export default function Dashboard() {
  const [insights, setInsights] = useState([]);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [measures, setMeasures] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [measureForm, setMeasureForm] = useState(EMPTY_MEASURE);
  const [measureEditingId, setMeasureEditingId] = useState(null);
  const [measurePreview, setMeasurePreview] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const [busyUserId, setBusyUserId] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      const [insV, insA, msgs, userList, salesKpis, measureList, auditList] = await Promise.all([
        getInsights('ventes'),
        getInsights('annulations'),
        getMessages(),
        getUsers(),
        getKpis(),
        getAdminMeasures().catch(() => []),
        getAuditLogs().catch(() => []),
      ]);
      setInsights([...insV, ...insA]);
      setMessages(msgs);
      setUsers(userList);
      setKpis(salesKpis);
      setMeasures(measureList);
      setAuditLogs(auditList);
      setError('');
    } catch (e) {
      if (e.response && e.response.status === 401) {
        setToken(null);
        navigate('/admin/login');
      } else {
        setError('Impossible de charger le panneau. Vérifiez que l’API est démarrée.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function saveInsight(e) {
    e.preventDefault();
    setNotice('');
    try {
      if (editingId) await updateInsight(editingId, form);
      else await createInsight(form);
      setForm(EMPTY);
      setEditingId(null);
      setNotice('Insight enregistré.');
      reload();
    } catch (err) {
      setNotice((err.response && err.response.data && err.response.data.error) || 'Échec de l’enregistrement.');
    }
  }

  async function previewCustomMeasure() {
    setError('');
    try {
      setMeasurePreview(await previewMeasure(measureForm));
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.error) || 'Impossible de prévisualiser cette mesure.');
    }
  }

  async function saveCustomMeasure(e) {
    e.preventDefault();
    setNotice('');
    try {
      if (measureEditingId) await updateMeasure(measureEditingId, measureForm);
      else await createMeasure(measureForm);
      setMeasureForm(EMPTY_MEASURE);
      setMeasureEditingId(null);
      setMeasurePreview(null);
      setNotice('Mesure enregistrée.');
      await reload();
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.error) || 'Échec de l’enregistrement de la mesure.');
    }
  }

  function editCustomMeasure(measure) {
    setMeasureEditingId(measure.id);
    setMeasureForm({
      titre: measure.titre, formule: measure.formule, colonne: measure.colonne,
      group_by: measure.group_by || '', type_graphique: measure.type_graphique,
      ordre: measure.ordre, visible: measure.visible,
    });
    setMeasurePreview(measure);
  }

  async function toggleMeasure(measure) {
    try {
      await updateMeasure(measure.id, {
        titre: measure.titre, formule: measure.formule, colonne: measure.colonne,
        group_by: measure.group_by, type_graphique: measure.type_graphique,
        ordre: measure.ordre, visible: !measure.visible,
      });
      await reload();
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.error) || 'Impossible de modifier la publication.');
    }
  }

  async function removeInsight(id) {
    try {
      await deleteInsight(id);
      setNotice('Analyse supprimée.');
      await reload();
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.error) || 'Impossible de supprimer cette analyse.');
    }
  }

  function editInsight(ins) {
    setEditingId(ins.id);
    setForm({ page: ins.page, title: ins.title, text: ins.text, sort_order: ins.sort_order || 0 });
  }

  async function markRead(id) {
    try {
      await markMessageRead(id);
      await reload();
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.error) || 'Impossible de mettre à jour ce message.');
    }
  }

  async function removeMessage(id) {
    try {
      await deleteMessage(id);
      setNotice('Message supprimé.');
      await reload();
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.error) || 'Impossible de supprimer ce message.');
    }
  }

  async function changeApproval(user, approved) {
    setNotice('');
    setBusyUserId(user.id);
    try {
      await updateUserApproval(user.id, approved);
      setNotice(approved ? `Le compte de ${user.name} est maintenant actif.` : `L’accès de ${user.name} a été suspendu.`);
      await reload();
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.error) || 'Impossible de modifier les accès.');
    } finally {
      setBusyUserId(null);
    }
  }

  async function resetPassword(user) {
    setError(''); setTemporaryPassword(null);
    try {
      const result = await resetUserPassword(user.id);
      setTemporaryPassword({ name: user.name, value: result.temporaryPassword });
      await reload();
    } catch (err) {
      setError(err.response?.data?.error || 'Impossible de réinitialiser ce mot de passe.');
    }
  }

  if (loading) return <div className="page"><Loader /></div>;

  const unread = messages.filter((m) => !m.is_read).length;
  const pendingUsers = users.filter((user) => !user.is_approved);
  const sections = [
    { id: 'overview', label: 'Vue d’ensemble', icon: 'dashboard' },
    { id: 'users', label: 'Utilisateurs', icon: 'users', count: pendingUsers.length },
    { id: 'content', label: 'Contenu', icon: 'orders' },
    { id: 'measures', label: 'Mesures', icon: 'chart', count: measures.filter((measure) => measure.visible).length },
    { id: 'audit', label: 'Journal', icon: 'history' },
    { id: 'messages', label: 'Messages', icon: 'messages', count: unread },
  ];
  const activeLabel = sections.find((section) => section.id === activeSection).label;

  return (
    <div className="page admin-page">
      <div className="admin-heading">
        <div className="admin-heading-copy">
          <span className="eyebrow">VENTEPILOT · ESPACE DE GESTION</span>
          <h1>Bonjour, Administrateur</h1>
          <p className="subtitle">Pilotez les accès, le contenu et l’activité de votre plateforme.</p>
        </div>
        <div className="admin-heading-meta"><span className="admin-secure"><i /> Administration sécurisée</span><span className="admin-date">{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date())}</span></div>
      </div>
      {error ? <div className="alert error" role="alert">{error}</div> : null}
      {notice ? <div className="alert success" role="status">{notice}</div> : null}
      {temporaryPassword ? <div className="alert success" role="status"><strong>Mot de passe temporaire pour {temporaryPassword.name} :</strong> <code>{temporaryPassword.value}</code><p>Copiez-le et transmettez-le à l’utilisateur par un canal privé. Il doit ensuite choisir un nouveau mot de passe depuis son profil.</p><button type="button" className="btn secondary small" onClick={() => setTemporaryPassword(null)}>Masquer</button></div> : null}

      <div className="admin-layout">
        <aside className="admin-sidebar" aria-label="Navigation de l’administration">
          <span className="admin-sidebar-label">ESPACE ADMIN</span>
          {sections.map((section) => (
            <button
              type="button"
              key={section.id}
              className={`admin-nav-item${activeSection === section.id ? ' active' : ''}`}
              onClick={() => setActiveSection(section.id)}
              aria-current={activeSection === section.id ? 'page' : undefined}
            >
              <span className="admin-nav-icon"><Icon name={section.icon} /></span>
              <span>{section.label}</span>
              {section.count > 0 ? <span className="admin-nav-count">{section.count}</span> : null}
            </button>
          ))}
          <div className="admin-sidebar-note"><span className="admin-status-dot" /> Votre espace est opérationnel</div>
        </aside>

        <div className="admin-content">
          <div className="admin-view-heading">
            <div><span className="eyebrow">TABLEAU DE BORD</span><h2>{activeLabel}</h2></div>
            {activeSection === 'overview' ? <button type="button" className="btn secondary admin-refresh" onClick={reload}>Actualiser les données</button> : null}
          </div>

          {activeSection === 'overview' ? (
            <>
              <div className="admin-stats-grid">
                <div className="admin-stat-card"><span className="admin-stat-icon teal-icon"><Icon name="chart" /></span><span className="admin-stat-label">Chiffre d’affaires</span><strong>{kpis ? fmtNumber(kpis.caTotal) : '—'}</strong><small>Montant cumulé des ventes</small></div>
                <div className="admin-stat-card"><span className="admin-stat-icon blue-icon"><Icon name="orders" /></span><span className="admin-stat-label">Commandes</span><strong>{kpis ? fmtNumber(kpis.nbCommandes) : '—'}</strong><small>Commandes distinctes</small></div>
                <button type="button" className="admin-stat-card stat-action" onClick={() => setActiveSection('users')}><span className="admin-stat-icon orange-icon"><Icon name="users" /></span><span className="admin-stat-label">À approuver</span><strong>{pendingUsers.length}</strong><small>Demandes d’accès en attente <span>→</span></small></button>
                <button type="button" className="admin-stat-card stat-action" onClick={() => setActiveSection('messages')}><span className="admin-stat-icon purple-icon"><Icon name="messages" /></span><span className="admin-stat-label">Messages non lus</span><strong>{unread}</strong><small>{messages.length} message{messages.length === 1 ? '' : 's'} au total <span>→</span></small></button>
              </div>
              <div className="admin-overview-grid">
                <section className="admin-panel">
                  <div className="admin-panel-heading"><div><span className="eyebrow">ACCÈS UTILISATEURS</span><h3>Demandes récentes</h3></div><button type="button" className="admin-text-button" onClick={() => setActiveSection('users')}>Voir tous les comptes →</button></div>
                  {pendingUsers.length ? (
                    <div className="admin-request-list">{pendingUsers.slice(0, 4).map((user) => (
                      <div className="admin-request-row" key={user.id}>
                        <span className="user-avatar">{user.name.trim().charAt(0).toLocaleUpperCase('fr-FR')}</span>
                        <span className="admin-request-user"><strong>{user.name}</strong><small>{user.email}</small></span>
                        <span className="status-pill pending">En attente</span>
                        <button type="button" className="btn small" disabled={busyUserId === user.id} onClick={() => changeApproval(user, true)}>{busyUserId === user.id ? '…' : 'Approuver'}</button>
                      </div>
                    ))}</div>
                  ) : <div className="admin-empty">Tout est à jour. Aucune demande d’accès en attente.</div>}
                </section>
                <section className="admin-panel admin-quick-panel">
                  <span className="eyebrow">RACCOURCIS</span><h3>Gérer la plateforme</h3>
                  <button type="button" className="admin-quick-link" onClick={() => setActiveSection('users')}><span className="quick-link-icon"><Icon name="users" /></span><span><strong>Utilisateurs</strong><small>Valider et gérer les accès</small></span><b>→</b></button>
                  <button type="button" className="admin-quick-link" onClick={() => setActiveSection('content')}><span className="quick-link-icon"><Icon name="orders" /></span><span><strong>Contenu</strong><small>Mettre à jour les analyses</small></span><b>→</b></button>
                  <button type="button" className="admin-quick-link" onClick={() => setActiveSection('measures')}><span className="quick-link-icon"><Icon name="chart" /></span><span><strong>Mesures</strong><small>Créer et publier des indicateurs</small></span><b>→</b></button>
                  <button type="button" className="admin-quick-link" onClick={() => setActiveSection('messages')}><span className="quick-link-icon"><Icon name="messages" /></span><span><strong>Messages</strong><small>Consulter les demandes reçues</small></span><b>→</b></button>
                </section>
              </div>
              <div className="admin-overview-footer"><span><strong>{insights.length}</strong> analyses publiées</span><span><strong>{users.filter((user) => user.is_approved).length}</strong> comptes actifs</span><span><strong>{fmtNumber(kpis ? kpis.nbLignes : 0)}</strong> lignes analysées</span></div>
            </>
          ) : null}

          {activeSection === 'users' ? (
            <section className="admin-panel">
              <div className="admin-panel-heading"><div><span className="eyebrow">CONTRÔLE DES ACCÈS</span><h3>Comptes utilisateurs</h3><p>Approuvez les demandes ou suspendez un accès existant.</p></div><span className="admin-count">{users.length} compte{users.length === 1 ? '' : 's'}</span></div>
              {users.length ? (
                <div className="table-wrap admin-table-wrap"><table className="data-table admin-table">
                  <thead><tr><th>Utilisateur</th><th>Adresse email</th><th>Statut</th><th>Action</th></tr></thead>
                  <tbody>{users.map((user) => (
                    <tr key={user.id}>
                      <td><span className="admin-table-user"><span className="user-avatar">{user.name.trim().charAt(0).toLocaleUpperCase('fr-FR')}</span><strong>{user.name}</strong></span></td>
                      <td>{user.email}</td>
                      <td><span className={`status-pill ${user.is_approved ? 'approved' : 'pending'}`}>{user.is_approved ? 'Actif' : 'En attente'}</span></td>
                      <td className="admin-item-actions">{user.is_approved
                        ? <button type="button" className="btn danger small" disabled={busyUserId === user.id} onClick={() => changeApproval(user, false)}>{busyUserId === user.id ? '…' : 'Suspendre'}</button>
                        : <button type="button" className="btn small" disabled={busyUserId === user.id} onClick={() => changeApproval(user, true)}>{busyUserId === user.id ? '…' : 'Approuver'}</button>}<button type="button" className="btn secondary small" onClick={() => setConfirmation({ title: 'Réinitialiser le mot de passe ?', message: `Un mot de passe temporaire sera créé pour ${user.name} et affiché une seule fois.`, confirmLabel: 'Réinitialiser', onConfirm: () => resetPassword(user) })}>Réinitialiser le mot de passe</button></td>
                    </tr>
                  ))}</tbody>
                </table></div>
              ) : <div className="admin-empty">Aucun compte utilisateur pour le moment.</div>}
            </section>
          ) : null}

          {activeSection === 'content' ? (
            <>
              <section className="admin-panel admin-editor">
                <div className="admin-panel-heading"><div><span className="eyebrow">CONTENU ÉDITORIAL</span><h3>{editingId ? 'Modifier l’analyse' : 'Publier une analyse'}</h3><p>Les analyses sont affichées sur les pages des tableaux de bord clients.</p></div></div>
                <form onSubmit={saveInsight} className="admin-insight-form">
                  <div className="admin-row">
                    <div className="form-field"><label htmlFor="ins-page">Page de publication</label><select id="ins-page" value={form.page} onChange={(e) => setForm({ ...form, page: e.target.value })}><option value="ventes">Suivi des ventes</option><option value="annulations">Analyse des annulations</option></select></div>
                    <div className="form-field"><label htmlFor="ins-order">Ordre d’affichage</label><input id="ins-order" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
                  </div>
                  <div className="form-field"><label htmlFor="ins-title">Titre</label><input id="ins-title" type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={255} placeholder="Ex. : Une progression régulière des ventes" /></div>
                  <div className="form-field"><label htmlFor="ins-text">Analyse</label><textarea id="ins-text" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} required placeholder="Rédigez une courte analyse à destination des utilisateurs." /></div>
                  <div className="admin-form-actions"><button type="submit" className="btn">{editingId ? 'Enregistrer les modifications' : 'Publier l’analyse'}</button>{editingId ? <button type="button" className="btn secondary" onClick={() => { setEditingId(null); setForm(EMPTY); }}>Annuler</button> : null}</div>
                </form>
              </section>
              <section className="admin-panel admin-published">
                <div className="admin-panel-heading"><div><span className="eyebrow">PUBLICATIONS</span><h3>Analyses publiées</h3></div><span className="admin-count">{insights.length} élément{insights.length === 1 ? '' : 's'}</span></div>
                {insights.map((ins) => <article className="admin-insight-item" key={ins.id}><div><span className="status-pill content-tag">{ins.page === 'ventes' ? 'Ventes' : 'Annulations'}</span><span className="admin-insight-order">Ordre {ins.sort_order}</span><h4>{ins.title}</h4><p>{ins.text}</p></div><div className="admin-item-actions"><button type="button" className="btn secondary small" onClick={() => editInsight(ins)}>Modifier</button><button type="button" className="btn danger small" onClick={() => setConfirmation({ title: 'Supprimer cette analyse ?', message: `« ${ins.title} » sera retirée du dashboard.`, confirmLabel: 'Supprimer', onConfirm: () => removeInsight(ins.id) })}>Supprimer</button></div></article>)}
                {insights.length === 0 ? <div className="admin-empty">Aucune analyse publiée.</div> : null}
              </section>
            </>
          ) : null}

          {activeSection === 'measures' ? (
            <>
              <section className="admin-panel admin-editor">
                <div className="admin-panel-heading"><div><span className="eyebrow">CONSTRUCTEUR D’INDICATEURS</span><h3>{measureEditingId ? 'Modifier la mesure' : 'Créer une mesure'}</h3><p>Les calculs sont exécutés sur les données de démonstration avec des formules et colonnes autorisées.</p></div></div>
                <form onSubmit={saveCustomMeasure} className="admin-insight-form">
                  <div className="form-field"><label htmlFor="measure-title">Titre</label><input id="measure-title" value={measureForm.titre} maxLength={120} required onChange={(e) => { setMeasureForm({ ...measureForm, titre: e.target.value }); setMeasurePreview(null); }} placeholder="Ex. : Montant moyen par région" /></div>
                  <div className="admin-row">
                    <div className="form-field"><label htmlFor="measure-formula">Formule</label><select id="measure-formula" value={measureForm.formule} onChange={(e) => { const formula = e.target.value; setMeasureForm({ ...measureForm, formule: formula, colonne: formula === 'taux_annulation' ? 'id_commande' : measureForm.colonne }); setMeasurePreview(null); }}><option value="sum">Somme</option><option value="average">Moyenne</option><option value="count">Nombre de lignes</option><option value="ratio">Part du total par groupe</option><option value="taux_annulation">Taux d’annulation</option></select></div>
                    <div className="form-field"><label htmlFor="measure-column">Colonne</label><select id="measure-column" value={measureForm.colonne} disabled={measureForm.formule === 'taux_annulation'} onChange={(e) => { setMeasureForm({ ...measureForm, colonne: e.target.value }); setMeasurePreview(null); }}><option value="prix_total">Montant total (inclut les annulations)</option><option value="prix_unitaire">Prix unitaire</option><option value="quantite">Quantité</option><option value="id_commande">Commande</option></select></div>
                  </div>
                  <div className="admin-row">
                    <div className="form-field"><label htmlFor="measure-group">Regrouper par</label><select id="measure-group" value={measureForm.group_by} onChange={(e) => { setMeasureForm({ ...measureForm, group_by: e.target.value }); setMeasurePreview(null); }}><option value="">Total général</option><option value="region">Région</option><option value="produit">Produit</option><option value="client">Client</option><option value="mois">Mois</option></select></div>
                    <div className="form-field"><label htmlFor="measure-chart">Type de graphique</label><select id="measure-chart" value={measureForm.type_graphique} onChange={(e) => setMeasureForm({ ...measureForm, type_graphique: e.target.value })}><option value="bar">Barres</option><option value="line">Courbe</option><option value="pie">Répartition</option><option value="table">Tableau</option></select></div>
                    <div className="form-field"><label htmlFor="measure-order">Ordre d’affichage</label><input id="measure-order" type="number" min="0" max="10000" value={measureForm.ordre} onChange={(e) => setMeasureForm({ ...measureForm, ordre: Number(e.target.value) })} /></div>
                  </div>
                  <label className="checkbox-field"><input type="checkbox" checked={measureForm.visible} onChange={(e) => setMeasureForm({ ...measureForm, visible: e.target.checked })} /> Publier sur le tableau de bord</label>
                  <div className="admin-form-actions"><button type="button" className="btn secondary" onClick={previewCustomMeasure}>Prévisualiser</button><button type="submit" className="btn">{measureEditingId ? 'Enregistrer la mesure' : 'Créer la mesure'}</button>{measureEditingId ? <button type="button" className="btn secondary" onClick={() => { setMeasureEditingId(null); setMeasureForm(EMPTY_MEASURE); setMeasurePreview(null); }}>Annuler</button> : null}</div>
                </form>
                {measurePreview ? <div className="table-wrap admin-table-wrap"><p><strong>Aperçu :</strong> {measurePreview.formule_label}{measurePreview.colonne_label ? ` de ${measurePreview.colonne_label}` : ''}{measurePreview.group_by ? ` par ${measurePreview.group_by}` : ''}</p><table className="data-table admin-table"><thead><tr><th>Groupe</th><th>Valeur calculée</th></tr></thead><tbody>{measurePreview.data.map((row) => <tr key={row.label}><td>{row.label}</td><td>{['ratio', 'taux_annulation'].includes(measurePreview.formule) ? fmtPct(row.value) : fmtNumber(row.value)}</td></tr>)}</tbody></table></div> : null}
              </section>
              <section className="admin-panel admin-published">
                <div className="admin-panel-heading"><div><span className="eyebrow">MESURES DISPONIBLES</span><h3>Ordre et publication</h3><p>Les mesures visibles sont affichées sur le dashboard des ventes, selon les filtres actifs.</p></div><span className="admin-count">{measures.length}</span></div>
                {measures.map((measure) => <article className="admin-insight-item" key={measure.id}><div><span className={`status-pill ${measure.visible ? 'approved' : 'pending'}`}>{measure.visible ? 'Publiée' : 'Masquée'}</span><span className="admin-insight-order">Ordre {measure.ordre}</span><h4>{measure.titre}</h4><p>{measure.formule_label}{measure.colonne_label ? ` de ${measure.colonne_label}` : ''}{measure.group_by ? ` par ${measure.group_by}` : ''}</p><p>{measure.data.slice(0, 4).map((row) => `${row.label} : ${['ratio', 'taux_annulation'].includes(measure.formule) ? fmtPct(row.value) : fmtNumber(row.value)}`).join(' · ')}</p></div><div className="admin-item-actions"><button type="button" className="btn secondary small" onClick={() => editCustomMeasure(measure)}>Modifier / ordre</button><button type="button" className={`btn ${measure.visible ? 'danger' : ''} small`} onClick={() => toggleMeasure(measure)}>{measure.visible ? 'Masquer' : 'Publier'}</button></div></article>)}
                {!measures.length ? <div className="admin-empty">Aucune mesure créée.</div> : null}
              </section>
            </>
          ) : null}

          {activeSection === 'audit' ? (
            <section className="admin-panel">
              <div className="admin-panel-heading"><div><span className="eyebrow">SÉCURITÉ ET TRAÇABILITÉ</span><h3>Journal d’administration</h3><p>Les 200 dernières actions sensibles.</p></div><span className="admin-count">{auditLogs.length}</span></div>
              {auditLogs.length ? <div className="table-wrap admin-table-wrap"><table className="data-table admin-table"><thead><tr><th>Date</th><th>Administrateur</th><th>Action</th><th>Cible</th></tr></thead><tbody>{auditLogs.map((entry) => <tr key={entry.id}><td>{new Date(entry.created_at).toLocaleString('fr-FR')}</td><td>{entry.admin_name || 'Compte supprimé'}</td><td>{entry.action}</td><td>{entry.target_type}{entry.target_id ? ` · ${entry.target_id}` : ''}</td></tr>)}</tbody></table></div> : <div className="admin-empty">Aucune action enregistrée.</div>}
            </section>
          ) : null}

          {activeSection === 'messages' ? (
            <section className="admin-panel">
              <div className="admin-panel-heading"><div><span className="eyebrow">BOÎTE DE RÉCEPTION</span><h3>Messages reçus</h3><p>Consultez les messages envoyés depuis le formulaire de contact.</p></div><span className="admin-count">{unread} non lu{unread === 1 ? '' : 's'}</span></div>
              {messages.map((message) => (
                <article className={`admin-message${message.is_read ? '' : ' unread'}`} key={message.id}>
                  <div className="admin-message-top"><div><span className="admin-message-subject">{message.subject || '(Sans sujet)'}</span><span className="admin-message-status">{message.is_read ? 'Lu' : 'Nouveau'}</span></div><time>{new Date(message.created_at).toLocaleString('fr-FR')}</time></div>
                  <div className="admin-message-sender">{message.name} · <a href={`mailto:${message.email}`}>{message.email}</a></div>
                  <p>{message.message}</p>
                  <div className="admin-item-actions">{!message.is_read ? <button type="button" className="btn secondary small" onClick={() => markRead(message.id)}>Marquer comme lu</button> : null}<button type="button" className="btn danger small" onClick={() => setConfirmation({ title: 'Supprimer ce message ?', message: `Le message de ${message.name} sera supprimé définitivement.`, confirmLabel: 'Supprimer', onConfirm: () => removeMessage(message.id) })}>Supprimer</button></div>
                </article>
              ))}
              {messages.length === 0 ? <div className="admin-empty">Votre boîte de réception est vide.</div> : null}
            </section>
          ) : null}
        </div>
      </div>
      <ConfirmDialog open={!!confirmation} title={confirmation?.title} message={confirmation?.message} danger={confirmation?.confirmLabel !== 'Réinitialiser'} confirmLabel={confirmation?.confirmLabel} onConfirm={confirmation?.onConfirm || (() => {})} onCancel={() => setConfirmation(null)} />
    </div>
  );
}
