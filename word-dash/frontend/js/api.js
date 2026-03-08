// api.js — all communication with the Word Dash backend
// Automatically uses relative URLs so it works on any host

const API = (() => {
  const BASE = '/api';

  function getToken() {
    return localStorage.getItem('wd_token');
  }

  function setToken(t) {
    if (t) localStorage.setItem('wd_token', t);
    else    localStorage.removeItem('wd_token');
  }

  async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  return {
    // ── Auth ──────────────────────────────────────────────────
    async register(username, password) {
      const data = await request('POST', '/auth/register', { username, password });
      setToken(data.token);
      return data.user;
    },

    async login(username, password) {
      const data = await request('POST', '/auth/login', { username, password });
      setToken(data.token);
      return data.user;
    },

    logout() {
      setToken(null);
    },

    async getMe() {
      const data = await request('GET', '/auth/me');
      return data.user;
    },

    isLoggedIn() {
      return !!getToken();
    },

    // ── User / Progress ───────────────────────────────────────
    async saveProgress(payload) {
      return request('POST', '/users/progress', payload);
    },

    async saveSettings(settings) {
      return request('PATCH', '/users/settings', settings);
    },

    // ── Friends ───────────────────────────────────────────────
    async getFriends() {
      const data = await request('GET', '/users/friends');
      return data.friends;
    },

    async addFriend(username) {
      return request('POST', '/users/friends/' + encodeURIComponent(username));
    },

    async removeFriend(username) {
      return request('DELETE', '/users/friends/' + encodeURIComponent(username));
    },

    // ── Leaderboard ───────────────────────────────────────────
    async getGlobalLeaderboard(lang) {
      const q = lang && lang !== 'all' ? '?lang=' + lang : '';
      const data = await request('GET', '/leaderboard/global' + q);
      return data.leaderboard;
    },

    async getFriendsLeaderboard() {
      const data = await request('GET', '/leaderboard/friends');
      return data.leaderboard;
    },

    async getMyRank() {
      return request('GET', '/leaderboard/me');
    },
  };
})();
