// leaderboard.js — leaderboard UI

let lbTab = 'global'; // 'global' | 'friends'

function showScreen_leaderboard() {
  renderLeaderboard();
}

async function renderLeaderboard() {
  const container = document.getElementById('lb-list');
  const myRankEl  = document.getElementById('lb-my-rank');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:20px;color:#606080;font-size:.65rem;letter-spacing:2px;">LOADING...</div>';

  try {
    let rows;
    if (lbTab === 'friends') {
      rows = await API.getFriendsLeaderboard();
    } else {
      const lang = currentLang !== 'en' ? currentLang : null;
      rows = await API.getGlobalLeaderboard(lang);
    }

    // My rank badge
    const me = rows.find(r => r.isme || r.isMe);
    if (me && myRankEl) {
      myRankEl.textContent = 'YOUR RANK: #' + me.rank;
      myRankEl.style.display = 'block';
    } else if (myRankEl) {
      myRankEl.style.display = 'none';
    }

    if (!rows.length) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:#606080;font-size:.65rem;letter-spacing:2px;">NO DATA YET</div>';
      return;
    }

    container.innerHTML = rows.map((r, i) => {
      const isMe = r.isme || r.isMe;
      const rank = r.rank || (i + 1);
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
      return `<div class="lb-row${isMe ? ' lb-row-me' : ''}">
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${escapeHtml(r.username)}${isMe ? ' <span class="lb-you">YOU</span>' : ''}</span>
        <span class="lb-level">LVL ${r.level}</span>
        <span class="lb-xp">${r.xp.toLocaleString()} XP</span>
        <span class="lb-wins">${r.wins}W</span>
      </div>`;
    }).join('');

  } catch (e) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#f04040;font-size:.65rem;">Failed to load. Check connection.</div>';
  }
}

function switchLbTab(tab) {
  lbTab = tab;
  document.querySelectorAll('.lb-tab').forEach((t, i) =>
    t.classList.toggle('active', ['global', 'friends'][i] === tab)
  );
  renderLeaderboard();
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
