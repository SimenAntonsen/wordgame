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
    console.log('No ANTHROPIC_API_KEY set — using fallback words');
    return res.json({ words: getRandomFallbacks(usedWords, count), fallback: true });
  }

  const isEn   = lang === 'en';
  const suffix = isEn ? ' (English)' : ' — real ' + langName + ' words, not translations of English words';
  const prompt = 'Generate ' + count + ' unique 5-letter ' + langName + ' words for a Wordle game.'
    + ' Already used: ' + (usedWords.join(', ') || 'none') + '.'
    + ' Rules: exactly 5 letters, common ' + langName + ' words only, varied categories, no proper nouns.'
    + ' The "hint" and "category" fields must ALWAYS be in English.'
    + ' The "word" field must be in ' + langName + suffix + '.'
    + ' Respond ONLY with a valid JSON array, no markdown, no extra text.'
    + ' Example: [{"word":"BLAZE","category":"ELEMENTS","hint":"A large fierce fire"}]';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Anthropic error:', data);
      return res.json({ words: getRandomFallbacks(usedWords, count), fallback: true });
    }

    const text  = data.content.map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const words = JSON.parse(clean);

    if (!Array.isArray(words) || !words.length) throw new Error('empty');
    res.json({ words });
  } catch (e) {
    console.error('Words route error:', e.message);
    res.json({ words: getRandomFallbacks(usedWords, count), fallback: true });
  }
});

module.exports = router;
