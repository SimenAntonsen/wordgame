// keyboard.js — keyboard layout and key state rendering

function buildKeyboard(){
  // Base rows
  const base=[
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['ENTER','Z','X','C','V','B','N','M','⌫']
  ];

  // Language extra key insertions: each entry is [letter, row, insertAfter]
  const layouts={
    'no':[['Å',0,'P'], ['Ø',1,'L'], ['Æ',1,'Ø']],
    'da':[['Å',0,'P'], ['Ø',1,'L'], ['Æ',1,'Ø']],
    'sv':[['Å',0,'P'], ['Ä',1,'L'], ['Ö',1,'K']],
    'de':[['Ü',0,'P'], ['Ä',1,'L'], ['Ö',1,'K'], ['ß',2,'M']],
    'fi':[['Ä',1,'L'], ['Ö',1,'K']],
    'es':[['Ñ',1,'L']],
    'fr':[['É',0,'P'], ['È',1,'L'], ['À',1,'K'], ['Ç',2,'M'], ['Ù',2,'N'], ['Ê',0,'O'], ['Î',0,'I'], ['Ô',0,'O'], ['Œ',1,'J']],
    'it':[['À',1,'L'], ['È',1,'K'], ['É',0,'P'], ['Ì',0,'I'], ['Ò',0,'O'], ['Ù',0,'U']],
    'pt':[['Ã',0,'P'], ['Á',0,'Q'], ['Ç',1,'L'], ['Ê',0,'E'], ['Ô',0,'O'], ['Ó',0,'O'], ['Ú',0,'U'], ['Õ',0,'O']],
    'nl':[['IJ',1,'L'], ['Ë',0,'E'], ['Ï',0,'I'], ['Ó',0,'O'], ['Ú',0,'U']],
    'pl':[['Ą',0,'Q'], ['Ę',0,'E'], ['Ó',0,'O'], ['Ś',0,'P'], ['Ź',2,'Z'], ['Ż',2,'Z'], ['Ć',1,'L'], ['Ł',1,'A'], ['Ń',1,'L']],
    'ro':[['Ă',0,'Q'], ['Â',0,'Q'], ['Î',0,'I'], ['Ș',1,'L'], ['Ț',2,'M']],
    'tr':[['Ğ',0,'G'], ['İ',0,'I'], ['Ş',1,'L'], ['Ç',1,'K'], ['Ö',0,'O'], ['Ü',0,'U']]
  };

  // Clone base rows
  const rows=base.map(function(r){return r.slice();});

  // Insert extra letters for current language
  const insertions=layouts[currentLang]||[];
  insertions.forEach(function(ins){
    const letter=ins[0],rowIdx=ins[1],after=ins[2];
    const row=rows[rowIdx];
    const pos=row.indexOf(after);
    if(pos!==-1){
      // Only add if not already in row
      if(row.indexOf(letter)===-1) row.splice(pos+1,0,letter);
    } else {
      if(row.indexOf(letter)===-1) row.push(letter);
    }
  });

  // Build DOM
  const kb=document.getElementById('keyboard');kb.innerHTML='';
  rows.forEach(function(keys){
    const row=document.createElement('div');row.className='key-row';
    keys.forEach(function(k){
      const isExtra=insertions.some(function(i){return i[0]===k;});
      const btn=document.createElement('div');
      btn.className='key'+(k.length>1&&k!=='IJ'?' wide':'')+(isExtra?' lang-key':'');
      btn.textContent=k;btn.id='key-'+k;
      btn.addEventListener('click',function(){handleKey(k);});
      row.appendChild(btn);
    });
    kb.appendChild(row);
  });
}

function updateKeyboard(){Object.entries(keyStates).forEach(([k,state])=>{const el=document.getElementById(`key-${k}`);if(el)el.className=el.className.replace(/correct|present|absent/g,'').trim()+' '+state;});}

