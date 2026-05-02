// api/webhook-messages.js
// Omnichannel Webhook Receiver (Phase 3)
//
// Receives inbound messages from Make/n8n (WeChat, WhatsApp, etc.)
// Matches the sender to a NexusCRM client, generates an AI draft reply,
// and stores the message + draft in the Supabase `messages` table.
//
// POST /api/webhook-messages
// Body: {
//   channel:      'wechat' | 'whatsapp' | 'sms' | 'other'
//   external_id:  string   (platform message ID, for deduplication)
//   sender_name:  string
//   sender_id:    string   (WeChat openid / WhatsApp phone number)
//   content:      string   (message text)
//   timestamp:    string   (ISO 8601, optional)
//   secret:       string   (shared secret for auth)
// }
//
// GET /api/webhook-messages?clientId=xxx&limit=50
// Returns messages for a specific client (for the Inbox UI)
//
// PATCH /api/webhook-messages
// Body: { id, status, ai_draft? }
// Updates message status (e.g., 'approved', 'sent')
//
// Environment variables required:
//   WEBHOOK_SECRET    — shared secret between Make/n8n and this endpoint
//   SB_URL            — Supabase project URL
//   SB_SERVICE_KEY    — Supabase service role key (bypasses RLS)
//   ANTHROPIC_API_KEY — Claude API key

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
};

// ── Supabase helper (server-side, uses service key) ─────────────────────────
const sbFetch = async (path, method = 'GET', body = null) => {
  const SB_URL = process.env.SB_URL || process.env.REACT_APP_SB_URL;
  const SB_KEY = process.env.SB_SERVICE_KEY || process.env.SB_KEY || process.env.REACT_APP_SB_KEY;
  const headers = {
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json',
  };
  if (method === 'POST') headers['Prefer'] = 'return=representation';
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, opts);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Supabase ${method} ${path}: ${res.status} ${errText.slice(0, 200)}`);
  }
  if (method === 'DELETE' || res.status === 204) return null;
  return res.json();
};

// ── Claude AI draft generator ────────────────────────────────────────────────
const generateDraft = async (message, clientContext) => {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return null;

  const systemPrompt = `You are an AI assistant for Ozsky International, a migration agency in Perth, Western Australia.
You help draft replies to client messages received via WeChat and WhatsApp.
Your replies should be:
- Professional but warm and approachable
- In the SAME language as the client's message (Chinese or English)
- Concise (2-4 sentences for simple queries)
- Accurate about visa processes — never make up specific dates or guarantees
- If the query is complex or requires case-specific information, draft a holding reply and flag it for staff review

Client context:
${clientContext || 'No client profile available.'}`;

  const userPrompt = `Client message: "${message}"

Please draft a reply. If this is a simple/routine query (e.g., asking for status update, general timeline question, document checklist), draft a complete reply. If it's complex or requires specific case knowledge, draft a brief acknowledgment and flag it with [NEEDS STAFF REVIEW] at the start.

Return ONLY the draft reply text, nothing else.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
};

// ── Client matcher ────────────────────────────────────────────────────────────
// Tries to find a matching NexusCRM client by:
// 1. Exact phone match
// 2. WeChat ID stored in client profile
// 3. Fuzzy name match (last resort)
const findClient = async (senderName, senderId) => {
  try {
    const clients = await sbFetch('clients?select=id,data');
    if (!clients?.length) return null;

    // Normalise phone: strip spaces, dashes, leading +61 → 0
    const normalisePhone = (p) => (p || '').replace(/[\s\-\(\)]/g, '').replace(/^\+61/, '0');
    const normSenderId = normalisePhone(senderId);

    for (const row of clients) {
      const c = row.data || {};
      // Check phone fields
      const phones = [c.phone, c.mobile, c.altPhone, c.wechatId, c.whatsappNumber]
        .filter(Boolean)
        .map(normalisePhone);
      if (normSenderId && phones.includes(normSenderId)) {
        return { id: row.id, data: c };
      }
      // Check WeChat ID stored in profile
      if (senderId && c.wechatId && c.wechatId === senderId) {
        return { id: row.id, data: c };
      }
    }

    // Fuzzy name match (only if sender_name provided and no ID match)
    if (senderName) {
      const normName = senderName.toLowerCase().replace(/\s+/g, '');
      for (const row of clients) {
        const c = row.data || {};
        const clientName = (c.name || '').toLowerCase().replace(/\s+/g, '');
        if (clientName && clientName.includes(normName.slice(0, 4))) {
          return { id: row.id, data: c };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
};

// ── Build client context string for AI ───────────────────────────────────────
const buildClientContext = (client) => {
  if (!client) return '';
  const c = client.data || {};
  const parts = [];
  if (c.name)     parts.push(`Name: ${c.name}`);
  if (c.visaType) parts.push(`Visa type: ${c.visaType}`);
  if (c.profile?.snapshot) parts.push(`Profile: ${c.profile.snapshot.slice(0, 500)}`);
  return parts.join('\n');
};

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

  // ── GET: fetch messages for Inbox UI ────────────────────────────────────
  if (req.method === 'GET') {
    const { clientId, limit = '50', status } = req.query || {};
    try {
      let path = `messages?select=*&order=created_at.desc&limit=${limit}`;
      if (clientId) path += `&client_id=eq.${clientId}`;
      if (status)   path += `&status=eq.${status}`;
      const msgs = await sbFetch(path);
      return res.json({ messages: msgs || [] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── PATCH: update message status/draft ──────────────────────────────────
  if (req.method === 'PATCH') {
    const { id, status, ai_draft } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing message id' });
    try {
      const update = {};
      if (status)   update.status = status;
      if (ai_draft !== undefined) update.ai_draft = ai_draft;
      await sbFetch(`messages?id=eq.${id}`, 'PATCH', update);
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST: receive inbound message from Make/n8n ──────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  if (WEBHOOK_SECRET) {
    const providedSecret = req.body?.secret || req.headers?.['x-webhook-secret'];
    if (providedSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorised: invalid webhook secret' });
    }
  }

  const {
    channel = 'unknown',
    external_id,
    sender_name,
    sender_id,
    content,
    timestamp,
  } = req.body || {};

  if (!content) return res.status(400).json({ error: 'Missing content' });

  try {
    // Deduplication: check if external_id already exists
    if (external_id) {
      const existing = await sbFetch(`messages?external_id=eq.${encodeURIComponent(external_id)}&select=id`);
      if (existing?.length > 0) {
        return res.json({ ok: true, duplicate: true, id: existing[0].id });
      }
    }

    // Match client
    const client = await findClient(sender_name, sender_id);
    const clientContext = buildClientContext(client);

    // Generate AI draft
    const aiDraft = await generateDraft(content, clientContext);
    const needsReview = aiDraft?.startsWith('[NEEDS STAFF REVIEW]');

    // Insert message into Supabase
    const msgData = {
      client_id:   client?.id || null,
      channel,
      external_id: external_id || null,
      sender_name: sender_name || 'Unknown',
      sender_id:   sender_id || null,
      content,
      direction:   'inbound',
      status:      aiDraft ? 'draft_ready' : 'unread',
      ai_draft:    aiDraft || null,
      needs_review: needsReview || !aiDraft,
      created_at:  timestamp || new Date().toISOString(),
    };

    const inserted = await sbFetch('messages', 'POST', msgData);
    const msgId = inserted?.[0]?.id || inserted?.id;

    return res.json({
      ok: true,
      id: msgId,
      clientMatched: !!client,
      clientName: client?.data?.name || null,
      draftGenerated: !!aiDraft,
      needsReview,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
