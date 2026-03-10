const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 10;

function makeToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function formatUser(row) {
  return {
    id:           row.id,
    username:     row.username,
    xp:           row.xp,
    level:        row.level,
    theme:        row.theme,
    lang:         row.lang,
    wins:         row.wins,
    losses:       row.losses,
    bestStreak:   row.best_streak,
    mpWins:       row.mp_wins,
    fastWin:      row.fast_win,
    earnedBadges: row.earned_badges || [],
  };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 3 || username.length > 32)
    return res.status(400).json({ error: 'Username must be 3-32 characters' });
  if (password.length < 4)
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return res.status(400).json({ error: 'Username can only contain letters, numbers and underscores' });

  try {
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *',
      [username, hashed]
    );
    const user = result.rows[0];
    res.json({ token: makeToken(user), user: formatUser(user) });
  } catch (e) {
    if (e.code === '23505')
      return res.status(409).json({ error: 'Username already taken' });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]
    );
    if (!result.rows.length)
      return res.status(401).json({ error: 'Invalid username or password' });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: 'Invalid username or password' });

    res.json({ token: makeToken(user), user: formatUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me  — refresh profile from DB
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: formatUser(result.rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
