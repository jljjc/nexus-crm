/**
 * Meetings.jsx — Voice Pipeline Meeting Log
 * Phase 4: Omnichannel + Voice Pipeline integration
 *
 * Shows all meeting records created by the voice pipeline.
 * Features: meeting list, detail panel, action items, transcript, Supabase SQL guide.
 */
import React, { useState, useEffect, useCallback } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────
const MEETING_TYPE_LABELS = {
  client_call:   '📞 客户通话',
  team_meeting:  '👥 团队会议',
  enquiry:       '💬 初步咨询',
  consultation:  '🗂 正式咨询',
  followup:      '🔄 跟进通话',
};
const CHANNEL_LABELS = {
  phone:     '电话',
  wechat:    'WeChat',
  zoom:      'Zoom',
  in_person: '面谈',
  whatsapp:  'WhatsApp',
};
const SENTIMENT_COLORS = {
  positive:  { bg: '#D1FAE5', text: '#065F46', label: '😊 积极' },
  neutral:   { bg: '#E2E8F0', text: '#374151', label: '😐 中性' },
  concerned: { bg: '#FEF3C7', text: '#92400E', label: '😟 担忧' },
  urgent:    { bg: '#FEE2E2', text: '#991B1B', label: '🚨 紧急' },
};
const PRIORITY_COLORS = {
  high:   { bg: '#FEE2E2', text: '#991B1B' },
  medium: { bg: '#FEF3C7', text: '#92400E' },
  low:    { bg: '#D1FAE5', text: '#065F46' },
};

const SUPABASE_SQL = `-- Run this in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  client_id TEXT, client_name TEXT, client_name_en TEXT,
  meeting_type TEXT DEFAULT 'client_call',
  date DATE, channel TEXT DEFAULT 'phone', language TEXT DEFAULT 'zh',
  duration_estimate TEXT, case_type TEXT, case_id TEXT,
  summary TEXT,
  key_points JSONB DEFAULT '[]',
  client_concerns JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',
  documents_requested JSONB DEFAULT '[]',
  follow_up_date DATE, follow_up_topic TEXT,
  risk_flags JSONB DEFAULT '[]',
  sentiment TEXT DEFAULT 'neutral',
  tags JSONB DEFAULT '[]',
  raw_transcript TEXT,
  obsidian_note_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS voice_tasks (
  id TEXT PRIMARY KEY, title TEXT NOT NULL,
  assignee TEXT, due_date DATE, priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'todo', meeting_id TEXT,
  client_id TEXT, client_name TEXT, case_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE meetings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON meetings    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON voice_tasks FOR ALL USING (true) WITH CHECK (true);`;

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return d; }
}
function safeArr(v) { return Array.isArray(v) ? v : (v ? [v] : []); }

// ── Sub-components ────────────────────────────────────────────────────────────
function Badge({ label, bg, color }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg || '#E2E8F0', color: color || '#374151', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function ActionItemRow({ item, onToggle }) {
  const p = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--ink-100)' }}>
      <input type="checkbox" checked={item.done || false} onChange={() => onToggle && onToggle(item)}
        style={{ marginTop: 3, accentColor: 'var(--brand)', cursor: 'pointer', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: item.done ? 'var(--ink-400)' : 'var(--ink-800)', textDecoration: item.done ? 'line-through' : 'none', lineHeight: 1.4 }}>
          {item.task}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          {item.assignee && <Badge label={`@${item.assignee}`} bg="var(--brand-mid)" color="var(--brand)" />}
          {item.due_date && <Badge label={`📅 ${item.due_date}`} bg="#EFF6FF" color="#1D4ED8" />}
          <Badge label={item.priority || 'medium'} bg={p.bg} color={p.text} />
        </div>
      </div>
    </div>
  );
}

function MeetingCard({ m, selected, onClick }) {
  const sent = SENTIMENT_COLORS[m.sentiment] || SENTIMENT_COLORS.neutral;
  const typeLabel = MEETING_TYPE_LABELS[m.meeting_type] || m.meeting_type || '通话';
  const actionCount = safeArr(m.action_items).length;
  const riskCount = safeArr(m.risk_flags).length;
  return (
    <div onClick={onClick} style={{
      padding: '12px 14px', borderRadius: 'var(--r-md)', cursor: 'pointer', marginBottom: 6,
      background: selected ? 'var(--brand-mid)' : 'var(--surface-0)',
      border: `1.5px solid ${selected ? 'var(--brand)' : 'var(--ink-200)'}`,
      transition: 'all var(--t-fast)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-800)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.client_name || '未知客户'}
        </div>
        <Badge label={sent.label} bg={sent.bg} color={sent.text} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 3 }}>
        {typeLabel} · {CHANNEL_LABELS[m.channel] || m.channel} · {formatDate(m.date)}
      </div>
      {m.summary && (
        <div style={{ fontSize: 12, color: 'var(--ink-600)', marginTop: 5, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {m.summary}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        {m.case_type && <Badge label={`${m.case_type} 签证`} bg="#EFF6FF" color="#1D4ED8" />}
        {actionCount > 0 && <Badge label={`${actionCount} 个任务`} bg="#F0FDF4" color="#166534" />}
        {riskCount > 0 && <Badge label={`⚠ ${riskCount} 个风险`} bg="#FEF3C7" color="#92400E" />}
        {m.follow_up_date && <Badge label={`跟进 ${m.follow_up_date}`} bg="var(--brand-light)" color="var(--brand)" />}
      </div>
    </div>
  );
}

function MeetingDetail({ meeting, onClose, onActionToggle }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const sent = SENTIMENT_COLORS[meeting.sentiment] || SENTIMENT_COLORS.neutral;
  const actionItems = safeArr(meeting.action_items);
  const keyPoints = safeArr(meeting.key_points);
  const concerns = safeArr(meeting.client_concerns);
  const risks = safeArr(meeting.risk_flags);
  const docs = safeArr(meeting.documents_requested);
  const tags = safeArr(meeting.tags);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ink-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink-900)' }}>
            {meeting.client_name || '未知客户'}
            {meeting.client_name_en && <span style={{ fontWeight: 400, color: 'var(--ink-500)', marginLeft: 8, fontSize: 14 }}>{meeting.client_name_en}</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>{MEETING_TYPE_LABELS[meeting.meeting_type] || meeting.meeting_type}</span>
            <span>·</span>
            <span>{CHANNEL_LABELS[meeting.channel] || meeting.channel}</span>
            <span>·</span>
            <span>{formatDate(meeting.date)}</span>
            {meeting.duration_estimate && <><span>·</span><span>{meeting.duration_estimate}</span></>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge label={sent.label} bg={sent.bg} color={sent.text} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-400)', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {/* Meta badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {meeting.case_type && <Badge label={`${meeting.case_type} 签证`} bg="#EFF6FF" color="#1D4ED8" />}
          {meeting.case_id && <Badge label={`案件 ${meeting.case_id}`} bg="#F5F3FF" color="#5B21B6" />}
          {meeting.anzsco_code && <Badge label={`ANZSCO ${meeting.anzsco_code}`} bg="#F0FDF4" color="#166534" />}
          {meeting.language && <Badge label={meeting.language === 'zh' ? '中文' : meeting.language === 'en' ? 'English' : '中英混合'} bg="var(--ink-100)" color="var(--ink-600)" />}
          {tags.map((t, i) => <Badge key={i} label={t} bg="var(--ink-100)" color="var(--ink-600)" />)}
        </div>

        {/* Summary */}
        {meeting.summary && (
          <section style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>摘要</h4>
            <p style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.6, background: 'var(--surface-1)', padding: '10px 12px', borderRadius: 'var(--r-sm)', borderLeft: '3px solid var(--brand)' }}>
              {meeting.summary}
            </p>
          </section>
        )}

        {/* Key points */}
        {keyPoints.length > 0 && (
          <section style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>关键要点</h4>
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              {keyPoints.map((p, i) => <li key={i} style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.5, marginBottom: 4 }}>{p}</li>)}
            </ul>
          </section>
        )}

        {/* Client concerns */}
        {concerns.length > 0 && (
          <section style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>客户关切</h4>
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              {concerns.map((c, i) => <li key={i} style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.5, marginBottom: 4 }}>{c}</li>)}
            </ul>
          </section>
        )}

        {/* Risk flags */}
        {risks.length > 0 && (
          <section style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>⚠ 风险标记</h4>
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 'var(--r-sm)', padding: '10px 12px' }}>
              {risks.map((r, i) => <div key={i} style={{ fontSize: 13, color: '#92400E', lineHeight: 1.5, marginBottom: i < risks.length - 1 ? 4 : 0 }}>• {r}</div>)}
            </div>
          </section>
        )}

        {/* Action items */}
        {actionItems.length > 0 && (
          <section style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Action Items ({actionItems.filter(a => !a.done).length} 待办)
            </h4>
            {actionItems.map((item, i) => (
              <ActionItemRow key={i} item={item} onToggle={() => onActionToggle && onActionToggle(meeting, i)} />
            ))}
          </section>
        )}

        {/* Documents requested */}
        {docs.length > 0 && (
          <section style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>需要客户提供的材料</h4>
            {docs.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13, color: 'var(--ink-700)' }}>
                <span style={{ color: 'var(--ink-400)' }}>□</span> {d}
              </div>
            ))}
          </section>
        )}

        {/* Follow-up */}
        {(meeting.follow_up_date || meeting.follow_up_topic) && (
          <section style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>跟进计划</h4>
            <div style={{ background: 'var(--brand-light)', border: '1px solid var(--brand-glow)', borderRadius: 'var(--r-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--ink-700)' }}>
              {meeting.follow_up_date && <div>📅 <strong>{meeting.follow_up_date}</strong></div>}
              {meeting.follow_up_topic && <div style={{ marginTop: 4 }}>{meeting.follow_up_topic}</div>}
            </div>
          </section>
        )}

        {/* Raw transcript toggle */}
        {meeting.raw_transcript && (
          <section style={{ marginBottom: 16 }}>
            <button onClick={() => setShowTranscript(v => !v)} style={{
              background: 'none', border: '1px solid var(--ink-200)', borderRadius: 'var(--r-sm)',
              padding: '6px 12px', fontSize: 12, color: 'var(--ink-500)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {showTranscript ? '▲' : '▼'} {showTranscript ? '收起' : '展开'}原始转录文字
            </button>
            {showTranscript && (
              <pre style={{ marginTop: 8, padding: '12px', background: 'var(--ink-900)', color: '#94A3B8', borderRadius: 'var(--r-sm)', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 300, overflowY: 'auto' }}>
                {meeting.raw_transcript}
              </pre>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Meetings({ lang = 'zh' }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showSQLGuide, setShowSQLGuide] = useState(false);
  const [sqlCopied, setSQLCopied] = useState(false);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/meetings?limit=100');
      if (!res.ok) {
        if (res.status === 500) {
          // Likely table doesn't exist yet
          setError('table_missing');
          setMeetings([]);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setMeetings(data.meetings || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const handleActionToggle = useCallback((meeting, itemIndex) => {
    setMeetings(prev => prev.map(m => {
      if (m.id !== meeting.id) return m;
      const items = safeArr(m.action_items).map((a, i) => i === itemIndex ? { ...a, done: !a.done } : a);
      // Persist to API (best-effort)
      fetch(`/api/meetings?id=${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action_items: items }) }).catch(() => {});
      return { ...m, action_items: items };
    }));
    if (selected?.id === meeting.id) {
      setSelected(prev => {
        const items = safeArr(prev.action_items).map((a, i) => i === itemIndex ? { ...a, done: !a.done } : a);
        return { ...prev, action_items: items };
      });
    }
  }, [selected]);

  const copySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL).then(() => {
      setSQLCopied(true);
      setTimeout(() => setSQLCopied(false), 2000);
    });
  };

  // Filter
  const filtered = meetings.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || (m.client_name || '').toLowerCase().includes(q) || (m.summary || '').toLowerCase().includes(q) || (m.case_id || '').toLowerCase().includes(q);
    const matchType = filterType === 'all' || m.meeting_type === filterType;
    return matchSearch && matchType;
  });

  // Stats
  const totalActions = meetings.reduce((s, m) => s + safeArr(m.action_items).filter(a => !a.done).length, 0);
  const upcomingFollowUps = meetings.filter(m => m.follow_up_date && new Date(m.follow_up_date) >= new Date()).length;
  const riskMeetings = meetings.filter(m => safeArr(m.risk_flags).length > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface-1)' }}>
      {/* Top bar */}
      <div style={{ background: 'var(--surface-0)', borderBottom: '1px solid var(--ink-200)', padding: '14px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>🎙 沟通记录</h2>
            <p style={{ fontSize: 12, color: 'var(--ink-500)', margin: '2px 0 0' }}>语音管道自动生成的通话记录与 Action Items</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setShowSQLGuide(v => !v)} style={{
              padding: '6px 12px', borderRadius: 'var(--r-sm)', fontSize: 12, fontWeight: 600,
              background: showSQLGuide ? 'var(--brand-mid)' : 'var(--surface-2)',
              color: showSQLGuide ? 'var(--brand)' : 'var(--ink-600)',
              border: `1px solid ${showSQLGuide ? 'var(--brand-glow)' : 'var(--ink-200)'}`,
              cursor: 'pointer',
            }}>
              🗄 Supabase 建表 SQL
            </button>
            <button onClick={fetchMeetings} style={{
              padding: '6px 12px', borderRadius: 'var(--r-sm)', fontSize: 12, fontWeight: 600,
              background: 'var(--surface-2)', color: 'var(--ink-600)', border: '1px solid var(--ink-200)', cursor: 'pointer',
            }}>
              ↻ 刷新
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: '总记录', value: meetings.length, color: 'var(--ink-700)' },
            { label: '待办任务', value: totalActions, color: totalActions > 0 ? '#D97706' : 'var(--ink-400)' },
            { label: '待跟进', value: upcomingFollowUps, color: upcomingFollowUps > 0 ? 'var(--brand)' : 'var(--ink-400)' },
            { label: '有风险', value: riskMeetings, color: riskMeetings > 0 ? '#DC2626' : 'var(--ink-400)' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SQL Guide panel */}
      {showSQLGuide && (
        <div style={{ background: '#0B1120', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '14px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8' }}>在 Supabase SQL Editor 中运行以下 SQL 创建 meetings 和 voice_tasks 表：</span>
            <button onClick={copySQL} style={{
              padding: '4px 12px', borderRadius: 'var(--r-sm)', fontSize: 12, fontWeight: 600,
              background: sqlCopied ? '#10B981' : 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer',
            }}>
              {sqlCopied ? '✓ 已复制' : '复制 SQL'}
            </button>
          </div>
          <pre style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5, overflowX: 'auto', maxHeight: 200, margin: 0, fontFamily: 'JetBrains Mono, monospace' }}>
            {SUPABASE_SQL}
          </pre>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: list */}
        <div style={{ width: selected ? 340 : '100%', minWidth: selected ? 280 : undefined, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: selected ? '1px solid var(--ink-200)' : 'none', background: 'var(--surface-1)', overflow: 'hidden', transition: 'width 0.2s ease' }}>
          {/* Search + filter */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--ink-200)', background: 'var(--surface-0)', flexShrink: 0 }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索客户名、摘要、案件号..."
              style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--ink-200)', fontSize: 13, color: 'var(--ink-700)', background: 'var(--surface-1)', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {[['all', '全部'], ['client_call', '客户通话'], ['enquiry', '咨询'], ['followup', '跟进'], ['team_meeting', '团队']].map(([v, l]) => (
                <button key={v} onClick={() => setFilterType(v)} style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: filterType === v ? 'var(--brand)' : 'var(--surface-2)',
                  color: filterType === v ? '#fff' : 'var(--ink-500)',
                  border: `1px solid ${filterType === v ? 'var(--brand)' : 'var(--ink-200)'}`,
                }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
            {loading && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-400)', fontSize: 13 }}>加载中...</div>
            )}
            {!loading && error === 'table_missing' && (
              <div style={{ textAlign: 'center', padding: 30 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🗄</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6 }}>尚未创建数据表</div>
                <div style={{ fontSize: 12, color: 'var(--ink-400)', lineHeight: 1.5 }}>
                  点击上方"Supabase 建表 SQL"按钮，<br />复制 SQL 并在 Supabase 中运行。
                </div>
                <button onClick={() => setShowSQLGuide(true)} style={{ marginTop: 12, padding: '7px 16px', borderRadius: 'var(--r-sm)', background: 'var(--brand)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  查看建表 SQL
                </button>
              </div>
            )}
            {!loading && !error && filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 30 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🎙</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6 }}>
                  {meetings.length === 0 ? '暂无沟通记录' : '没有符合条件的记录'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-400)', lineHeight: 1.5 }}>
                  {meetings.length === 0
                    ? '启动语音管道，录音文件处理后会自动出现在这里。'
                    : '试试清除搜索条件。'}
                </div>
              </div>
            )}
            {!loading && !error && filtered.map(m => (
              <MeetingCard key={m.id} m={m} selected={selected?.id === m.id} onClick={() => setSelected(m)} />
            ))}
          </div>
        </div>

        {/* Right: detail */}
        {selected && (
          <div style={{ flex: 1, background: 'var(--surface-0)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <MeetingDetail
              meeting={selected}
              onClose={() => setSelected(null)}
              onActionToggle={handleActionToggle}
            />
          </div>
        )}
      </div>
    </div>
  );
}
