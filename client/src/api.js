import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

export function getToken() {
  return localStorage.getItem('ventesdb_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('ventesdb_token', token);
  else {
    localStorage.removeItem('ventesdb_token');
    localStorage.removeItem('ventesdb_user');
  }
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('ventesdb_user') || 'null');
  } catch {
    return null;
  }
}

export function setSession({ token, user }) {
  setToken(token);
  localStorage.setItem('ventesdb_user', JSON.stringify(user));
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const expired = error.response && error.response.status === 401;
    const pending = error.response && error.response.data && error.response.data.code === 'ACCOUNT_PENDING';
    if (getToken() && (expired || pending)) {
      setToken(null);
      window.dispatchEvent(new Event('ventesdb:session-invalid'));
    }
    return Promise.reject(error);
  }
);

export const register = (data) => api.post('/auth/register', data).then((r) => r.data);
export const getUsers = () => api.get('/users').then((r) => r.data);
export const updateUserApproval = (id, approved) => api.patch(`/users/${id}/approval`, { approved }).then((r) => r.data);
export const resetUserPassword = (id) => api.post(`/users/${id}/password-reset`).then((r) => r.data);
export const getAuditLogs = () => api.get('/audit-logs').then((r) => r.data);
export const getKpis = (params) => api.get('/kpis', { params }).then((r) => r.data);
export const getMensuel = (params) => api.get('/ventes/mensuel', { params }).then((r) => r.data);
export const getParRegion = (params) => api.get('/ventes/par-region', { params }).then((r) => r.data);
export const getParProduit = (params) => api.get('/ventes/par-produit', { params }).then((r) => r.data);
export const getParClient = (params) => api.get('/ventes/par-client', { params }).then((r) => r.data);
export const getParStatut = (params) => api.get('/ventes/par-statut', { params }).then((r) => r.data);
export const getAnnulationsParRegion = (params) => api.get('/annulations/par-region', { params }).then((r) => r.data);
export const getAnnulationsParProduit = (params) => api.get('/annulations/par-produit', { params }).then((r) => r.data);
export const getAnnulationsParClient = (params) => api.get('/annulations/par-client', { params }).then((r) => r.data);
export const getAnnulationsMensuel = (params) => api.get('/annulations/mensuel', { params }).then((r) => r.data);
export const getAnnulationsParCategorie = (params) => api.get('/annulations/par-categorie', { params }).then((r) => r.data);
export const getCommandes = (params) => api.get('/commandes', { params }).then((r) => r.data);
export const getFiltres = () => api.get('/filtres').then((r) => r.data);
export const getInsights = (page) => api.get('/insights', { params: { page } }).then((r) => r.data);
export const createInsight = (data) => api.post('/insights', data).then((r) => r.data);
export const updateInsight = (id, data) => api.put(`/insights/${id}`, data).then((r) => r.data);
export const deleteInsight = (id) => api.delete(`/insights/${id}`).then((r) => r.data);
export const login = (email, password) => api.post('/auth/login', { email, password }).then((r) => r.data);
export const changePassword = (data) => api.post('/auth/change-password', data).then((r) => r.data);
export const sendMessage = (data) => api.post('/messages', data).then((r) => r.data);
export const getMessages = () => api.get('/messages').then((r) => r.data);
export const markMessageRead = (id) => api.patch(`/messages/${id}/read`).then((r) => r.data);
export const deleteMessage = (id) => api.delete(`/messages/${id}`).then((r) => r.data);
export const getDatasets = () => api.get('/workspace/datasets').then((r) => r.data);
export const createDataset = (data) => api.post('/workspace/datasets', data).then((r) => r.data);
export const getDatasetRows = (id) => api.get(`/workspace/datasets/${id}/rows`).then((r) => r.data);
export const deleteDataset = (id) => api.delete(`/workspace/datasets/${id}`);
export const getSavedReports = (datasetId) => api.get('/workspace/reports', { params: { datasetId } }).then((r) => r.data);
export const createSavedReport = (data) => api.post('/workspace/reports', data).then((r) => r.data);
export const updateSavedReport = (id, data) => api.put(`/workspace/reports/${id}`, data).then((r) => r.data);
export const deleteSavedReport = (id) => api.delete(`/workspace/reports/${id}`);
export const getPublishedMeasures = (params) => api.get('/measures', { params }).then((r) => r.data);
export const getAdminMeasures = () => api.get('/measures/admin').then((r) => r.data);
export const previewMeasure = (data) => api.post('/measures/preview', data).then((r) => r.data);
export const createMeasure = (data) => api.post('/measures', data).then((r) => r.data);
export const updateMeasure = (id, data) => api.put(`/measures/${id}`, data).then((r) => r.data);
export const getDemoLayout = (admin = false) => api.get(admin ? '/layouts/demo/admin' : '/layouts/demo').then((r) => r.data);
export const saveDemoLayout = (layout) => api.put('/layouts/demo', layout).then((r) => r.data);
export const getPersonalLayout = () => api.get('/layouts/personal').then((r) => r.data);
export const savePersonalLayout = (layout) => api.put('/layouts/personal', layout).then((r) => r.data);

export function fmtNumber(v) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v) || 0);
}

export function fmtPct(v) {
  return `${((Number(v) || 0) * 100).toFixed(1).replace('.', ',')} %`;
}

export const MOIS_LABELS = {
  '01': 'Janv.', '02': 'Févr.', '03': 'Mars', '04': 'Avr.', '05': 'Mai', '06': 'Juin',
  '07': 'Juil.', '08': 'Août', '09': 'Sept.', '10': 'Oct.', '11': 'Nov.', '12': 'Déc.',
};

export function moisLabel(anneeMois) {
  if (!anneeMois) return '';
  const [annee, mois] = String(anneeMois).split('-');
  return `${MOIS_LABELS[mois] || mois} ${annee}`;
}

export default api;
