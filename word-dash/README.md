# Word Dash

A multiplayer Wordle-style game with RPG progression, 15 language support, and real-time 1v1 battles.

## Stack
- **Frontend:** Vanilla HTML/CSS/JS (no framework)
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Auth:** JWT + bcrypt
- **Multiplayer:** PeerJS (WebRTC, serverless)
- **Hosting:** Render.com

---

## Project Structure
```
word-dash/
├── frontend/
│   ├── index.html
│   ├── css/
│   │   ├── main.css        # Base styles, layout, components, leaderboard
│   │   ├── themes.css      # Theme color overrides (Neon, Gold, Pastel etc.)
│   │   └── keyboard.css    # Keyboard and key styles
│   └── js/
│       ├── api.js          # All backend API calls
│       ├── auth.js         # Login / register / logout
│       ├── game.js         # Core game logic, AI word fetching, XP
│       ├── keyboard.js     # Keyboard layout with language-specific keys
│       ├── ui.js           # Screens, menus, themes, language picker
│       ├── multiplayer.js  # PeerJS WebRTC 1v1 logic
│       ├── leaderboard.js  # Leaderboard UI (global + friends)
│       ├── flags.js        # Embedded SVG flag data URIs
│       └── languages.js    # Language definitions + extra letters
├── backend/
│   ├── server.js           # Express app entry point
│   ├── db.js               # PostgreSQL connection + schema init
│   ├── routes/
│   │   ├── auth.js         # POST /register, POST /login, GET /me
│   │   ├── users.js        # Progress saving, settings, friends
│   │   └── leaderboard.js  # Global + friends leaderboard
│   └── middleware/
│       └── auth.js         # JWT verification middleware
├── .env.example
└── README.md
```

---

## Local Development

### 1. Prerequisites
- Node.js 18+
- PostgreSQL running locally

### 2. Backend setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your local DB credentials
npm run dev
```

### 3. Frontend
No build step needed. Open `frontend/index.html` directly in a browser,
or serve it with a simple static server:
```bash
cd frontend
npx serve .
```

---

## Deploying to Render

### Step 1 — Create a PostgreSQL database
1. Go to [render.com](https://render.com) → New → PostgreSQL
2. Choose **Free** tier, pick a name (e.g. `worddash-db`)
3. Copy the **Internal Database URL** — you'll need it in Step 3

### Step 2 — Deploy the backend
1. Push this repo to GitHub
2. Render → New → Web Service → connect your GitHub repo
3. Set:
   - **Root directory:** `backend`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Plan:** Free

### Step 3 — Set environment variables in Render
In your Web Service → Environment, add:
```
DATABASE_URL    = (paste Internal Database URL from Step 1)
JWT_SECRET      = (any long random string, e.g. openssl rand -hex 32)
FRONTEND_URL    = https://your-service-name.onrender.com
NODE_ENV        = production
```

### Step 4 — Frontend
The backend already serves the frontend as static files from `../frontend`.
So your single Render web service handles everything.

Your app will be live at `https://your-service-name.onrender.com` 🎉

---

## API Reference

### Auth
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | `{username, password}` | Create account |
| POST | `/api/auth/login` | `{username, password}` | Login |
| GET  | `/api/auth/me` | — | Get current user (JWT required) |

### Users
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/users/progress` | `{won, guesses, timeLeft, xpEarned, ...}` | Save game result |
| PATCH | `/api/users/settings` | `{theme?, lang?}` | Update preferences |
| GET | `/api/users/friends` | — | List friends |
| POST | `/api/users/friends/:username` | — | Add friend |
| DELETE | `/api/users/friends/:username` | — | Remove friend |

### Leaderboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/leaderboard/global?lang=no` | Top 50 players (optional lang filter) |
| GET | `/api/leaderboard/friends` | Friends leaderboard |
| GET | `/api/leaderboard/me` | Your rank + nearby players |

---

## Notes
- **Passwords** are hashed with bcrypt (10 rounds) — never stored in plain text
- **JWT tokens** expire after 30 days and are stored in `localStorage`
- **Multiplayer** uses PeerJS (WebRTC) — no game data passes through the server
- **Guest mode** works offline — progress is not saved to the database
- **Word generation** uses the Anthropic Claude API — requires the claude.ai interface or your own API key in production
