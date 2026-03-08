const express = require('express');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /api/users/progress  — save game result + update stats
router.post('/progress', authMiddleware, async (req, res) => {
  const { won, guesses, timeLeft, xpEarned, lang, isMp, theme, level,
          bestStreak, fastWin, earnedBadges } = req.body;
  const userId = req.user.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Save game result
    await client.query(
      `INSERT INTO game_results (user_id, won, guesses, time_left, xp_earned, lang, is_mp)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, won, guesses, timeLeft, xpEarned, lang || 'en', isMp || false]
    );

    // Update user stats
    await client.query(
      `UPDATE users SET
        xp           = xp + $1,
        level        = $2,
        wins         = wins + $3,
        losses       = losses + $4,
        mp_wins      = mp_wins + $5,
        best_streak  = GREATEST(best_streak, $6),
        fast_win     = fast_win OR $7,
        theme        = $8,
        earned_badges = $9
       WHERE id = $10`,
      [
        xpEarned, level,
        won ? 1 : 0, won ? 0 : 1,
        isMp && won ? 1 : 0,
        bestStreak || 0,
        fastWin || false,
        theme || 'default',
        earnedBadges || [],
        userId
      ]
    );

    await client.query('COMMIT');

    const result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    res.json({ ok: true, user: result.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// PATCH /api/users/settings  — save theme/lang preference
router.patch('/settings', authMiddleware, async (req, res) => {
  const { theme, lang } = req.body;
  const updates = [];
  const values  = [];
  let   idx     = 1;

  if (theme) { updates.push(`theme = $${idx++}`); values.push(theme); }
  if (lang)  { updates.push(`lang  = $${idx++}`); values.push(lang);  }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  values.push(req.user.id);
  try {
    await pool.query(`UPDATE users SET ${updates.join(',')} WHERE id = $${idx}`, values);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/friends
router.get('/friends', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.level, u.xp, u.wins, u.best_streak
       FROM friendships f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1
       ORDER BY u.xp DESC`,
      [req.user.id]
    );
    res.json({ friends: result.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/friends/:username
router.post('/friends/:username', authMiddleware, async (req, res) => {
  try {
    const target = await pool.query(
      'SELECT id, username FROM users WHERE LOWER(username) = LOWER($1)',
      [req.params.username]
    );
    if (!target.rows.length) return res.status(404).json({ error: 'User not found' });
    const friendId = target.rows[0].id;
    if (friendId === req.user.id) return res.status(400).json({ error: "Can't add yourself" });

    await pool.query(
      'INSERT INTO friendships (user_id, friend_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.id, friendId]
    );
    res.json({ ok: true, friend: target.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/users/friends/:username
router.delete('/friends/:username', authMiddleware, async (req, res) => {
  try {
    const target = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [req.params.username]
    );
    if (!target.rows.length) return res.status(404).json({ error: 'User not found' });
    await pool.query(
      'DELETE FROM friendships WHERE user_id = $1 AND friend_id = $2',
      [req.user.id, target.rows[0].id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
