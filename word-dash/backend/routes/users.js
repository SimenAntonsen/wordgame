const express = require('express');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Rank tier calculation (shared with frontend)
function getRankTier(rp) {
  if (rp < 1200) return { tier: 'Bronze',   division: rp < 1067 ? 'III' : rp < 1134 ? 'II' : 'I',   color: '#cd7f32' };
  if (rp < 1400) return { tier: 'Silver',   division: rp < 1267 ? 'III' : rp < 1334 ? 'II' : 'I',   color: '#c0c0c0' };
  if (rp < 1600) return { tier: 'Gold',     division: rp < 1467 ? 'III' : rp < 1534 ? 'II' : 'I',   color: '#ffd700' };
  if (rp < 1800) return { tier: 'Platinum', division: rp < 1667 ? 'III' : rp < 1734 ? 'II' : 'I',   color: '#00e5ff' };
  return             { tier: 'Diamond',  division: rp < 1867 ? 'III' : rp < 1934 ? 'II' : 'I',   color: '#b9f2ff' };
}

function calcRPChange(won, guesses, isRanked, isMpRanked) {
  if (!isRanked) return 0;
  if (isMpRanked) return won ? 30 : -20;
  if (!won) return -10;
  // Solo ranked: +25 for 1 guess, down to +15 for 6 guesses
  return Math.max(15, 25 - (guesses - 1) * 2);
}

// POST /api/users/progress
router.post('/progress', authMiddleware, async (req, res) => {
  const { won, guesses, timeLeft, xpEarned, lang, isMp, isRanked, isMpRanked,
          theme, level, bestStreak, fastWin, earnedBadges } = req.body;
  const userId = req.user.id;
  const rpChange = calcRPChange(won, guesses, isRanked, isMpRanked);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO game_results (user_id, won, guesses, time_left, xp_earned, lang, is_mp, is_ranked, rp_change)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [userId, won, guesses, timeLeft, xpEarned, lang || 'en', isMp || false, isRanked || false, rpChange]
    );

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
        earned_badges = $9,
        rank_points  = GREATEST(800, rank_points + $10)
       WHERE id = $11`,
      [
        xpEarned, level,
        won ? 1 : 0, won ? 0 : 1,
        isMp && won ? 1 : 0,
        bestStreak || 0,
        fastWin || false,
        theme || 'default',
        earnedBadges || [],
        rpChange,
        userId
      ]
    );

    await client.query('COMMIT');
    const result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    res.json({ ok: true, user, rpChange, rankTier: getRankTier(user.rank_points) });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// PATCH /api/users/settings
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

// GET /api/users/friends — enriched with rank, stats, last played
router.get('/friends', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.level, u.xp, u.wins, u.losses, u.best_streak, u.rank_points,
              MAX(gr.played_at) as last_played
       FROM friendships f
       JOIN users u ON u.id = f.friend_id
       LEFT JOIN game_results gr ON gr.user_id = u.id
       WHERE f.user_id = $1
       GROUP BY u.id
       ORDER BY u.rank_points DESC`,
      [req.user.id]
    );
    const friends = result.rows.map(f => ({
      ...f,
      rankTier: getRankTier(f.rank_points)
    }));
    res.json({ friends });
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


module.exports = router;
