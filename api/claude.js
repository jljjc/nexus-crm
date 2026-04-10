// api/claude.js  —  Vercel Edge Function: pure SSE pipe to Anthropic
//
// WHY STREAMING PIPE:
//   Accumulating the full response in Edge hits wall-clock timeout on Hobby plan.
//   Instead we pipe Anthropic's SSE stream DIRECTLY to the client — the Edge
//   function just relays bytes and stays alive with zero CPU budget while waiting.
//   The client reads SSE events and assembles the text itself.
//
// Response format: text/event-stream (SSE)
//   data: {"type":"delta","text":"..."}   — incremental text chunk
//   data: {"type":"done","text":"<full>"}  — final assembled text
//   data: {"type":"error","message":"..."}
//
// Environment variable: ANTHROPIC_API_KEY  (set in Vercel dashboard)

export const config = {
  runtime: 'edge',
  api: { bodyParser: false },
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // If client requests plain JSON (non-streaming), fall back to old behaviour
  const wantStream = body._stream !== false;
  const extraHeaders = {};
  if (body._beta) { extraHeaders['anthropic-beta'] = body._beta; delete body._beta; }
  delete body._stream;

  // ── NON-STREAMING fallback (for small/fast calls) ────────────────────────
  if (!wantStream) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', ...extraHeaders },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      return new Response(JSON.stringify(data), {
        status: r.status, headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // ── STREAMING: pipe Anthropic SSE → client SSE ──────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            ...extraHeaders,
          },
          body: JSON.stringify({ ...body, stream: true }),
        });

        if (!anthropicRes.ok) {
          let errData;
          try { errData = await anthropicRes.json(); } catch { errData = { error: `Anthropic ${anthropicRes.status}` }; }
          send({ type: 'error', message: errData?.error?.message || errData?.error || `Anthropic error ${anthropicRes.status}` });
          controller.close();
          return;
        }

        const reader = anthropicRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === '[DONE]') continue;

            try {
              const ev = JSON.parse(raw);
              if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
                const chunk = ev.delta.text || '';
                fullText += chunk;
                send({ type: 'delta', text: chunk });
              } else if (ev.type === 'error') {
                throw new Error(ev.error?.message || 'Anthropic stream error');
              }
            } catch (parseErr) {
              if (parseErr.message?.includes('stream error')) throw parseErr;
            }
          }
        }

        // Final event with complete assembled text
        send({ type: 'done', text: fullText });
        controller.close();

      } catch (err) {
        send({ type: 'error', message: err.message || 'Internal server error' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
