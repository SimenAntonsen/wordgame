// auth.js — authentication UI and state

let currentUser = null;

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) =>
    t.classList.toggle('active', ['login', 'register', 'guest'][i] === tab)
  );
  document.getElementById('auth-login').style.display    = tab === 'login'    ? 'flex' : 'none';
  document.getElementById('auth-register').style.display = tab === 'register' ? 'flex' : 'none';
  if (tab === 'guest') guestMode();
}

async function doLogin() {
  const u   = document.getElementById('login-user').value.trim();
  const p   = document.getElementById('login-pass').value;
  const err = document.getElementById('login-err');
  if (!u || !p) { err.textContent = 'Fill in all fields.'; return; }
  err.textContent = 'Logging in...';
  try {
    const user = await API.login(u, p);
    loginAs(user);
  } catch (e) {
    err.textContent = e.message;
  }
}

async function doRegister() {
  const u   = document.getElementById('reg-user').value.trim();
  const p   = document.getElementById('reg-pass').value;
  const err = document.getElementById('reg-err');
  if (!u || !p) { err.textContent = 'Fill in all fields.'; return; }
  err.textContent = 'Creating account...';
  try {
    const user = await API.register(u, p);
    loginAs(user);
  } catch (e) {
    err.textContent = e.message;
  }
}

function guestMode() {
  const guestName = 'Guest_' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const user = {
    username:     guestName,
    isGuest:      true,
    xp:           0,
    level:        1,
    theme:        'default',
    lang:         'en',
    friends:      [],
    earnedBadges: [],
    wins:         0,
    losses:       0,
    bestStreak:   0,
    mpWins:       0,
    fastWin:      false,
  };
  loginAs(user);
}

function loginAs(user) {
  // Map server snake_case to camelCase
  currentUser = {
    ...user,
    rankPoints:  user.rank_points  ?? user.rankPoints  ?? 1000,
    bestStreak:  user.best_streak  ?? user.bestStreak  ?? 0,
    mpWins:      user.mp_wins      ?? user.mpWins      ?? 0,
    fastWin:     user.fast_win     ?? user.fastWin     ?? false,
    earnedBadges:user.earned_badges?? user.earnedBadges?? [],
    friends:     user.friends      ?? [],
  };
  currentLang  = currentUser.lang || 'en';
  applyTheme(currentUser.theme || 'default');
  updateMenuUI();
  showScreen('screen-menu');
}

function doLogout() {
  if (currentUser && !currentUser.isGuest) API.logout();
  currentUser = null;
  closePeer();
  showScreen('screen-auth');
}

// Try to restore session on page load
async function tryRestoreSession() {
  if (!API.isLoggedIn()) return false;
  try {
    const user = await API.getMe();
    loginAs(user);
    return true;
  } catch (e) {
    API.logout();
    return false;
  }
}
