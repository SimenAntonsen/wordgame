// signalling.js — lightweight WebSocket signalling for multiplayer
// Replaces PeerJS. Clients connect, create/join rooms, relay messages.
const { WebSocketServer } = require('ws');

function setupSignalling(server) {
  const wss = new WebSocketServer({ server, path: '/signal' });
  const rooms = {}; // roomCode -> { host: ws, guest: ws|null }

  function send(ws, obj) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  wss.on('connection', (ws) => {
    ws.roomCode = null;
    ws.role     = null;

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'create') {
        // Host creates a room with a short random code
        const code = Math.random().toString(36).slice(2, 8).toUpperCase();
        rooms[code] = { host: ws, guest: null };
        ws.roomCode = code;
        ws.role = 'host';
        send(ws, { type: 'created', code });

      } else if (msg.type === 'join') {
        const room = rooms[msg.code];
        if (!room)         { send(ws, { type: 'error', msg: 'Room not found. Check the code.' }); return; }
        if (room.guest)    { send(ws, { type: 'error', msg: 'Room is full.' }); return; }
        room.guest  = ws;
        ws.roomCode = msg.code;
        ws.role     = 'guest';
        send(ws,        { type: 'joined', code: msg.code });
        send(room.host, { type: 'guest_joined' });

      } else if (msg.type === 'relay') {
        // Forward game data to the other player in the room
        const room = rooms[ws.roomCode];
        if (!room) return;
        const target = ws.role === 'host' ? room.guest : room.host;
        send(target, { type: 'relay', data: msg.data });
      }
    });

    ws.on('close', () => {
      const room = rooms[ws.roomCode];
      if (!room) return;
      // Notify the other player
      const other = ws.role === 'host' ? room.guest : room.host;
      send(other, { type: 'opponent_left' });
      delete rooms[ws.roomCode];
    });
  });

  console.log('Signalling server ready at /signal');
}

module.exports = { setupSignalling };
