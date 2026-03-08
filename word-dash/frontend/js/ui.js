// ui.js — screens, menus, themes, language picker

function showScreen(id){
  document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});
  var el = document.getElementById(id);
  if(el) el.classList.add('active');
  if(id==='screen-menu')      { updateMenuUI(); updateLangPickerUI(); }
  if(id==='screen-profile')     updateProfileUI();
  if(id==='screen-friends')     renderFriendsList();
  if(id==='screen-themes')      renderThemes();
  if(id==='screen-multiplayer') renderChallengeFriends();
  if(id==='screen-leaderboard') renderLeaderboard();
}

function applyTheme(themeId){
  const t=THEMES.find(x=>x.id===themeId)||THEMES[0];
  document.body.className=t.cls;
  if(currentUser){currentUser.theme=themeId;if(!currentUser.isGuest)API.saveSettings({theme:themeId}).catch(function(){});}
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
  if(currentUser){currentUser.lang=code;if(!currentUser.isGuest)API.saveSettings({lang:code}).catch(function(){});}
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
  var name = (document.getElementById('add-friend-input').value||'').trim();
  var msg  = document.getElementById('add-friend-msg');
  if(!name){msg.style.color='#f04040';msg.textContent='Enter a username.';return;}
  if(!currentUser||currentUser.isGuest){msg.style.color='#f04040';msg.textContent='Sign in to add friends.';return;}
  msg.style.color='#808098';msg.textContent='Adding...';
  API.addFriend(name).then(function(data){
    currentUser.friends = currentUser.friends||[];
    if(!currentUser.friends.includes(name.toLowerCase())) currentUser.friends.push(name.toLowerCase());
    msg.style.color='var(--correct)';msg.textContent='Friend added!';
    document.getElementById('add-friend-input').value='';
    renderFriendsList();updateMenuUI();
  }).catch(function(e){
    msg.style.color='#f04040';msg.textContent=e.message||'User not found.';
  });
}

function renderFriendsList(){
  var list = document.getElementById('friends-list');
  if(!list) return;
  var friends = currentUser ? (currentUser.friends||[]) : [];
  if(!friends.length){
    list.innerHTML='<div style="text-align:center;padding:20px;color:#606080;font-size:.65rem;letter-spacing:2px;">NO FRIENDS YET</div>';
    return;
  }
  list.innerHTML='';
  friends.forEach(function(f){
    var item=document.createElement('div');
    item.className='friend-item';
    item.innerHTML='<div class="friend-avatar">'+f.slice(0,2).toUpperCase()+'</div>'
      +'<div class="friend-info"><div class="friend-name">'+f+'</div></div>';
    var btn=document.createElement('button');
    btn.className='btn sm ghost';btn.textContent='✕';
    btn.onclick=function(){removeFriend(f);};
    item.appendChild(btn);
    list.appendChild(item);
  });
}

function removeFriend(name){
  if(!currentUser||currentUser.isGuest) return;
  API.removeFriend(name).catch(function(){});
  currentUser.friends = (currentUser.friends||[]).filter(function(f){return f!==name;});
  renderFriendsList(); updateMenuUI();
}

function renderChallengeFriends(){
  var card=document.getElementById('friend-challenge-card');
  var list=document.getElementById('challenge-friends-list');
  if(!card||!list) return;
  var friends=currentUser?(currentUser.friends||[]):[];
  if(!friends.length){card.style.display='none';return;}
  card.style.display='block';
  list.innerHTML='';
  friends.forEach(function(f){
    var item=document.createElement('div');
    item.className='friend-item';
    item.innerHTML='<div class="friend-avatar">'+f.slice(0,2).toUpperCase()+'</div>'
      +'<div class="friend-info"><div class="friend-name">'+f+'</div></div>';
    var btn=document.createElement('button');
    btn.className='btn sm primary';btn.textContent='⚔ Challenge';
    btn.onclick=function(){showScreen('screen-multiplayer');};
    item.appendChild(btn);
    list.appendChild(item);
  });
}

