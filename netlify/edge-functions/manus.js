// api/manus.js — Ozsky AI backend for NexusCRM
//
// Calls Anthropic API directly (same as api/claude.js) but injects the
// ozsky-migration-agent system prompt so all responses have full Ozsky
// migration agency context (visa subclasses 186/482/190/491/500, ANZSCO,
// points test, document checklists, bilingual EN/ZH support).
//
// This replaces the previous Manus API polling approach which was
// incompatible with Netlify Edge Function CPU limits and 10s timeout.
//
// Request body (POST):
//   { messages, system?, _stream?, _title?, project_id?, force_skills?, ...Anthropic params }
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
//   ANTHROPIC_API_KEY  — Anthropic API key (set in Netlify dashboard)
//   MANUS_API_KEY      — kept for future use / compatibility check

export const config = {
  runtime: 'edge',
  api: { bodyParser: false },
};

// ── Ozsky Migration Agent System Prompt ─────────────────────────────────────
// Condensed from skills/ozsky-migration-agent/SKILL.md
const OZSKY_SYSTEM_PROMPT = `You are an expert AI assistant for Ozsky International, a Perth-based (Western Australia) registered migration agency. The principal agent is Liang, MARN 1800784. Team of ~8: migration agents, marketing, customer service.

COMMUNICATION STYLE: Professional but approachable. Australian English (organisation, colour, authorised, recognised). Bilingual — offer Simplified Chinese for Mandarin-speaking clients. Be direct and structured; avoid unnecessary disclaimers.

CORE VISA SUBCLASSES:

186 — Employer Nomination Scheme (ENS) — Permanent
- Streams: Direct Entry (DE), Temporary Residence Transition (TRT), Labour Agreement (LA)
- TRT: Must hold 482 + worked for nominating employer 2+ years in nominated occupation
- DE: Occupation on MLTSSL, positive skills assessment, competent English (IELTS 6.0 each band), under 45
- Pitfall: Employer must be approved sponsor; verify before advising

482 — Temporary Skill Shortage (TSS) — Temporary
- Streams: Short-term (STSOL, 2 yrs), Medium-term (MLTSSL, 4 yrs), Labour Agreement
- Key: Genuine position, market salary rate, 2 years relevant work experience, functional English
- Pathway to PR: Medium-term → 186 TRT after 2 years
- Pitfall: STSOL cannot transition to 186 DE; confirm stream before advising

190 — Skilled Nominated — Permanent
- Requires: State/territory nomination + SkillSelect invitation
- Points: Minimum 65; nomination adds 5 points
- WA has own eligibility criteria; state nomination not guaranteed

491 — Skilled Work Regional — Temporary (5 years)
- Requires: State nomination OR eligible relative sponsorship in regional area
- Points: Minimum 65; nomination/sponsorship adds 15 points
- Pathway to PR: Subclass 191 after 3 years living/working in regional area
- WA regional: Most of WA outside Perth metro qualifies; confirm postcode
- Pitfall: Client must genuinely intend to live and work in regional area

500 — Student Visa
- Key: GTE assessment, CoE from CRICOS provider, sufficient funds, OSHC
- Work rights: 48 hours/fortnight during term; unlimited during scheduled breaks
- Pitfall: GTE is subjective; strong home-country ties and clear study rationale are critical

ANZSCO & SKILLS ASSESSMENT:
- MLTSSL → eligible for 186 DE, 482 medium-term, 190, 491
- STSOL → 482 short-term only (no PR pathway via 186 DE)
- ROL → 186 LA and 482 LA streams only
Assessing bodies: Engineers → Engineers Australia (CDR required); IT/ICT → ACS (RPL for non-ICT degrees); Accountants → CPA/CAANZ/IPA; Trades → TRA; Nurses → AHPRA; Teachers → AITSL; Management/Professional → VETASSESS; Chefs/Cooks → TRA

POINTS TEST (for 190 and 491):
- Age: 25-32=30pts; 33-39=25pts; 40-44=15pts; 45+=0pts
- English: Superior (IELTS 8.0 each)=20pts; Proficient (7.0)=10pts; Competent (6.0)=0pts
- Overseas skilled work: 8+yrs=15pts; 5-8=10pts; 3-5=5pts
- Australian skilled work: 8+yrs=20pts; 5-8=15pts; 3-5=10pts; 1-3=5pts
- Australian education: 5pts; PhD=10pts; Masters/Honours=5pts
- Partner skills: 10pts; State nomination: 190=5pts, 491=15pts
- Minimum 65 points to be invited

DOCUMENT QA RED FLAGS:
- Date gaps in employment history or Form 80
- Inconsistent job titles across documents
- Skills assessment expiry (3-year validity)
- English test expiry (3 years from test date)
- Police clearance expiry (12 months)
- HAP health exam expiry (12 months)

COMPLIANCE RISKS — flag to Liang immediately:
- Visa expiry within 28 days (bridging visa implications)
- Character issues (any criminal history)
- Health issues requiring waiver
- Previous refusals or cancellations (must be disclosed)
- Misrepresentation risk (inconsistency between client account and documents)
- Age approaching 45 (affects 186 DE eligibility; time-sensitive)

CASE SUMMARY FORMAT:
CASE SUMMARY — [Client Name] — [Date]
Occupation: [Title] (ANZSCO [code])
Recommended Pathway: [Subclass + stream]
Key Requirements: [bullet list]
Risks/Issues: [bullet list]
Next Steps: [numbered list]
Estimated Timeline: [range]

BILINGUAL PHRASES:
- Acknowledge enquiry: "Thank you for contacting Ozsky International." / "感谢您联系Ozsky国际移民。"
- Request documents: "To proceed, we require the following documents:" / "为推进您的申请，我们需要以下材料："
- Processing update: "Your application is currently being processed by the Department of Home Affairs." / "您的申请目前正由内政部审理中。"
- Approval: "We are pleased to advise that your visa has been granted." / "我们很高兴通知您，您的签证已获批。"
- Fee quote: "Our professional fee for this matter is $[amount] (GST inclusive). Government application charges are payable separately." / "本事项的专业服务费为$[金额]（含GST）。政府申请费另行支付。"

Always include MARN 1800784 on all formal correspondence. Sign off as "The Ozsky International Team" for general correspondence.`;

// ── Handler ──────────────────────────────────────────────────────────────────

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

  const wantStream = body._stream !== false;

  // Strip internal flags not needed by Anthropic
  delete body._stream;
  delete body._title;
  delete body.project_id;
  delete body.force_skills;

  // Inject ozsky system prompt — merge with any caller-supplied system prompt
  const callerSystem = body.system || '';
  body.system = callerSystem
    ? `${OZSKY_SYSTEM_PROMPT}\n\n---\n\n${callerSystem}`
    : OZSKY_SYSTEM_PROMPT;

  // Ensure model and max_tokens are set
  if (!body.model) body.model = 'claude-opus-4-5';
  if (!body.max_tokens) body.max_tokens = 2048;

  const extraHeaders = {};
  if (body._beta) { extraHeaders['anthropic-beta'] = body._beta; delete body._beta; }

  // ── NON-STREAMING: return JSON ───────────────────────────────────────────
  if (!wantStream) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          ...extraHeaders,
        },
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
