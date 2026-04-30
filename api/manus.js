// api/manus.js — Manus API backend for NexusCRM
//
// Replaces direct Anthropic calls in api/claude.js.
// Uses Manus task.create + task.listMessages polling to generate AI responses.
//
// Request body (POST):
//   { messages, project_id?, force_skills?, _stream?, _title?, ...ignored }
//
// Response modes:
//   _stream !== false  → text/event-stream SSE
//     data: {"type":"delta","text":"..."}
//     data: {"type":"done","text":"<full>"}
//     data: {"type":"error","message":"..."}
//   _stream === false  → application/json (Anthropic-compatible shape)
//     { content: [{ type: "text", text: "..." }] }
//
// Environment variables:
//   MANUS_API_KEY   — Manus API key (set in Netlify/Vercel dashboard)
//   OZSKY_SKILL_ID  — ozsky-migration-agent skill ID (default: TL28qGY3nbvMVFyvNASG8u)

export const config = {
  runtime: 'edge',
  api: { bodyParser: false },
};

const MANUS_BASE = 'https://api.manus.ai';
const OZSKY_SKILL_ID = 'TL28qGY3nbvMVFyvNASG8u';
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 80; // 80 × 1.5s = 2 minutes max

// Convert Anthropic-style messages array to a single prompt string for Manus
function messagesToPrompt(messages) {
  if (!Array.isArray(messages)) return String(messages || '');
  return messages
    .map(m => {
      const role = m.role === 'assistant' ? 'Assistant' : 'User';
      const content = Array.isArray(m.content)
        ? m.content.map(c => (c.type === 'text' ? c.text : '')).join('\n')
        : String(m.content || '');
      return `${role}: ${content}`;
    })
    .join('\n\n');
}

// Sleep helper
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Poll task.listMessages until stopped/error, return final text
async function pollTask(taskId, apiKey, onChunk) {
  let cursor = null;
  let fullText = '';
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    attempts++;
    const url = new URL(`${MANUS_BASE}/v2/task.listMessages`);
    url.searchParams.set('task_id', taskId);
    url.searchParams.set('order', 'asc');
    url.searchParams.set('limit', '50');
    if (cursor) url.searchParams.set('cursor', cursor);

    const r = await fetch(url.toString(), {
      headers: { 'x-manus-api-key': apiKey },
    });
    if (!r.ok) throw new Error(`Manus listMessages error ${r.status}`);
    const data = await r.json();
    if (!data.ok) throw new Error(data.error?.message || 'Manus API error');

    const messages = data.messages || [];
    let agentStatus = null;

    for (const msg of messages) {
      if (msg.type === 'status_update') {
        agentStatus = msg.status_update?.agent_status;
      } else if (msg.type === 'assistant_message') {
        const chunk = msg.assistant_message?.content || '';
        if (chunk && !fullText.includes(chunk)) {
          const newPart = chunk.slice(fullText.length);
          if (newPart && onChunk) onChunk(newPart);
          fullText = chunk;
        }
      }
    }

    if (data.has_more) {
      cursor = data.next_cursor;
      continue;
    }

    if (agentStatus === 'stopped') return fullText;
    if (agentStatus === 'error') throw new Error('Manus task failed');

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error('Manus task timed out after 2 minutes');
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.MANUS_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'MANUS_API_KEY not configured' }),
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

  const wantStream = body._stream !== false;
  const projectId = body.project_id || null;
  const forceSkills = body.force_skills || [OZSKY_SKILL_ID];
  const taskTitle = body._title || 'NexusCRM AI Task';
  const prompt = messagesToPrompt(body.messages);

  // Build task.create payload
  const taskPayload = {
    title: taskTitle,
    hide_in_task_list: true,
    interactive_mode: false,
    message: {
      content: prompt,
      force_skills: forceSkills,
    },
  };
  if (projectId) taskPayload.project_id = projectId;

  // ── NON-STREAMING: create task, poll, return JSON ────────────────────────
  if (!wantStream) {
    try {
      const createRes = await fetch(`${MANUS_BASE}/v2/task.create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-manus-api-key': apiKey },
        body: JSON.stringify(taskPayload),
      });
      const createData = await createRes.json();
      if (!createData.ok) throw new Error(createData.error?.message || `Manus create error ${createRes.status}`);
      const taskId = createData.task_id;

      const fullText = await pollTask(taskId, apiKey, null);

      // Return Anthropic-compatible shape so existing callers (CaseAI, SmartAI) work unchanged
      return new Response(JSON.stringify({
        content: [{ type: 'text', text: fullText }],
        model: 'manus-1.6',
        stop_reason: 'end_turn',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // ── STREAMING: create task, poll, emit SSE chunks ────────────────────────
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        const createRes = await fetch(`${MANUS_BASE}/v2/task.create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-manus-api-key': apiKey },
          body: JSON.stringify(taskPayload),
        });
        const createData = await createRes.json();
        if (!createData.ok) throw new Error(createData.error?.message || `Manus create error ${createRes.status}`);
        const taskId = createData.task_id;

        const fullText = await pollTask(taskId, apiKey, (chunk) => {
          send({ type: 'delta', text: chunk });
        });

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
