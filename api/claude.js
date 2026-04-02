// api/claude.js  —  Vercel Serverless Function (proxy for Anthropic API)
// Place this file at:  /api/claude.js  in your project root (NOT inside /src)
//
// Then add your API key in Vercel dashboard:
//   Project Settings → Environment Variables → ANTHROPIC_API_KEY

export const config = {
  api: {
    bodyParser: { sizeLimit: '8mb' },
  },
};

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in Vercel environment variables' });
  }

  try {
    const body = { ...req.body };
    const extraHeaders = {};
    // Forward PDF beta flag when document blocks are included
    if (body._beta) { extraHeaders['anthropic-beta'] = body._beta; delete body._beta; }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':         'application/json',
        'x-api-key':            apiKey,
        'anthropic-version':    '2023-06-01',
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
