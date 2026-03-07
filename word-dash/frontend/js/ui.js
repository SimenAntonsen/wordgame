// ui.js — screens, menus, themes, language picker

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(id==='screen-menu'){updateMenuUI();updateLangPickerUI();}
  if(id==='screen-profile')updateProfileUI();
  if(id==='screen-friends')renderFriendsList();
  if(id==='screen-themes')renderThemes();
  if(id==='screen-multiplayer')renderChallengeFriends();
}

function applyTheme(themeId){
  const t=THEMES.find(x=>x.id===themeId)||THEMES[0];
  document.body.className=t.cls;
  if(currentUser){currentUser.theme=themeId;if(!currentUser.isGuest)saveUser(currentUser);}
}

function renderThemes(){
  const grid=document.getElementById('themes-grid');
  const level=currentUser?currentUser.level:1;
  const active=currentUser?(currentUser.theme||'default'):'default';
  grid.innerHTML=THEMES.map(function(t){
    const locked=level<t.reqLevel,isActive=t.id===active;
    const sw=t.colors.map(function(c){return '<div class="theme-swatch" style="background:'+c+'"></div>';}).join('');
    const oc=locked?"":"applyTheme('"+t.id+"');renderThemes()";
    const bc=t.colors[0];
    return '<div class="theme-card '+(isActive?'active':'')+' '+(locked?'theme-locked':'')+' "'
      +' style="background:'+bc+'22;border-color:'+(isActive?bc:'transparent')+';"'
      +' onclick="'+oc+'">'
      +'<div class="theme-preview">'+sw+'</div>'
      +'<div class="theme-name" style="color:'+(locked?'#444':bc)+'">'+t.name+'</div>'
      +'<div class="theme-req">'+(locked?'Lvl '+t.reqLevel+' unlock':(isActive?'Active':'Tap to apply'))+'</div></div>';
  }).join('');
}

function updateMenuUI(){
  if(!currentUser)return;
  updateLangPickerUI();
  const u=currentUser;
  document.getElementById('menu-avatar').innerHTML=u.username.slice(0,2).toUpperCase()+`<span class="level-badge">${u.level}</span>`;
  document.getElementById('menu-username').textContent=u.username;
  document.getElementById('menu-rank').textContent=getRank(u.level);
  const needed=XP_PER_LEVEL(u.level);
  document.getElementById('menu-xp-bar').style.width=Math.min(100,(u.xp/needed)*100)+'%';
  document.getElementById('menu-xp-label').textContent=u.xp+' / '+needed+' XP - Level '+u.level;
  document.getElementById('g-wins').textContent=u.wins;
  document.getElementById('g-streak').textContent=currentStreak;
  document.getElementById('friends-count-sub').textContent=(u.friends||[]).length+' friends';
  const earned=BADGES.filter(b=>u.earnedBadges.includes(b.id));
  document.getElementById('menu-badges').innerHTML=earned.slice(0,5).map(b=>`<div class="badge earned">${b.label}</div>`).join('');
}

function updateProfileUI(){
  if(!currentUser)return;
  const u=currentUser;
  document.getElementById('profile-avatar').innerHTML=u.username.slice(0,2).toUpperCase()+`<span class="level-badge">${u.level}</span>`;
  document.getElementById('profile-username').textContent=u.username;
  document.getElementById('profile-rank-display').textContent=getRank(u.level);
  const needed=XP_PER_LEVEL(u.level);
  document.getElementById('profile-xp-bar').style.width=Math.min(100,(u.xp/needed)*100)+'%';
  document.getElementById('profile-xp-label').textContent=u.xp+' / '+needed+' XP';
  document.getElementById('ps-wins').textContent=u.wins;
  document.getElementById('ps-losses').textContent=u.losses;
  document.getElementById('ps-streak').textContent=u.bestStreak;
  document.getElementById('profile-badges').innerHTML=BADGES.map(b=>`<div class="badge ${u.earnedBadges.includes(b.id)?'earned':''}">${b.label}</div>`).join('');
}

function setLanguage(code){
  currentLang=code;
  wordQueue=[];fetchPromise=null;usedWords=new Set();
  if(currentUser){currentUser.lang=code;if(!currentUser.isGuest)saveUser(currentUser);}
  updateMenuUI();
  showMessage('Language: '+( LANGUAGES.find(l=>l.code===code)||{name:'English'}).name,1400);
}

function toggleLangDropdown(){
  const dd=document.getElementById('lang-dropdown');
  if(!dd.classList.contains('open')){renderLangDropdown();}
  dd.classList.toggle('open');
}

function renderLangDropdown(){
  const dd=document.getElementById('lang-dropdown');
  dd.innerHTML='';
  LANGUAGES.forEach(function(l){
    const isActive=l.code===currentLang;
    const item=document.createElement('div');
    item.className='lang-option'+(isActive?' active':'');
    item.onclick=function(){setLanguage(l.code);dd.classList.remove('open');};
    item.innerHTML=flagImg(l.cc)
      +'<span class="lang-option-name">'+l.name+'</span>'
      +'<span class="lang-option-note">'+l.note+'</span>';
    dd.appendChild(item);
  });
}

function updateLangPickerUI(){
  const lang=LANGUAGES.find(function(l){return l.code===currentLang;})||LANGUAGES[0];
  document.getElementById('lang-flag').innerHTML=flagImg(lang.cc);
  document.getElementById('lang-name').textContent=lang.name;
}

function addFriend(){
  const input=document.getElementById('add-friend-input');
  const msg=document.getElementById('add-friend-msg');
  const name=input.value.trim().toLowerCase();
  if(!name)return;
  if(!currentUser||currentUser.isGuest){msg.style.color='#f04040';msg.textContent='Guests cannot add friends.';return;}
  if(name===currentUser.username.toLowerCase()){msg.style.color='#f04040';msg.textContent="That's you!";return;}
  if(!getUser(name)){msg.style.color='#f04040';msg.textContent='User not found.';return;}
  if((currentUser.friends||[]).includes(name)){msg.style.color='#f04040';msg.textContent='Already friends.';return;}
  currentUser.friends=currentUser.friends||[];currentUser.friends.push(name);saveUser(currentUser);
  msg.style.color='#40e06a';msg.textContent='Added '+name+'!';input.value='';renderFriendsList();updateMenuUI();
}

function renderFriendsList(){
  const list=document.getElementById('friends-list');
  const friends=currentUser?(currentUser.friends||[]):[];
  if(!friends.length){list.innerHTML='<div style="font-size:.62rem;color:#606080;letter-spacing:1px;text-align:center;padding:20px;">No friends yet === add some!</div>';return;}
  list.innerHTML=friends.map(f=>{
    const fu=getUser(f);const rank=fu?getRank(fu.level):'?';const lvl=fu?fu.level:'?';
    return`<div class="friend-item">
      <div class="friend-avatar">${f.slice(0,2).toUpperCase()}</div>
      <div class="friend-info"><div class="friend-name">${fu?fu.username:f}</div><div class="friend-rank">Lv.${lvl} ? ${rank}</div></div>
      <div style="display:flex;gap:6px;">
        <button class="btn sm" onclick="showScreen('screen-multiplayer')">⚔</button>
        <button class="btn sm danger" onclick="removeFriend('${f}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

function removeFriend(name){currentUser.friends=(currentUser.friends||[]).filter(f=>f!==name);saveUser(currentUser);renderFriendsList();updateMenuUI();}

function renderChallengeFriends(){
  const card=document.getElementById('friend-challenge-card');
  const list=document.getElementById('challenge-friends-list');
  const friends=currentUser&&!currentUser.isGuest?(currentUser.friends||[]):[];
  if(!friends.length){card.style.display='none';return;}
  card.style.display='block';
  list.innerHTML=friends.map(f=>{
    const fu=getUser(f);
    return`<div class="friend-item">
      <div class="friend-avatar">${f.slice(0,2).toUpperCase()}</div>
      <div class="friend-info"><div class="friend-name">${fu?fu.username:f}</div><div class="friend-rank">Lv.${fu?fu.level:'?'}</div></div>
      <button class="btn sm primary" onclick="createRoom()">⚔ Challenge</button>
    </div>`;
  }).join('');
}

