// api/meetings.js
// Voice Pipeline → NexusCRM Meeting Records API (Phase 4)
//
// Receives structured meeting data from the local voice pipeline,
// stores it in Supabase, and returns meeting records for the Meetings UI.
//
// POST /api/meetings   — create a meeting record (from voice pipeline)
// GET  /api/meetings   — fetch meeting records (for Meetings UI)
// GET  /api/meetings?id=xxx — fetch single meeting with full transcript
//
// Environment variables required:
//   SB_URL            — Supabase project URL
//   SB_SERVICE_KEY    — Supabase service role key
//   CRM_API_KEY       — Optional shared secret for pipeline auth

// ── Supabase helper ──────────────────────────────────────────────────────────
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

// ── ID generator ─────────────────────────────────────────────────────────────
const uid = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Optional API key auth (for pipeline → CRM calls)
  const CRM_API_KEY = process.env.CRM_API_KEY;
  if (CRM_API_KEY && req.method === 'POST') {
    const provided = req.headers?.['x-api-key'] || req.body?.api_key;
    if (provided !== CRM_API_KEY) {
      return res.status(401).json({ error: 'Unauthorised' });
    }
  }

  // ── GET: fetch meetings ──────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { id, client_name, case_id, limit = '50', offset = '0' } = req.query || {};
    try {
      if (id) {
        // Single meeting with full transcript
        const rows = await sbFetch(`meetings?id=eq.${id}&select=*`);
        return res.json(rows?.[0] || null);
      }
      let path = `meetings?select=id,client_name,client_name_en,meeting_type,date,channel,summary,sentiment,follow_up_date,action_items,risk_flags,case_type,case_id,tags,created_at&order=created_at.desc&limit=${limit}&offset=${offset}`;
      if (client_name) path += `&client_name=ilike.*${encodeURIComponent(client_name)}*`;
      if (case_id)     path += `&case_id=eq.${encodeURIComponent(case_id)}`;
      const rows = await sbFetch(path);
      return res.json({ meetings: rows || [], total: rows?.length || 0 });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST: create meeting from voice pipeline ─────────────────────────────
  if (req.method === 'POST') {
    const data = req.body || {};

    // Validate required fields
    if (!data.summary && !data.raw_transcript) {
      return res.status(400).json({ error: 'Missing summary or raw_transcript' });
    }

    try {
      // Try to match client_id from clients table
      let client_id = null;
      if (data.client_name || data.client_phone || data.client_wechat) {
        try {
          const clients = await sbFetch('clients?select=id,data');
          if (clients?.length) {
            for (const row of clients) {
              const c = row.data || {};
              const nameMatch = data.client_name && (
                (c.name || '').includes(data.client_name) ||
                data.client_name.includes(c.name || '')
              );
              const phoneMatch = data.client_phone && (
                (c.phone || '').replace(/\s/g, '') === data.client_phone.replace(/\s/g, '') ||
                (c.mobile || '').replace(/\s/g, '') === data.client_phone.replace(/\s/g, '')
              );
              const wechatMatch = data.client_wechat && c.wechatId === data.client_wechat;
              if (nameMatch || phoneMatch || wechatMatch) {
                client_id = row.id;
                break;
              }
            }
          }
        } catch { /* client match is best-effort */ }
      }

      const meeting = {
        id:                   uid(),
        client_id,
        client_name:          data.client_name          || null,
        client_name_en:       data.client_name_en       || null,
        client_phone:         data.client_phone         || null,
        client_wechat:        data.client_wechat        || null,
        meeting_type:         data.meeting_type         || 'client_call',
        date:                 data.date                 || new Date().toISOString().slice(0, 10),
        channel:              data.channel              || 'phone',
        language:             data.language             || 'zh',
        duration_estimate:    data.duration_estimate    || null,
        case_type:            data.case_type            || null,
        case_id:              data.case_id              || null,
        occupation:           data.occupation           || null,
        anzsco_code:          data.anzsco_code          || null,
        summary:              data.summary              || '',
        key_points:           data.key_points           || [],
        client_concerns:      data.client_concerns      || [],
        action_items:         data.action_items         || [],
        documents_requested:  data.documents_requested  || [],
        follow_up_date:       data.follow_up_date       || null,
        follow_up_topic:      data.follow_up_topic      || null,
        risk_flags:           data.risk_flags           || [],
        sentiment:            data.sentiment            || 'neutral',
        tags:                 data.tags                 || [],
        raw_transcript:       data.raw_transcript       || null,
        obsidian_note_path:   data.obsidian_note_path   || null,
        created_at:           new Date().toISOString(),
      };

      const inserted = await sbFetch('meetings', 'POST', meeting);
      const savedMeeting = inserted?.[0] || inserted;

      // Also create tasks in the jobs/tasks system if action_items exist
      let tasks_created = 0;
      if (data.action_items?.length > 0) {
        for (const item of data.action_items) {
          try {
            const task = {
              id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
              title: item.task,
              assignee: item.assignee || 'Liang',
              due_date: item.due_date || null,
              priority: item.priority || 'medium',
              status: 'todo',
              source: 'voice_pipeline',
              meeting_id: meeting.id,
              client_id,
              client_name: data.client_name || null,
              case_id: data.case_id || null,
              created_at: new Date().toISOString(),
            };
            await sbFetch('voice_tasks', 'POST', task);
            tasks_created++;
          } catch { /* task creation is best-effort */ }
        }
      }

      return res.status(201).json({
        success: true,
        id: meeting.id,
        client_matched: !!client_id,
        tasks_created,
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── PATCH: update meeting (e.g., mark follow-up done) ───────────────────
  if (req.method === 'PATCH') {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: 'Missing id' });
    try {
      const updates = { ...req.body, updated_at: new Date().toISOString() };
      await sbFetch(`meetings?id=eq.${id}`, 'PATCH', updates);
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
