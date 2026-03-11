const express = require('express');
const router  = express.Router();

const FALLBACK_WORDS = [
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
  {word:'MOTIF',category:'ART',hint:'A repeated design element'},
  {word:'NOBLE',category:'TRAITS',hint:'Having high moral qualities'},
  {word:'PIXEL',category:'TECHNOLOGY',hint:'Smallest screen element'},
  {word:'QUILL',category:'TOOLS',hint:'A feather used for writing'},
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
  {word:'INDEX',category:'BOOKS',hint:'A reference list'},
  {word:'KNACK',category:'TRAITS',hint:'A natural skill'},
  {word:'LUNAR',category:'SPACE',hint:'Relating to the moon'},
  {word:'ANVIL',category:'TOOLS',hint:'A metal block for forging'},
  {word:'BRISK',category:'WEATHER',hint:'Pleasantly cold and fresh'},
];

// Server-side memory of recently generated words per language
// Prevents the AI from repeating words across different users/sessions
const serverUsedWords = {}; // { lang: Set<string> }
const MAX_SERVER_MEMORY = 200;

function getServerUsed(lang) {
  if (!serverUsedWords[lang]) serverUsedWords[lang] = new Set();
  return serverUsedWords[lang];
}

function addToServerMemory(lang, words) {
  const mem = getServerUsed(lang);
  words.forEach(w => mem.add(w.toUpperCase()));
  // Trim if too large - remove oldest entries
  if (mem.size > MAX_SERVER_MEMORY) {
    const arr = [...mem];
    arr.slice(0, arr.length - MAX_SERVER_MEMORY).forEach(w => mem.delete(w));
  }
}

function getRandomFallbacks(usedWords, count) {
  const used = new Set((usedWords || []).map(w => w.toUpperCase()));
  const available = FALLBACK_WORDS.filter(w => !used.has(w.word));
  const pool = available.length >= count ? available : [...FALLBACK_WORDS];
  return pool.sort(() => Math.random() - 0.5).slice(0, count);
}

router.post('/', async (req, res) => {
  const { lang = 'en', langName = 'English', count = 6, usedWords = [] } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.log('[words] No ANTHROPIC_API_KEY — using fallback words');
    return res.json({ words: getRandomFallbacks(usedWords, count), fallback: true });
  }
  console.log('[words] Fetching AI words, lang=' + lang + ' count=' + count);

  const isEn = lang === 'en';
  // Merge client-sent usedWords with server memory for this language
  const serverMem = [...getServerUsed(lang)];
  const allUsed = [...new Set([...usedWords.map(w => w.toUpperCase()), ...serverMem])];
  console.log('[words] usedWords from client=' + usedWords.length + ' server_memory=' + serverMem.length);

  const buildPrompt = (needed, alreadyUsed) => {
    const usedStr = alreadyUsed.length ? alreadyUsed.join(', ') : 'none';
    return 'Generate exactly ' + needed + ' words for a Wordle-style game. Language: ' + langName + '.\n\n'
      + 'RULES — every rule is mandatory, breaking any rule means the word is INVALID:\n'
      + '1. EXACTLY 5 letters. Before submitting each word, count its letters one by one.\n'
      + '2. Must be a REAL ' + langName + ' word that exists in a ' + langName + ' dictionary.\n'
      + (isEn ? '' : '3. Write the word IN ' + langName.toUpperCase() + ' script — do NOT translate to English.\n')
      + '4. No proper nouns, no abbreviations, no word fragments, no made-up words.\n'
      + '5. NEVER repeat these already-used words: ' + usedStr + '\n'
      + '6. Use varied categories — avoid overusing: huset, vann, lys, tid, kjærlighet, house, water, light, time.\n'
      + '7. Hints and categories must be in English.\n\n'
      + 'Self-check example for Norwegian:\n'
      + '  FJORD → F(1)J(2)O(3)R(4)D(5) = 5 letters, real Norwegian word ✓\n'
      + '  KJÆRL → K(1)J(2)Æ(3)R(4)L(5) = 5 letters BUT not a real word ✗ REJECT\n'
      + '  HUSET → real word but ALREADY USED ✗ REJECT\n\n'
      + 'Respond ONLY with a raw JSON array, no markdown, no explanation:\n'
      + '[{"word":"WORD1","category":"CATEGORY","hint":"Short English hint"}]';
  };

  const callAI = async (prompt) => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error('Anthropic HTTP ' + response.status + ': ' + JSON.stringify(data));
    const text = data.content.map(b => b.text || '').join('');
    const match = text.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (!match) throw new Error('No JSON array in response: ' + text.slice(0, 120));
    return JSON.parse(match[0]);
  };

  const validateWords = (raw) =>
    raw
      .map(w => ({ ...w, word: (w.word || '').toUpperCase().replace(/[^A-Z\u00C0-\u024F]/g, '') }))
      .filter(w => w.word.length === 5 && w.category && w.hint);

  try {
    // First pass — ask for all words
    const raw1 = await callAI(buildPrompt(count, allUsed));
    let valid = validateWords(raw1);
    console.log('[words] Pass 1: AI returned ' + raw1.length + ', valid: ' + valid.length);

    // Second pass — if any words failed validation, ask for replacements
    if (valid.length < count) {
      const need = count - valid.length;
      const nowUsed = [...allUsed, ...valid.map(w => w.word)];
      console.log('[words] Pass 2: need ' + need + ' replacements');
      try {
        const raw2 = await callAI(buildPrompt(need, nowUsed));
        const valid2 = validateWords(raw2);
        console.log('[words] Pass 2: AI returned ' + raw2.length + ', valid: ' + valid2.length);
        valid = [...valid, ...valid2];
      } catch (e2) {
        console.warn('[words] Pass 2 failed:', e2.message);
      }
    }

    // If we still don't have enough, pad with fallbacks
    if (!valid.length) throw new Error('No valid words from AI after 2 passes');
    if (valid.length < count) {
      const fallbackPad = getRandomFallbacks([...allUsed, ...valid.map(w => w.word)], count - valid.length);
      valid = [...valid, ...fallbackPad];
      console.log('[words] Padded with ' + fallbackPad.length + ' fallback words');
    }

    // Save to server memory
    addToServerMemory(lang, valid.map(w => w.word));
    console.log('[words] Final: ' + valid.length + ' words sent to client');
    res.json({ words: valid.slice(0, count) });

  } catch (e) {
    console.error('[words] Error:', e.message, '— using fallback');
    res.json({ words: getRandomFallbacks(usedWords, count), fallback: true });
  }
});

module.exports = router;
