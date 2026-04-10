// api/claude.js  —  Vercel Edge Function with Anthropic streaming
//
// WHY EDGE + STREAMING:
//   • Node.js Serverless: 10 s wall-clock hard limit on Hobby plan
//   • Edge Runtime:       CPU-time budget, NOT wall-clock — I/O waiting
//     (streaming tokens from Anthropic) doesn't consume CPU budget
//   • Result: Claude can take 25-40 s to generate a long response and
//     the function stays alive the whole time, no 504 timeout
//
// The function streams internally from Anthropic and returns the complete
// response as standard JSON — no client-side changes required.
//
// Environment variable: ANTHROPIC_API_KEY  (set in Vercel dashboard)

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured in Vercel environment variables' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const extraHeaders = {};
  if (body._beta) {
    extraHeaders['anthropic-beta'] = body._beta;
    delete body._beta;
  }

  try {
    // ── Request Anthropic with streaming enabled ───────────────────────────
    // Streaming keeps the Edge function alive while tokens arrive.
    // CPU usage during await is near-zero so the budget isn't consumed.
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        ...extraHeaders,
      },
      body: JSON.stringify({ ...body, stream: true }),
    });

    // ── Non-OK response — return error JSON immediately ────────────────────
    if (!anthropicRes.ok) {
      let errData;
      try { errData = await anthropicRes.json(); }
      catch { errData = { error: `Anthropic returned ${anthropicRes.status}` }; }
      return new Response(JSON.stringify(errData), {
        status: anthropicRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Read SSE stream, accumulate full text ──────────────────────────────
    const reader  = anthropicRes.body.getReader();
    const decoder = new TextDecoder();
    let fullText    = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process all complete lines in the buffer
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep the incomplete last line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;

        try {
          const ev = JSON.parse(raw);
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
            fullText += ev.delta.text || '';
          } else if (ev.type === 'message_start') {
            inputTokens = ev.message?.usage?.input_tokens || 0;
          } else if (ev.type === 'message_delta') {
            outputTokens = ev.usage?.output_tokens || 0;
          } else if (ev.type === 'error') {
            throw new Error(ev.error?.message || 'Anthropic stream error');
          }
        } catch (parseErr) {
          // Skip malformed SSE lines (partial chunks etc.)
          if (parseErr.message?.includes('Anthropic stream error')) throw parseErr;
        }
      }
    }

    // ── Return assembled response in standard Anthropic messages format ────
    return new Response(
      JSON.stringify({
        content: [{ type: 'text', text: fullText }],
        usage:   { input_tokens: inputTokens, output_tokens: outputTokens },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
