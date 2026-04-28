// api/cases/deadlines.js — Vercel Edge Function
// GET /api/cases/deadlines
// 从 jobs 表的 JSONB data 字段返回未来 30 天内截止的案件

export const config = { runtime: 'edge' };

const CLOSED_STATUSES = ['Approved', 'Refused', 'Closed', 'Withdrawn'];

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
    // 拉全部 active 案件（数量有限，前端再过滤日期）
    const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?select=data`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });
    if (!res.ok) return json({ error: await res.text() }, res.status);

    const rows = await res.json();
    const now   = Date.now();
    const in30  = now + 30 * 24 * 60 * 60 * 1000;

    const deadlines = rows
      .map(row => row.data ?? {})
      .filter(d => {
        if (!d.dueDate) return false;
        if (CLOSED_STATUSES.includes(d.status)) return false;
        const t = new Date(d.dueDate).getTime();
        return t >= now && t <= in30;
      })
      .map(d => {
        const daysLeft = Math.ceil((new Date(d.dueDate).getTime() - now) / 86400000);
        return {
          caseId:   d.id,
          title:    d.title,
          subclass: extractSubclass(d.type),
          status:   d.status,
          dueDate:  d.dueDate,
          priority: d.priority,
          daysLeft,
          type: daysLeft <= 3 ? 'danger' : daysLeft <= 7 ? 'warning' : 'info',
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 8);

    return json(deadlines, 200);
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
