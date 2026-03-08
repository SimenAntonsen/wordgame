const express = require('express');
const router  = express.Router();

// POST /api/words  — proxy to Anthropic, keeps API key server-side
// Body: { lang, langName, count, usedWords }
router.post('/', async (req, res) => {
  const { lang = 'en', langName = 'English', count = 6, usedWords = [] } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ error: 'AI word generation not configured' });
  }

  const alreadyUsed = usedWords.join(', ') || 'none';
  const isEn = lang === 'en';
  const prompt = `Generate ${count} unique 5-letter ${langName} words for a Wordle game. `
    + `Already used: ${alreadyUsed}. `
    + `Rules: exactly 5 letters, common ${langName} words only, varied categories, no proper nouns. `
    + `The "hint" and "category" fields must ALWAYS be in English. `
    + `The "word" field must be in ${langName}`
    + (isEn ? ' (English)' : ` — real ${langName} words, not translations of English words`)
    + `. Respond ONLY with a valid JSON array, no markdown, no extra text. `
    + `Example: [{"word":"BLAZE","category":"ELEMENTS","hint":"A large fierce fire"}]`;

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
      return res.status(502).json({ error: 'AI error', detail: data });
    }

    const text  = data.content.map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const words = JSON.parse(clean);

    res.json({ words });
  } catch (e) {
    console.error('Words route error:', e);
    res.status(500).json({ error: 'Failed to generate words' });
  }
});

module.exports = router;
