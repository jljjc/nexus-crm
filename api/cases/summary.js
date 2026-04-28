// api/cases/summary.js — Vercel Edge Function
// GET /api/cases/summary
// 从 jobs 表的 JSONB data 字段按签证子类汇总案件总数和待处理数

export const config = { runtime: 'edge' };

const CLOSED_STATUSES = ['Approved', 'Refused', 'Closed', 'Withdrawn'];

// "Subclass 491 – Skilled Regional (State)" → "491"
function extractSubclass(type = '') {
  const m = type.match(/Subclass\s+(\d+)/i);
  return m ? m[1] : type;
}

export default async function handler(req) {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)
    return json({ error: 'Supabase env vars not configured' }, 500);

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?select=data`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });
    if (!res.ok) return json({ error: await res.text() }, res.status);

    const rows = await res.json();
    const summary = {};

    for (const row of rows) {
      const d   = row.data ?? {};
      const sub = extractSubclass(d.type);
      if (!summary[sub]) summary[sub] = { subclass: sub, type: d.type ?? sub, total: 0, active: 0 };
      summary[sub].total++;
      if (!CLOSED_STATUSES.includes(d.status)) summary[sub].active++;
    }

    return json(Object.values(summary), 200);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
