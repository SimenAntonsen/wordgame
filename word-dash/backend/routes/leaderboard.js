const express = require('express');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/leaderboard/global?lang=en&limit=50
router.get('/global', authMiddleware, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const lang  = req.query.lang || null;

  try {
    let query, params;
    if (lang && lang !== 'all') {
      query = `
        SELECT u.id, u.username, u.level, u.xp, u.wins, u.losses, u.best_streak, u.mp_wins,
               RANK() OVER (ORDER BY u.xp DESC) AS rank
        FROM users u
        JOIN game_results gr ON gr.user_id = u.id AND gr.lang = $1
        GROUP BY u.id
        ORDER BY u.xp DESC
        LIMIT $2`;
      params = [lang, limit];
    } else {
      query = `
        SELECT id, username, level, xp, wins, losses, best_streak, mp_wins,
               RANK() OVER (ORDER BY xp DESC) AS rank
        FROM users
        ORDER BY xp DESC
        LIMIT $1`;
      params = [limit];
    }
    const result = await pool.query(query, params);

    // Mark the requesting user's own row
    const rows = result.rows.map(r => ({
      ...r,
      isMe: r.id === req.user.id,
    }));

    res.json({ leaderboard: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/leaderboard/friends
router.get('/friends', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.level, u.xp, u.wins, u.best_streak, u.mp_wins,
              RANK() OVER (ORDER BY u.xp DESC) AS rank
       FROM users u
       WHERE u.id = $1
          OR u.id IN (SELECT friend_id FROM friendships WHERE user_id = $1)
       ORDER BY u.xp DESC`,
      [req.user.id]
    );

    const rows = result.rows.map(r => ({
      ...r,
      isMe: r.id === req.user.id,
    }));

    res.json({ leaderboard: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/leaderboard/me  — the requesting user's rank + nearby players
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const ranked = await pool.query(
      `SELECT id, username, level, xp, wins, best_streak,
              RANK() OVER (ORDER BY xp DESC) AS rank
       FROM users`
    );
    const myRow = ranked.rows.find(r => r.id === req.user.id);
    if (!myRow) return res.json({ rank: null });

    const myRank = parseInt(myRow.rank);
    const nearby = ranked.rows
      .filter(r => Math.abs(parseInt(r.rank) - myRank) <= 2)
      .map(r => ({ ...r, isMe: r.id === req.user.id }));

    res.json({ rank: myRank, total: ranked.rows.length, nearby });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
