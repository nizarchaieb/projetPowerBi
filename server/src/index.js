'use strict';

require('dotenv').config();
if (typeof process.env.JWT_SECRET !== 'string' || process.env.JWT_SECRET.length < 32) {
  throw new Error('Définissez un JWT_SECRET aléatoire de 32 caractères minimum dans .env.');
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('node:path');
const fs = require('node:fs');
const pool = require('./db');

const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const insightsRoutes = require('./routes/insights');
const messagesRoutes = require('./routes/messages');
const usersRoutes = require('./routes/users');
const workspaceRoutes = require('./routes/workspace');
const customMeasureRoutes = require('./routes/customMeasures').router;
const layoutRoutes = require('./routes/layouts').router;
const auditRoutes = require('./routes/audit');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '9mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (e) {
    res.status(503).json({ ok: false, db: 'down' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/measures', customMeasureRoutes);
app.use('/api/layouts', layoutRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api', dataRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route introuvable.' });
});

const clientDist = process.env.CLIENT_DIST
  ? path.resolve(process.env.CLIENT_DIST)
  : path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// Gestionnaire d'erreurs global (messages en français, sans fuite de détails internes).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La requête est trop volumineuse. Vérifiez la limite du fichier CSV.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Le contenu envoyé est invalide.' });
  }
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, '0.0.0.0', () => {
  // Serveur démarré sur le port PORT.
});

module.exports = app;
