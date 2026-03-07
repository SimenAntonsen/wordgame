// game.js — core game logic, state, AI word fetching

// ── Game State ──
let currentStreak = 0;
let target = '', category = '', hint = '';
let currentRow = 0, currentTile = 0, currentGuess = [];
let gameOver = false, timer = null, timeLeft = 60, hintUsed = false, keyStates = {};
let isMultiplayer = false, usedWords = new Set();
let wordQueue = [], fetchPromise = null;
const TIME_LIMIT = 60, ROWS = 6, COLS = 5;

// ── Constants ──
const RANKS=[{title:'Scribbler',minLevel:1},{title:'Inkling',minLevel:3},{title:'Wordhunter',minLevel:6},{title:'Wordsmith',minLevel:10},{title:'Lexicographer',minLevel:15},{title:'Phrasemaster',minLevel:20},{title:'Vocabularian',minLevel:28},{title:'Lexicon Sage',minLevel:36},{title:'Grand Scribe',minLevel:44},{title:'Lexicon God',minLevel:50}];

const THEMES=[{id:'default',name:'Midnight',reqLevel:1,colors:['#f0e040','#40e0f0','#40e06a'],cls:''},{id:'neon',name:'Neon Rave',reqLevel:5,colors:['#ff00ff','#00ffff','#00ff88'],cls:'theme-neon'},{id:'gold',name:'Gold Rush',reqLevel:10,colors:['#ffd700','#ffaa00','#88cc00'],cls:'theme-gold'},{id:'pastel',name:'Pastel',reqLevel:15,colors:['#7c3aed','#db2777','#059669'],cls:'theme-pastel'},{id:'cyber',name:'Cyber',reqLevel:25,colors:['#00ff41','#00cc33','#ffff00'],cls:'theme-cyber'},{id:'blood',name:'Blood Moon',reqLevel:40,colors:['#ff2020','#ff6060','#ff4040'],cls:'theme-blood'}];

const BADGES=[{id:'first_win',label:'\uD83C\uDFC6 First Win',check:s=>s.wins>=1},{id:'streak3',label:'\uD83D\uDD25 3 Streak',check:s=>s.bestStreak>=3},{id:'streak7',label:'\uD83D\uDD25 7 Streak',check:s=>s.bestStreak>=7},{id:'level5',label:'\u2B50 Level 5',check:s=>s.level>=5},{id:'level10',label:'\u2B50 Level 10',check:s=>s.level>=10},{id:'level25',label:'\u2B50 Level 25',check:s=>s.level>=25},{id:'mp_win',label:'\u2694\uFE0F Versus Win',check:s=>s.mpWins>=1},{id:'speedster',label:'\u26A1 Speedster',check:s=>s.fastWin}];

const XP_PER_LEVEL=l=>Math.floor(100*Math.pow(1.18,l-1));


function getRank(level){for(let i=RANKS.length-1;i>=0;i--)if(level>=RANKS[i].minLevel)return RANKS[i].title;return RANKS[0].title;}

function addXP(amount){
  if(!currentUser)return 0;
  currentUser.xp+=amount;
  let leveled=false;
  while(currentUser.xp>=XP_PER_LEVEL(currentUser.level)){currentUser.xp-=XP_PER_LEVEL(currentUser.level);currentUser.level++;leveled=true;checkThemeUnlocks(currentUser.level);}
  checkBadges();if(!currentUser.isGuest)saveUser(currentUser);return leveled?currentUser.level:0;
}

function calcXP(won,guesses,tLeft,mp){if(!won)return 5;let xp=50;xp+=(6-guesses)*15;xp+=Math.floor(tLeft/3);if(mp)xp=Math.floor(xp*1.5);return xp;}

function checkBadges(){if(!currentUser)return;BADGES.forEach(b=>{if(!currentUser.earnedBadges.includes(b.id)&&b.check(currentUser))currentUser.earnedBadges.push(b.id);});}

function checkThemeUnlocks(level){THEMES.forEach(t=>{if(t.reqLevel===level)showUnlockToast('\uD83D\uDD13 Theme Unlocked: '+t.name+'!');});}

function showUnlockToast(msg){const el=document.getElementById('unlock-toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3000);}

function showLoadingState(on){
  if(on)document.getElementById('category-badge').textContent='AI GENERATING...';
  document.getElementById('hint-btn').disabled=on;
}

function fetchWordsFromAI(count=6){
  if(fetchPromise)return fetchPromise;
  const alreadyUsed=[...usedWords].join(', ')||'none';
  fetchPromise=fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:600,messages:[{role:'user',content:(function(){
      const lang=LANGUAGES.find(l=>l.code===currentLang)||LANGUAGES[0];
      const isEn=currentLang==='en';
      return 'Generate '+count+' unique 5-letter '+lang.name+' words for a Wordle game. Already used: '+alreadyUsed+'. Rules: exactly 5 letters, common '+lang.name+' words only, varied categories, no proper nouns. The "hint" and "category" fields must ALWAYS be in English regardless of word language. The "word" field must be in '+lang.name+(isEn?' (English)':' — real '+lang.name+' words, not translations of English words')+'. Respond ONLY with a valid JSON array, no markdown, no extra text. Example: [{"word":"BLAZE","category":"ELEMENTS","hint":"A large fierce fire"}]';
    })()}]})
  })
  .then(r=>r.json())
  .then(data=>{
    const text=data.content.map(b=>b.text||'').join('');
    const clean=text.replace(/```json|```/g,'').trim();
    const parsed=JSON.parse(clean);
    const valid=parsed.filter(w=>w.word&&w.word.length===5&&/^[A-Za-z]+$/.test(w.word)&&!usedWords.has(w.word.toUpperCase())).map(w=>({...w,word:w.word.toUpperCase()}));
    wordQueue.push(...valid);
  })
  .catch(()=>{
    const unused=FALLBACK_WORDS.filter(w=>!usedWords.has(w.word));
    wordQueue.push(...(unused.length?unused:FALLBACK_WORDS));
  })
  .finally(()=>{fetchPromise=null;});
  return fetchPromise;
}

function launchGame(mp){
  isMultiplayer=mp;currentRow=0;currentTile=0;currentGuess=[];gameOver=false;hintUsed=false;keyStates={};
  showScreen('screen-game');
  document.getElementById('category-badge').textContent=category;
  document.getElementById('hint-text').textContent='💡 press hint to reveal a clue';
  document.getElementById('hint-text').classList.remove('show');
  document.getElementById('hint-btn').disabled=false;
  const gl=LANGUAGES.find(l=>l.code===currentLang)||LANGUAGES[0];
  document.getElementById('game-lang-indicator').innerHTML=flagImg(gl.cc)+' '+gl.name;
  document.getElementById('end-screen').classList.remove('show');
  if(mp)buildOpponentTracker();
  else document.getElementById('opponent-track').style.display='none';
  buildGrid();buildKeyboard();startTimer();
}

function quitGame(){clearInterval(timer);closePeer();goMenu();}

function goMenu(){document.getElementById('end-screen').classList.remove('show');showScreen('screen-menu');}

function buildGrid(){
  const grid=document.getElementById('grid');grid.innerHTML='';
  for(let r=0;r<ROWS;r++){
    const row=document.createElement('div');row.className='grid-row';row.id=`row-${r}`;
    for(let c=0;c<COLS;c++){const tile=document.createElement('div');tile.className='tile';tile.id=`tile-${r}-${c}`;row.appendChild(tile);}
    grid.appendChild(row);
  }
}

function updateKeyboard(){Object.entries(keyStates).forEach(([k,state])=>{const el=document.getElementById(`key-${k}`);if(el)el.className=el.className.replace(/correct|present|absent/g,'').trim()+' '+state;});}

function startTimer(){
  clearInterval(timer);timeLeft=TIME_LIMIT;updateTimerDisplay();
  timer=setInterval(()=>{timeLeft--;updateTimerDisplay();if(timeLeft<=0){clearInterval(timer);endGame(false,'time');}},1000);
}

function updateTimerDisplay(){
  const bar=document.getElementById('timer-bar'),disp=document.getElementById('time-display'),pct=timeLeft/TIME_LIMIT;
  bar.style.transform=`scaleX(${pct})`;disp.textContent=timeLeft;
  bar.className='timer-bar'+(pct<.25?' danger':pct<.5?' warn':'');
  disp.className='time-display'+(timeLeft<=10?' danger':timeLeft<=20?' warn':'');
}

function handleKey(k){
  if(gameOver)return;
  if(k==='==?'||k==='Backspace'){
    if(currentTile>0){currentTile--;currentGuess.pop();const t=document.getElementById(`tile-${currentRow}-${currentTile}`);t.textContent='';t.className='tile';}
  }else if(k==='ENTER'||k==='Enter'){submitGuess();}
  else if((k.length===1||k==='IJ')&&k!=='ENTER'&&currentTile<COLS){currentGuess.push(k);const t=document.getElementById(`tile-${currentRow}-${currentTile}`);t.textContent=k;t.className='tile filled';currentTile++;}
}

function submitGuess(){
  if(currentTile<COLS){shakeRow(currentRow);showMessage('NOT ENOUGH LETTERS');return;}
  const guess=currentGuess.join(''),result=evaluateGuess(guess);
  revealRow(currentRow,result);
  if(isMultiplayer&&conn&&conn.open)conn.send({type:'row',row:currentRow+1});
  const isWin=result.every(r=>r==='correct');
  if(isWin)setTimeout(()=>endGame(true),400*COLS+200);
  else if(currentRow===ROWS-1)setTimeout(()=>endGame(false,'guesses'),400*COLS+200);
  else{currentRow++;currentTile=0;currentGuess=[];}
}

function evaluateGuess(guess){
  const result=Array(COLS).fill('absent'),targetArr=target.split(''),guessArr=guess.split(''),targetCount={};
  guessArr.forEach((l,i)=>{if(l===targetArr[i]){result[i]='correct';targetCount[l]=(targetCount[l]||0)-1;targetArr[i]=null;}else{targetCount[targetArr[i]]=(targetCount[targetArr[i]]||0)+1;}});
  guessArr.forEach((l,i)=>{if(result[i]!=='correct'&&targetCount[l]>0){result[i]='present';targetCount[l]--;}});
  guessArr.forEach((l,i)=>{const cur=keyStates[l];if(cur!=='correct'){if(result[i]==='correct')keyStates[l]='correct';else if(result[i]==='present')keyStates[l]='present';else if(!cur)keyStates[l]='absent';}});
  updateKeyboard();return result;
}

function revealRow(row,result){result.forEach((state,i)=>setTimeout(()=>{document.getElementById(`tile-${row}-${i}`).className=`tile ${state}`;},i*120));}

function shakeRow(row){document.getElementById(`row-${row}`).querySelectorAll('.tile').forEach(t=>{t.classList.add('shake');t.addEventListener('animationend',()=>t.classList.remove('shake'),{once:true});});}

function showMessage(msg,duration=1400){const el=document.getElementById('message');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),duration);}

function useHint(){
  if(hintUsed||gameOver)return;
  hintUsed=true;document.getElementById('hint-btn').disabled=true;
  timeLeft=Math.max(1,timeLeft-5);updateTimerDisplay();
  const hintEl=document.getElementById('hint-text');hintEl.textContent='\uD83D\uDCA1 '+hint;hintEl.classList.add('show');
}

function endGame(won,reason=''){
  gameOver=true;clearInterval(timer);
  if(isMultiplayer&&conn&&conn.open)conn.send({type:'done',won});
  const xpEarned=calcXP(won,currentRow+1,timeLeft,isMultiplayer);
  if(currentUser){
    if(won){currentUser.wins++;currentStreak++;if(currentStreak>currentUser.bestStreak)currentUser.bestStreak=currentStreak;if(timeLeft>45)currentUser.fastWin=true;if(isMultiplayer)currentUser.mpWins++;}
    else{currentUser.losses++;currentStreak=0;}
    const leveledUp=addXP(xpEarned);
    if(leveledUp)showUnlockToast('\uD83C\uDF89 LEVEL UP! Now Level '+leveledUp+'!');
    checkBadges();if(!currentUser.isGuest)saveUser(currentUser);
    document.getElementById('g-wins').textContent=currentUser.wins;
    document.getElementById('g-streak').textContent=currentStreak;
  }
  if(won){const msgs=['BRILLIANT!','EXCELLENT!','GREAT JOB!','NAILED IT!','AMAZING!'];showMessage(msgs[Math.floor(Math.random()*msgs.length)],1800);}
  else if(reason==='time')showMessage("TIME'S UP!",1800);
  setTimeout(()=>{
    document.getElementById('end-result').textContent=won?'\uD83C\uDFC6 WIN!':'\uD83D\uDC80 GAME OVER';
    document.getElementById('end-result').className='end-result '+(won?'win':'lose');
    document.getElementById('end-word-display').textContent=target;
    document.getElementById('xp-gained').textContent='+'+xpEarned+' XP';
    document.getElementById('es-guesses').textContent=won?currentRow+1:'===';
    document.getElementById('es-time').textContent=timeLeft+'s';
    document.getElementById('es-streak').textContent=currentStreak;
    document.getElementById('end-screen').classList.add('show');
    showWordMeaning(target,currentLang);
  },won?1800:2000);
}

function showWordMeaning(word,lang){
  const el=document.getElementById('word-meaning');
  if(!el)return;
  if(lang==='en'){el.textContent='';return;}
  el.textContent='Fetching translation...';
  fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:80,
      messages:[{role:'user',content:'What does the '+LANGUAGES.find(l=>l.code===lang).name+' word "'+word+'" mean in English? Reply with ONLY a short one-sentence definition, no preamble.'}]})
  }).then(r=>r.json()).then(data=>{
    const txt=(data.content||[]).map(function(b){return b.text||'';}).join('').trim();
    el.textContent=txt?'Meaning: '+txt:'';
  }).catch(function(){el.textContent='';});
}

