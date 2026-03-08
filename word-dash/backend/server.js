require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { initDB } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());

// ── Serve frontend static files ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/words',       require('./routes/words'));
app.use('/api/meaning',    require('./routes/meaning'));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));

// ── Catch-all: serve index.html for client-side routing ──────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── PeerJS Server (self-hosted) ──────────────────────────────────────────────
const { ExpressPeerServer } = require('peer');

// ── Start ─────────────────────────────────────────────────────────────────────
initDB().then(() => {
  const server = app.listen(PORT, () => console.log(`Word Dash server running on port ${PORT}`));

  // Mount PeerJS signalling server on /peerjs
  const peerServer = ExpressPeerServer(server, { path: '/' });
  app.use('/peerjs', peerServer);
  console.log('PeerJS signalling server running at /peerjs');

}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
