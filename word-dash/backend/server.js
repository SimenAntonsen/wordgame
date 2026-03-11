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

// ── Debug: check config (no secrets exposed) ─────────────────────────────────
app.get('/api/debug', (req, res) => res.json({
  hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
  hasJwtSecret:    !!process.env.JWT_SECRET,
  hasDatabaseUrl:  !!process.env.DATABASE_URL,
  nodeEnv:         process.env.NODE_ENV || 'not set',
}));

// ── Debug: test AI word generation directly ───────────────────────────────────
app.get('/api/debug/words', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: 'Generate 3 unique 5-letter English words for Wordle. Respond ONLY with a JSON array like: [{"word":"BLAZE","category":"ELEMENTS","hint":"A large fire"}]' }],
      }),
    });
    const data = await response.json();
    res.json({ status: response.status, ok: response.ok, data });
  } catch(e) {
    res.json({ error: e.message });
  }
});

// ── Test: actually call Anthropic and return raw result ───────────────────────
app.get('/api/test-ai', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.json({ error: 'No API key' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: 'Reply with exactly: [{"word":"CRANE","category":"ANIMALS","hint":"A tall wading bird"}]' }],
      }),
    });
    const data = await response.json();
    res.json({ status: response.status, data });
  } catch(e) {
    res.json({ error: e.message });
  }
});

// ── Catch-all: serve index.html for client-side routing ──────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Signalling Server ────────────────────────────────────────────────────────
const { setupSignalling } = require('./signalling');

// ── Start ─────────────────────────────────────────────────────────────────────
initDB().then(() => {
  const server = app.listen(PORT, () => console.log(`Word Dash running on port ${PORT}`));
  setupSignalling(server);
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
