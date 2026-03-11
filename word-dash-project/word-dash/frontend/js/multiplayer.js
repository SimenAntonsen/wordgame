// multiplayer.js — WebSocket signalling-based multiplayer (no PeerJS dependency)

let ws = null;
let isHost = false;
let opponentRow = 0;
let opponentDone = false;
let myRoomCode = null;

function closePeer() {
  if (ws) { try { ws.close(); } catch {} ws = null; }
  myRoomCode = null;
}

function connectSignal(onOpen) {
  closePeer();
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url   = proto + '//' + window.location.host + '/signal';
  ws = new WebSocket(url);

  ws.onopen  = () => onOpen();
  ws.onerror = () => showMessage('Connection error. Try again.');
  ws.onclose = () => {
    if (!gameOver) showMessage('Disconnected from server.');
  };
  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    handleSignal(msg);
  };
}

function handleSignal(msg) {
  if (msg.type === 'created') {
    myRoomCode = msg.code;
    const codeDisplay = document.getElementById('room-code-display');
    const statusMsg   = document.getElementById('room-status-msg');
    if (codeDisplay) codeDisplay.textContent = msg.code;
    if (statusMsg)   { statusMsg.textContent = 'Share this code!'; statusMsg.className = 'mp-status waiting'; }

  } else if (msg.type === 'guest_joined') {
    const statusMsg = document.getElementById('room-status-msg');
    if (statusMsg)  { statusMsg.textContent = 'Opponent connected!'; statusMsg.className = 'mp-status connected'; }
    setTimeout(() => startMultiplayerGame(), 1500);

  } else if (msg.type === 'joined') {
    const statusMsg   = document.getElementById('room-status-msg');
    const codeDisplay = document.getElementById('room-code-display');
    if (statusMsg)   { statusMsg.textContent = 'Connected! Host is starting...'; statusMsg.className = 'mp-status connected'; }
    if (codeDisplay)   codeDisplay.textContent = msg.code;

  } else if (msg.type === 'relay') {
    handleMPData(msg.data);

  } else if (msg.type === 'opponent_left') {
    if (!gameOver) { showMessage('Opponent disconnected'); gameOver = true; clearInterval(timer); }

  } else if (msg.type === 'error') {
    showMessage(msg.msg || 'Connection error');
    document.getElementById('room-status-card').style.display = 'none';
  }
}

function sendToOpponent(data) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'relay', data }));
}

function createRoom() {
  const statusCard  = document.getElementById('room-status-card');
  const codeDisplay = document.getElementById('room-code-display');
  const statusMsg   = document.getElementById('room-status-msg');
  statusCard.style.display = 'block';
  codeDisplay.textContent  = '...';
  statusMsg.textContent    = 'Setting up...';
  statusMsg.className      = 'mp-status waiting';
  isHost = true;

  connectSignal(() => {
    ws.send(JSON.stringify({ type: 'create' }));
  });
}

function joinRoom() {
  const code = (document.getElementById('join-code').value || '').trim().toUpperCase();
  if (code.length < 4) { showMessage('Enter the room code'); return; }

  const statusCard  = document.getElementById('room-status-card');
  const codeDisplay = document.getElementById('room-code-display');
  const statusMsg   = document.getElementById('room-status-msg');
  statusCard.style.display = 'block';
  codeDisplay.textContent  = code;
  statusMsg.textContent    = 'Connecting...';
  statusMsg.className      = 'mp-status waiting';
  isHost = false;

  connectSignal(() => {
    ws.send(JSON.stringify({ type: 'join', code }));
  });
}

function cancelRoom() {
  closePeer();
  document.getElementById('room-status-card').style.display = 'none';
}

function handleMPData(data) {
  if (data.type === 'start') {
    target = data.word; category = data.category; hint = data.hint;
    launchGame(true);
  } else if (data.type === 'row') {
    opponentRow = data.row;
    updateOpponentTracker(false, data.result || []);
  } else if (data.type === 'done') {
    opponentDone = true;
    const el = document.getElementById('opp-status');
    if (el) el.textContent = data.won ? '✓ Done!' : '✕ Failed';
    updateOpponentTracker(data.won, []);
  }
}

async function startMultiplayerGame() {
  const pick = await pickWord();
  sendToOpponent({ type: 'start', word: pick.word, category: pick.category, hint: pick.hint });
  target = pick.word; category = pick.category; hint = pick.hint;
  launchGame(true);
}

function updateOpponentTracker(won = false, result = []) {
  const dots = document.getElementById('opp-rows').children;
  const rowIdx = opponentRow - 1; // the row just played (0-based)
  for (let i = 0; i < ROWS; i++) {
    if (!dots[i]) continue;
    if (i === rowIdx && result.length) {
      // Color this row's dot based on result
      const allCorrect = result.every(r => r === 'correct');
      const anyCorrect = result.some(r => r === 'correct');
      if (allCorrect || won)       dots[i].className = 'opp-row-dot won';
      else if (anyCorrect)         dots[i].className = 'opp-row-dot correct';
      else                         dots[i].className = 'opp-row-dot guessed';
    } else if (i < opponentRow) {
      if (!dots[i].className.includes('won') && !dots[i].className.includes('correct')) {
        dots[i].className = 'opp-row-dot guessed';
      }
    }
  }
}

function buildOpponentTracker() {
  const track = document.getElementById('opponent-track');
  const dots  = document.getElementById('opp-rows');
  dots.innerHTML = Array(ROWS).fill('<div class="opp-row-dot"></div>').join('');
  document.getElementById('opp-name').textContent   = 'Opponent';
  document.getElementById('opp-status').textContent = 'playing...';
  track.style.display = 'flex';
  opponentRow = 0; opponentDone = false;
}
