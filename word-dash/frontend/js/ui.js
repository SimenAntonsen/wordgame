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
  const rp = u.rankPoints||1000;
  const tier = getRankTier(rp);
  document.getElementById('menu-avatar').innerHTML=u.username.slice(0,2).toUpperCase()+`<span class="level-badge">${u.level}</span>`;
  document.getElementById('menu-username').textContent=u.username;
  document.getElementById('menu-rank').textContent=getRank(u.level);
  const needed=XP_PER_LEVEL(u.level);
  document.getElementById('menu-xp-bar').style.width=Math.min(100,(u.xp/needed)*100)+'%';
  document.getElementById('menu-xp-label').textContent=u.xp+' / '+needed+' XP - Level '+u.level;
  document.getElementById('g-wins').textContent=u.wins;
  document.getElementById('g-streak').textContent=currentStreak;
  document.getElementById('friends-count-sub').textContent=(u.friends||[]).length+' friends';
  // Update ranked button sub-label
  const rankedSub = document.getElementById('ranked-rp-sub');
  if(rankedSub) rankedSub.textContent = tier.icon+' '+tier.label+' · '+rp+' RP';
  const earned=BADGES.filter(b=>u.earnedBadges.includes(b.id));
  document.getElementById('menu-badges').innerHTML=earned.slice(0,5).map(b=>`<div class="badge earned">${b.label}</div>`).join('');
}

function updateProfileUI(){
  if(!currentUser)return;
  const u=currentUser;
  const rp = u.rankPoints||1000;
  const tier = getRankTier(rp);
  document.getElementById('profile-avatar').innerHTML=u.username.slice(0,2).toUpperCase()+`<span class="level-badge">${u.level}</span>`;
  document.getElementById('profile-username').textContent=u.username;
  document.getElementById('profile-rank-display').textContent=getRank(u.level);
  const needed=XP_PER_LEVEL(u.level);
  document.getElementById('profile-xp-bar').style.width=Math.min(100,(u.xp/needed)*100)+'%';
  document.getElementById('profile-xp-label').textContent=u.xp+' / '+needed+' XP';
  document.getElementById('ps-wins').textContent=u.wins;
  document.getElementById('ps-losses').textContent=u.losses;
  document.getElementById('ps-streak').textContent=u.bestStreak;
  // Rank card
  const tierIcon = document.getElementById('profile-tier-icon');
  const tierLabel = document.getElementById('profile-tier-label');
  const rpBar = document.getElementById('profile-rp-bar');
  const rpLabel = document.getElementById('profile-rp-label');
  if(tierIcon) tierIcon.textContent = tier.icon;
  if(tierLabel){ tierLabel.textContent = tier.label; tierLabel.style.color = tier.color; }
  if(rpBar){ rpBar.style.width = getRankProgressPct(rp)+'%'; rpBar.style.background = tier.color; }
  if(rpLabel) rpLabel.textContent = rp+' RP';
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
  if(!currentUser||currentUser.isGuest){
    list.innerHTML='<div style="text-align:center;padding:20px;color:#606080;font-size:.65rem;letter-spacing:2px;">SIGN IN TO SEE FRIENDS</div>';
    return;
  }
  list.innerHTML='<div style="text-align:center;padding:10px;color:#606080;font-size:.6rem;letter-spacing:1px;">LOADING...</div>';
  API.getFriends().then(function(data){
    var friends = data.friends || [];
    if(!friends.length){
      list.innerHTML='<div style="text-align:center;padding:20px;color:#606080;font-size:.65rem;letter-spacing:2px;">NO FRIENDS YET</div>';
      return;
    }
    list.innerHTML='';
    friends.forEach(function(f){
      var tier = f.rankTier || getRankTier(f.rank_points||1000);
      var lastPlayed = f.last_played ? timeAgo(f.last_played) : 'Never';
      var wl = (f.wins||0)+'W / '+(f.losses||0)+'L';
      var item = document.createElement('div');
      item.className='friend-item friend-item-rich';
      item.innerHTML=
        '<div class="friend-avatar" style="background:'+tier.color+'22;border:2px solid '+tier.color+';">'+f.username.slice(0,2).toUpperCase()+'<span class="level-badge">'+f.level+'</span></div>'+
        '<div class="friend-info" style="flex:1;min-width:0;">'+
          '<div style="display:flex;align-items:center;gap:6px;">'+
            '<span class="friend-name">'+f.username+'</span>'+
            '<span style="font-size:.55rem;color:'+tier.color+';letter-spacing:1px;">'+tier.icon+' '+tier.label+'</span>'+
          '</div>'+
          '<div style="font-size:.58rem;color:#606080;letter-spacing:1px;margin-top:2px;">'+
            getRank(f.level)+' · '+wl+' · '+lastPlayed+
          '</div>'+
        '</div>'+
        '<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">'+
          '<button class="btn sm primary" onclick="challengeFriend(\''+f.username+'\')">⚔ Play</button>'+
          '<button class="btn sm ghost" onclick="removeFriend(\''+f.username+'\')">✕</button>'+
        '</div>';
      list.appendChild(item);
    });
  }).catch(function(){
    list.innerHTML='<div style="text-align:center;padding:20px;color:#f04040;font-size:.6rem;">Failed to load friends</div>';
  });
}

function timeAgo(dateStr){
  var diff = Date.now() - new Date(dateStr).getTime();
  var mins = Math.floor(diff/60000);
  if(mins < 1) return 'Just now';
  if(mins < 60) return mins+'m ago';
  var hrs = Math.floor(mins/60);
  if(hrs < 24) return hrs+'h ago';
  return Math.floor(hrs/24)+'d ago';
}

function challengeFriend(username){
  showScreen('screen-multiplayer');
  setTimeout(function(){ createRoom(); }, 100);
}

function removeFriend(name){
  if(!currentUser||currentUser.isGuest) return;
  API.removeFriend(name).catch(function(){});
  currentUser.friends = (currentUser.friends||[]).filter(function(f){return f!==name;});
  renderFriendsList(); updateMenuUI();
}
