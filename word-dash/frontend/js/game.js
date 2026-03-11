// game.js — core game logic, state, AI word fetching

// ── Game State ──
let currentStreak = 0;
let target = '', category = '', hint = '';
let currentRow = 0, currentTile = 0, currentGuess = [];
let gameOver = false, timer = null, timeLeft = 60, hintUsed = false, keyStates = {};
let isMultiplayer = false, usedWords = new Set();
let wordQueue = [], fetchPromise = null;

function loadUsedWords(lang) {
  try {
    const saved = localStorage.getItem('wd_used_' + lang);
    if (saved) {
      const arr = JSON.parse(saved);
      // Keep last 80 words max to avoid over-constraining the AI
      arr.slice(-80).forEach(w => usedWords.add(w));
    }
  } catch(e) {}
}

function saveUsedWords(lang) {
  try {
    localStorage.setItem('wd_used_' + lang, JSON.stringify([...usedWords].slice(-80)));
  } catch(e) {}
}
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
  checkBadges();return leveled?currentUser.level:0;
}

function calcXP(won,guesses,tLeft,mp){if(!won)return 5;let xp=50;xp+=(6-guesses)*15;xp+=Math.floor(tLeft/3);if(mp)xp=Math.floor(xp*1.5);return xp;}

function checkBadges(){if(!currentUser)return;BADGES.forEach(b=>{if(!currentUser.earnedBadges.includes(b.id)&&b.check(currentUser))currentUser.earnedBadges.push(b.id);});}

function checkThemeUnlocks(level){THEMES.forEach(t=>{if(t.reqLevel===level)showUnlockToast('\uD83D\uDD13 Theme Unlocked: '+t.name+'!');});}

function showUnlockToast(msg){const el=document.getElementById('unlock-toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3000);}

function showLoadingState(on){
  const badge = document.getElementById('category-badge');
  const btn   = document.getElementById('hint-btn');
  if(badge) badge.textContent = on ? 'LOADING WORD...' : (category||'');
  if(btn)   btn.disabled = on;
}

const FALLBACK_WORDS=[
  {word:'CRANE',category:'ANIMALS',hint:'A tall wading bird'},
  {word:'STORM',category:'WEATHER',hint:'Thunder and lightning'},
  {word:'PRISM',category:'SCIENCE',hint:'Splits light into colors'},
  {word:'FROST',category:'WEATHER',hint:'Frozen morning dew'},
  {word:'RAVEN',category:'ANIMALS',hint:'A large black bird'},
  {word:'BLAZE',category:'ELEMENTS',hint:'A large fierce fire'},
  {word:'SWIFT',category:'MOVEMENT',hint:'Extremely fast'},
  {word:'GLARE',category:'SENSES',hint:'An intense stare'},
  {word:'PLANT',category:'NATURE',hint:'A living green organism'},
  {word:'BRAVE',category:'TRAITS',hint:'Showing courage'},
  {word:'CHESS',category:'GAMES',hint:'A strategy board game'},
  {word:'FLUTE',category:'MUSIC',hint:'A wind instrument'},
  {word:'GLOBE',category:'GEOGRAPHY',hint:'A spherical map of Earth'},
  {word:'HONEY',category:'FOOD',hint:'Made by bees'},
  {word:'MAPLE',category:'TREES',hint:'Tree known for syrup'},
  {word:'NERVE',category:'BIOLOGY',hint:'Carries signals in body'},
  {word:'OLIVE',category:'FOOD',hint:'Small fruit used in oil'},
  {word:'PIANO',category:'MUSIC',hint:'Keyboard instrument'},
  {word:'QUICK',category:'TRAITS',hint:'Fast and nimble'},
  {word:'RIVER',category:'GEOGRAPHY',hint:'Flowing body of water'},
  {word:'TIGER',category:'ANIMALS',hint:'Striped big cat'},
  {word:'VAPOR',category:'SCIENCE',hint:'Gas form of a liquid'},
  {word:'WALTZ',category:'DANCE',hint:'A ballroom dance'},
  {word:'YACHT',category:'VEHICLES',hint:'A luxury sailing boat'},
  {word:'ZEBRA',category:'ANIMALS',hint:'Striped African animal'},
  {word:'ABYSS',category:'GEOGRAPHY',hint:'A deep dark chasm'},
  {word:'FABLE',category:'LITERATURE',hint:'A moral story'},
  {word:'GAVEL',category:'TOOLS',hint:'A judges hammer'},
  {word:'HASTE',category:'MOVEMENT',hint:'Hurrying urgently'},
  {word:'KARMA',category:'PHILOSOPHY',hint:'What goes around comes around'},
  {word:'NOBLE',category:'TRAITS',hint:'Having high moral qualities'},
  {word:'PIXEL',category:'TECHNOLOGY',hint:'Smallest screen element'},
  {word:'REALM',category:'GEOGRAPHY',hint:'A kingdom or domain'},
  {word:'SNARE',category:'TOOLS',hint:'A trap for animals'},
  {word:'TABOO',category:'CULTURE',hint:'A forbidden act'},
  {word:'VIGIL',category:'ACTIONS',hint:'A watchful waiting'},
  {word:'WRATH',category:'EMOTIONS',hint:'Intense anger'},
  {word:'YEARN',category:'EMOTIONS',hint:'To desire strongly'},
  {word:'CEDAR',category:'TREES',hint:'An evergreen conifer'},
  {word:'DRIFT',category:'MOVEMENT',hint:'To float slowly'},
  {word:'EMBER',category:'ELEMENTS',hint:'A glowing piece of coal'},
  {word:'FLOCK',category:'ANIMALS',hint:'A group of birds'},
  {word:'HERON',category:'ANIMALS',hint:'A long-legged wading bird'},
  {word:'KNACK',category:'TRAITS',hint:'A natural skill'},
  {word:'LUNAR',category:'SPACE',hint:'Relating to the moon'},
  {word:'ANVIL',category:'TOOLS',hint:'A metal block for forging'},
  {word:'BRISK',category:'WEATHER',hint:'Pleasantly cold and fresh'},
];

function resetWordSession(){
  wordQueue=[];
  fetchPromise=null;
  usedWords.clear();
  try { sessionStorage.removeItem('wd_used'); } catch(e){}
}

function saveUsedWords(){
  try { sessionStorage.setItem('wd_used', JSON.stringify([...usedWords])); } catch(e){}
}

function loadUsedWords(){
  try {
    const saved = sessionStorage.getItem('wd_used');
    if(saved){ JSON.parse(saved).forEach(w=>usedWords.add(w)); }
  } catch(e){}
}

async function pickWord(){
  // Load persisted used words for this language on first call
  if(usedWords.size===0) loadUsedWords(currentLang);
  // If usedWords grows too large, reset to avoid starving the AI
  if(usedWords.size>40) resetWordSession();

  if(wordQueue.length===0){
    showLoadingState(true);
    await fetchWordsFromAI(6);
    showLoadingState(false);
  } else if(wordQueue.length<=2){
    fetchWordsFromAI(6); // pre-fetch in background
  }
  if(wordQueue.length===0){
    // Last resort: random fallback
    const pool=FALLBACK_WORDS.slice().sort(()=>Math.random()-.5);
    const fb=pool[0];
    usedWords.add(fb.word);
    return fb;
  }
  const pick=wordQueue.shift();
  usedWords.add(pick.word);
  saveUsedWords(currentLang);
  return pick;
}

function fetchWordsFromAI(count=6){
  if(fetchPromise)return fetchPromise;
  const lang=LANGUAGES.find(l=>l.code===currentLang)||LANGUAGES[0];
  fetchPromise=fetch('/api/words',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({lang:currentLang,langName:lang.name,count:count,usedWords:[...usedWords]})
  })
  .then(r=>{if(!r.ok)throw new Error('http '+r.status);return r.json();})
  .then(data=>{
    if(!data.words||!data.words.length) throw new Error('empty');
    // Minimal validation: just check it's 5 chars, letters only (ASCII + extended latin)
    const valid=data.words
      .map(w=>({...w,word:(w.word||'').toUpperCase().trim()}))
      .filter(w=>w.word.length===5&&/^[A-ZÀ-ɏÆØÅ]+$/i.test(w.word));
    const toAdd=valid.length?valid:data.words.map(w=>({...w,word:w.word.toUpperCase().trim()})).filter(w=>w.word.length===5);
    console.log('[words] received='+data.words.length+' valid='+valid.length+' fallback='+!!data.fallback);
    if(toAdd.length) wordQueue.push(...toAdd);
    else throw new Error('all words invalid after filter');
  })
  .catch(e=>{
    console.warn('[words] failed:',e.message,'— using shuffled fallback');
    const pool=FALLBACK_WORDS.slice().sort(()=>Math.random()-.5);
    wordQueue.push(...pool.slice(0,count));
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
  const isBackspace = k==='⌫'||k==='⌫'||k==='Backspace'||k==='DELETE';
  const isEnter     = k==='ENTER'||k==='Enter';
  if(isBackspace){
    if(currentTile>0){currentTile--;currentGuess.pop();const t=document.getElementById(`tile-${currentRow}-${currentTile}`);t.textContent='';t.className='tile';}
  } else if(isEnter){
    submitGuess();
  } else if(k.length===1&&currentTile<COLS){
    currentGuess.push(k);
    const t=document.getElementById(`tile-${currentRow}-${currentTile}`);
    t.textContent=k;t.className='tile filled';
    currentTile++;
  }
}

function submitGuess(){
  if(currentTile<COLS){shakeRow(currentRow);showMessage('NOT ENOUGH LETTERS');return;}
  const guess=currentGuess.join(''),result=evaluateGuess(guess);
  revealRow(currentRow,result);
  if(isMultiplayer)sendToOpponent({type:'row',row:currentRow+1,result:result});
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
  if(isMultiplayer)sendToOpponent({type:'done',won});
  const xpEarned=calcXP(won,currentRow+1,timeLeft,isMultiplayer);
  if(currentUser){
    if(won){currentUser.wins++;currentStreak++;if(currentStreak>currentUser.bestStreak)currentUser.bestStreak=currentStreak;if(timeLeft>45)currentUser.fastWin=true;if(isMultiplayer)currentUser.mpWins++;}
    else{currentUser.losses++;currentStreak=0;}
    const leveledUp=addXP(xpEarned);
    if(leveledUp)showUnlockToast('\uD83C\uDF89 LEVEL UP! Now Level '+leveledUp+'!');
    if(!currentUser.isGuest){
      API.saveProgress({
        won:won, guesses:currentRow, timeLeft:timeLeft,
        xpEarned:xpEarned, lang:currentLang, isMp:isMultiplayer,
        theme:currentUser.theme, level:currentUser.level,
        bestStreak:currentStreak, fastWin:currentUser.fastWin,
        earnedBadges:currentUser.earnedBadges
      }).catch(function(){});
    }
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
    const guessCount = won ? currentRow+1 : (reason==='time' && currentTile===0 && currentRow===0 ? 0 : currentRow+(currentTile>0?1:0));
    document.getElementById('es-guesses').textContent=guessCount;
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
  const langName=LANGUAGES.find(l=>l.code===lang).name;
  el.textContent='Fetching meaning...';
  fetch('/api/meaning',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({word:word,lang:lang,langName:langName})
  }).then(function(r){return r.json();}).then(function(data){
    el.textContent=data.meaning?'Meaning: '+data.meaning:'';
  }).catch(function(){el.textContent='';});
}


async function startSolo() {
  isMultiplayer = false;
  const btn = document.querySelector('[onclick="startSolo()"]');
  if(btn){ btn.textContent='...'; btn.disabled=true; }
  try {
    const pick = await pickWord();
    target = pick.word; category = pick.category; hint = pick.hint;
  } catch(e) {
    const fb = FALLBACK_WORDS[Math.floor(Math.random()*FALLBACK_WORDS.length)];
    target = fb.word; category = fb.category; hint = fb.hint;
  }
  if(btn){ btn.innerHTML='<div class="icon">\uD83C\uDFAE</div><div class="label">Solo Play</div><div class="sub">vs the clock</div>'; btn.disabled=false; }
  launchGame(false);
}

async function newGame() {
  document.getElementById('end-screen').classList.remove('show');

  if (isMultiplayer) {
    if (isHost) {
      // Host picks the word and sends it to the guest
      try {
        const pick = await pickWord();
        target = pick.word; category = pick.category; hint = pick.hint;
      } catch(e) {
        const fb = FALLBACK_WORDS[Math.floor(Math.random()*FALLBACK_WORDS.length)];
        target = fb.word; category = fb.category; hint = fb.hint;
      }
      sendToOpponent({ type: 'start', word: target, category: category, hint: hint });
      launchGame(true);
    } else {
      // Guest waits — host will send a 'start' relay which calls launchGame
      showMessage('Waiting for host to start next round...', 3000);
      document.getElementById('end-screen').classList.remove('show');
    }
    return;
  }

  // Solo mode
  try {
    const pick = await pickWord();
    target = pick.word; category = pick.category; hint = pick.hint;
  } catch(e) {
    const fb = FALLBACK_WORDS[Math.floor(Math.random()*FALLBACK_WORDS.length)];
    target = fb.word; category = fb.category; hint = fb.hint;
  }
  launchGame(false);
}
