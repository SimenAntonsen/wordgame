// multiplayer.js — PeerJS WebRTC multiplayer

let peer = null, conn = null, isHost = false, opponentRow = 0, opponentDone = false;

function initPeer(callback){
  closePeer();
  peer=new Peer(undefined,{
    debug:0,host:'0.peerjs.com',port:443,path:'/',secure:true,
    config:{iceServers:[
      {urls:'stun:stun.l.google.com:19302'},
      {urls:'stun:stun1.l.google.com:19302'},
      {urls:'stun:global.stun.twilio.com:3478'}
    ]}
  });
  const timeout=setTimeout(()=>{showMessage('Server timeout. Try again.');closePeer();},15000);
  peer.on('open',id=>{clearTimeout(timeout);callback(id);});
  peer.on('error',e=>{
    clearTimeout(timeout);
    const msgs={'peer-unavailable':'Room not found. Check the code.','network':'Network error.','server-error':'Server error. Try again.','socket-error':'Socket failed. Try again.'};
    showMessage(msgs[e.type]||'Connection error: '+e.type);
    console.warn('PeerJS:',e.type,e);
  });
  peer.on('disconnected',()=>{if(peer&&!peer.destroyed)peer.reconnect();});
}

function closePeer(){
  if(conn){try{conn.close();}catch{}conn=null;}
  if(peer){try{peer.destroy();}catch{}peer=null;}
}

function createRoom(){
  const statusCard=document.getElementById('room-status-card');
  const codeDisplay=document.getElementById('room-code-display');
  const statusMsg=document.getElementById('room-status-msg');
  statusCard.style.display='block';codeDisplay.textContent='...';statusMsg.textContent='Setting up...';statusMsg.className='mp-status waiting';
  isHost=true;
  initPeer(id=>{
    codeDisplay.textContent=id;
    statusMsg.textContent='Share this code with your opponent!';
    peer.on('connection',c=>{
      conn=c;setupConn();
      statusMsg.textContent='Opponent connected!';statusMsg.className='mp-status connected';
      setTimeout(()=>startMultiplayerGame(),1500);
    });
  });
}

function joinRoom(){
  const code=document.getElementById('join-code').value.trim();
  if(code.length<4){showMessage('Enter a valid room code');return;}
  isHost=false;
  initPeer(()=>{
    conn=peer.connect(code,{reliable:true});
    conn.on('open',()=>{
      setupConn();showMessage('Connected! Waiting for host...');
      document.getElementById('room-status-card').style.display='block';
      document.getElementById('room-code-display').textContent=code.slice(-6);
      document.getElementById('room-status-msg').textContent='Connected! Host is starting...';
      document.getElementById('room-status-msg').className='mp-status connected';
    });
    conn.on('error',()=>showMessage('Could not connect. Check the code.'));
  });
}

function cancelRoom(){closePeer();document.getElementById('room-status-card').style.display='none';}

function setupConn(){
  conn.on('data',handleMPData);
  conn.on('close',()=>{if(!gameOver){showMessage('Opponent disconnected');gameOver=true;clearInterval(timer);}});
}

function handleMPData(data){
  if(data.type==='start'){target=data.word;category=data.category;hint=data.hint;launchGame(true);}
  else if(data.type==='row'){opponentRow=data.row;updateOpponentTracker();}
  else if(data.type==='done'){opponentDone=true;document.getElementById('opp-status').textContent=data.won?'\u2713 Done!':'✕ Failed';updateOpponentTracker(data.won);}
}

function updateOpponentTracker(won=false){
  const dots=document.getElementById('opp-rows').children;
  for(let i=0;i<ROWS;i++){
    if(!dots[i])continue;
    if(won&&i===opponentRow-1)dots[i].className='opp-row-dot won';
    else if(i<opponentRow)dots[i].className='opp-row-dot guessed';
    else dots[i].className='opp-row-dot';
  }
}

function buildOpponentTracker(){
  const track=document.getElementById('opponent-track');
  const dots=document.getElementById('opp-rows');
  dots.innerHTML=Array(ROWS).fill('<div class="opp-row-dot"></div>').join('');
  document.getElementById('opp-name').textContent='Opponent';
  document.getElementById('opp-status').textContent='playing...';
  track.style.display='flex';opponentRow=0;opponentDone=false;
}

