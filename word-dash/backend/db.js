const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         SERIAL PRIMARY KEY,
        username   VARCHAR(32) UNIQUE NOT NULL,
        password   VARCHAR(255) NOT NULL,
        xp         INTEGER DEFAULT 0,
        level      INTEGER DEFAULT 1,
        theme      VARCHAR(32) DEFAULT 'default',
        lang       VARCHAR(8)  DEFAULT 'en',
        wins       INTEGER DEFAULT 0,
        losses     INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        mp_wins    INTEGER DEFAULT 0,
        fast_win   BOOLEAN DEFAULT FALSE,
        earned_badges TEXT[] DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS friendships (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
        friend_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, friend_id)
      );

      CREATE TABLE IF NOT EXISTS game_results (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
        won         BOOLEAN NOT NULL,
        guesses     INTEGER NOT NULL,
        time_left   INTEGER NOT NULL,
        xp_earned   INTEGER NOT NULL,
        lang        VARCHAR(8) DEFAULT 'en',
        is_mp       BOOLEAN DEFAULT FALSE,
        played_at   TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp DESC);
      CREATE INDEX IF NOT EXISTS idx_game_results_user ON game_results(user_id);
    `);
    console.log('Database schema ready');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
