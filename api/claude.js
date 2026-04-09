// api/claude.js  —  Vercel Serverless Function (proxy for Anthropic API)
//
// Uses Node.js runtime with maxDuration:60 (set in vercel.json) to handle
// long Claude responses (snapshot generation, PDF analysis, etc.)
//
// Environment variable: ANTHROPIC_API_KEY  (set in Vercel dashboard)

export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in Vercel environment variables' });
  }

  try {
    const body = req.body;

    const extraHeaders = {};
    if (body._beta) {
      extraHeaders['anthropic-beta'] = body._beta;
      delete body._beta;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
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
