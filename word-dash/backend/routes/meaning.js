const express = require('express');
const router  = express.Router();

// POST /api/meaning — get English meaning of a foreign word
router.post('/', async (req, res) => {
  const { word, langName } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || !word || !langName) {
    return res.json({ meaning: '' });
  }

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
        max_tokens: 80,
        messages: [{
          role:    'user',
          content: 'What does the ' + langName + ' word "' + word + '" mean in English? Reply with ONLY a short one-sentence definition, no preamble.',
        }],
      }),
    });

    const data = await response.json();
    const meaning = (data.content || []).map(b => b.text || '').join('').trim();
    res.json({ meaning: meaning || '' });
  } catch (e) {
    res.json({ meaning: '' });
  }
});

module.exports = router;
