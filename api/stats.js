// api/stats.js — Vercel Edge Function
// GET /api/stats
// 从 jobs / clients / appointments 表统计仪表盘数字

export const config = { runtime: 'edge' };

const CLOSED_STATUSES   = ['Approved', 'Refused', 'Closed', 'Withdrawn'];
const PENDING_STATUSES  = ['Awaiting Decision', 'In Progress', 'Submitted', 'Pending'];
const DOCS_STATUS       = 'Docs Required';

export default async function handler(req) {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)
    return json({ error: 'Supabase env vars not configured' }, 500);

  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    Prefer: 'count=exact',
  };

  const base = SUPABASE_URL + '/rest/v1';

  // 本月起始
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weekStart  = new Date(now.getTime() - 7 * 86400000).toISOString();
  const weekEnd    = new Date(now.getTime() + 7 * 86400000).toISOString();

  try {
    // 拉 jobs 全量（JSONB 无法用 Supabase filter 直接过滤 data 内部字段）
    const [jobsRes, clientsRes, apptRes] = await Promise.all([
      fetch(`${base}/jobs?select=data`, { headers }),
      // clients 用 data->>'createdAt' 也是 JSONB，同样拉全量
      fetch(`${base}/clients?select=data`, { headers }),
      fetch(`${base}/appointments?select=data`, { headers }),
    ]);

    const [jobs, clients, appointments] = await Promise.all([
      jobsRes.ok    ? jobsRes.json()    : [],
      clientsRes.ok ? clientsRes.json() : [],
      apptRes.ok    ? apptRes.json()    : [],
    ]);

    // 本月新客户
    const newClientsThisMonth = clients.filter(r => {
      const d = r.data ?? {};
      return d.createdAt && new Date(d.createdAt) >= new Date(monthStart);
    }).length;

    // 待处理申请
    const pendingApplications = jobs.filter(r =>
      PENDING_STATUSES.includes(r.data?.status)
    ).length;

    // 文件待补充
    const docsNeeded = jobs.filter(r =>
      r.data?.status === DOCS_STATUS
    ).length;

    // 本周约谈
    const appointmentsThisWeek = appointments.filter(r => {
      const d  = r.data ?? {};
      const dt = d.date ?? d.appointmentDate ?? d.datetime ?? '';
      if (!dt) return false;
      const t = new Date(dt).getTime();
      return t >= new Date(weekStart).getTime() && t <= new Date(weekEnd).getTime();
    }).length;

    return json({ newClientsThisMonth, pendingApplications, docsNeeded, appointmentsThisWeek }, 200);
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
