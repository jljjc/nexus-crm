// src/SmartAI.jsx — Unified AI Assistant Panel v3
// Architecture: Sources (Gmail + Docs) → Generate → Snapshot output
import { useState, useEffect, useRef, useCallback } from 'react';
import * as mammoth from 'mammoth';
import {
  readSession, writeSession, clearSession, sessionIsValid, getValidToken,
} from './utils/gmailSession';

/* ── Brand colours ────────────────────────────────────────────────────────── */
const C = {
  blue:'#1E3A5F', gold:'#C9A84C', mid:'#2E6DA4',
  light:'#EBF3FB', border:'#D0E3F5',
  red:'#C0392B', green:'#27AE60', orange:'#E67E22',
  text:'#2C3E50', muted:'#7F8C8D', white:'#FFFFFF',
};
const urgencyColor = { urgent:C.red, high:C.orange, medium:C.gold, low:C.green };
const urgencyLabel = { urgent:'紧急', high:'高', medium:'中', low:'低' };

/* ── Shared style helpers ────────────────────────────────────────────────── */
const btnStyle = (bg, disabled=false) => ({
  background: disabled ? '#CCC' : bg, color: 'white', border: 'none',
  borderRadius: 6, padding: '8px 14px', cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 13, fontWeight: 600, opacity: disabled ? 0.6 : 1,
});
const inputStyle = {
  width: '100%', padding: '6px 10px', border: `1px solid ${C.border}`,
  borderRadius: 6, fontSize: 13, color: C.text, boxSizing: 'border-box',
  outline: 'none', background: 'white',
};
const labelStyle = { display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 600 };
const badgeStyle = {
  display: 'inline-block', padding: '2px 7px', borderRadius: 10,
  fontSize: 10, fontWeight: 700, color: 'white',
};
const sectionStyle = {
  border: `1px solid ${C.border}`, borderRadius: 10,
  overflow: 'hidden', background: C.white,
};
const sectionHeaderStyle = (open) => ({
  display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px',
  background: open ? C.light : C.white, cursor: 'pointer',
  borderBottom: open ? `1px solid ${C.border}` : 'none',
});

/* ── Note formatters ────────────────────────────────────────────────────── */
function formatEmailNote(email) {
  const ai = email.ai || {};
  return [
    `[Gmail ${email.date?.slice(0, 10) || ''}]`,
    `主题：${email.subject || '（无主题）'}`,
    `发件人：${email.from || ''}`,
    ai.rawSummary        ? `摘要：${ai.rawSummary}` : '',
    ai.suggestedAction   ? `建议行动：${ai.suggestedAction}` : '',
    ai.urgency           ? `紧急程度：${urgencyLabel[ai.urgency] || ai.urgency}` : '',
  ].filter(Boolean).join('\n');
}

function formatTimelineNote(clientName, emails) {
  const capped = emails.slice(0, 50);
  const lines = capped
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .map(e => {
      const ai = e.ai || {};
      const summary = ai.rawSummary ? ` — ${ai.rawSummary.slice(0, 80)}` : '';
      return `• ${e.date?.slice(0, 10) || '?'} | ${e.subject || '（无主题）'}${summary}`;
    })
    .join('\n');
  const overflow = emails.length > 50 ? `\n（仅显示最近 50 封，共 ${emails.length} 封相关邮件）` : '';
  return [
    `[Gmail 邮件时间线 — ${clientName} — ${new Date().toISOString().slice(0, 10)}]`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    lines,
    overflow,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `共 ${capped.length} 封相关邮件 | 由 AI 辅助整理`,
  ].filter(Boolean).join('\n');
}

/* ════════════════════════════════════════════════════════════════════════════
   Gmail Section
════════════════════════════════════════════════════════════════════════════ */
function GmailSection({ gmail, onGmailUpdate, selectedClient, onAddNote, emails, setEmails }) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [maxResults, setMaxResults] = useState(30);
  const [expandedId, setExpandedId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const defaultQuery = selectedClient?.email
    ? `from:${selectedClient.email} OR to:${selectedClient.email}`
    : selectedClient?.name ? `subject:"${selectedClient.name}"` : '';
  const [query, setQuery] = useState(defaultQuery);

  useEffect(() => {
    setQuery(defaultQuery);
    setEmails([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient?.id]);

  const handleConnect = async () => {
    if (selectedClient?.id) {
      sessionStorage.setItem('ozsky_pending_client_id', selectedClient.id);
    }
    try {
      const r = await fetch('/api/gmail-auth?action=url');
      const data = await r.json();
      window.location.href = data.url;
    } catch {
      setError('无法获取 Google 授权链接，请检查环境配置');
    }
  };

  const handleDisconnect = () => {
    clearSession();
    onGmailUpdate(null);
    setEmails([]);
  };

  const handleSync = async () => {
    setLoading(true); setError(''); setEmails([]);
    try {
      const token = await getValidToken();
      if (!token) { onGmailUpdate(null); return; }
      const r = await fetch('/api/gmail-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token, maxResults, q: query || 'in:all' }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '同步失败');
      setEmails(data.emails || []);
      // Update session in state (token may have been refreshed)
      const sess = readSession();
      if (sess) onGmailUpdate(sess);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = useCallback((email) => {
    setSavingId(email.messageId);
    onAddNote?.(formatEmailNote(email));
    setEmails(prev => prev.map(e => e.messageId === email.messageId ? { ...e, _saved: true } : e));
    setSavingId(null);
  }, [onAddNote, setEmails]);

  const handleSaveTimeline = () => {
    const relevant = emails.filter(e => e.ai?.isRelevant !== false);
    onAddNote?.(formatTimelineNote(selectedClient?.name || '客户', relevant));
    setEmails(prev => prev.map(e => ({ ...e, _saved: true })));
  };

  if (!sessionIsValid(gmail)) {
    return (
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle(true)}>
          <span>📧</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: C.blue }}>Gmail 邮件</span>
        </div>
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📬</div>
          <div style={{ color: C.blue, fontWeight: 600, marginBottom: 6 }}>连接 Gmail 邮箱</div>
          <div style={{ color: C.muted, fontSize: 12, marginBottom: 12 }}>
            授权后本次会话内无需重新连接。AI 将自动识别客户邮件并提取信息。
          </div>
          <button onClick={handleConnect} style={btnStyle(C.blue)}>🔐 连接 Google 账号</button>
          {error && <div style={errorStyle}>{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle(open)} onClick={() => setOpen(o => !o)}>
        <span>📧</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: C.blue }}>Gmail 邮件</span>
        <span style={{ color: C.green, fontSize: 11, marginLeft: 4 }}>● 已连接</span>
        {gmail?.userEmail && (
          <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>{gmail.userEmail}</span>
        )}
        <button onClick={(e) => { e.stopPropagation(); handleDisconnect(); }}
          style={{ ...btnStyle(C.muted), padding: '2px 8px', fontSize: 11, marginLeft: 'auto' }}>
          断开
        </button>
        <span style={{ color: C.muted, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: 14 }}>
          {/* Search bar */}
          <div style={{ background: C.light, borderRadius: 8, padding: 10, marginBottom: 10 }}>
            {selectedClient?.email && (
              <div style={{ fontSize: 11, color: C.mid, marginBottom: 6 }}>
                客户：<strong>{selectedClient.name}</strong>
                <button onClick={() => setQuery(defaultQuery)}
                  style={{ marginLeft: 8, background: 'none', border: `1px solid ${C.mid}`,
                    borderRadius: 4, padding: '1px 6px', fontSize: 11, color: C.mid, cursor: 'pointer' }}>
                  重置
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>搜索条件</label>
                <input value={query} onChange={e => setQuery(e.target.value)} style={inputStyle}
                  placeholder="from:xxx@gmail.com OR subject:客户姓名" />
              </div>
              <div style={{ width: 64 }}>
                <label style={labelStyle}>数量</label>
                <input type="number" min={1} max={100} value={maxResults}
                  onChange={e => setMaxResults(Number(e.target.value))} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={handleSync} disabled={loading} style={btnStyle(C.mid, loading)}>
                {loading ? '⏳ 读取中...' : '🔄 读取邮件'}
              </button>
              {emails.length > 0 && (
                <button onClick={handleSaveTimeline} style={btnStyle(C.green)}>
                  📋 保存时间线备注
                </button>
              )}
            </div>
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          {emails.length > 0 && (
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
              共 {emails.length} 封 · 相关 {emails.filter(e => e.ai?.isRelevant).length} 封
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            {emails.map(email => {
              const ai = email.ai || {};
              const exp = expandedId === email.messageId;
              return (
                <div key={email.messageId} style={{
                  border: `1px solid ${ai.isRelevant ? C.border : '#EEE'}`,
                  borderLeft: `3px solid ${ai.isRelevant ? (urgencyColor[ai.urgency] || C.gold) : '#CCC'}`,
                  borderRadius: 8, opacity: ai.isRelevant ? 1 : 0.65,
                }}>
                  <div onClick={() => setExpandedId(exp ? null : email.messageId)}
                    style={{ padding: '8px 12px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                      {ai.isRelevant && (
                        <span style={{ ...badgeStyle, background: urgencyColor[ai.urgency] || C.gold }}>
                          {urgencyLabel[ai.urgency] || '?'}
                        </span>
                      )}
                      {email._saved && <span style={{ ...badgeStyle, background: C.green }}>✓ 已存备注</span>}
                      {!ai.isRelevant && <span style={{ ...badgeStyle, background: C.muted }}>非业务</span>}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{email.subject || '（无主题）'}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{email.from?.slice(0, 50)} · {email.date?.slice(0, 16)}</div>
                    {ai.rawSummary && <div style={{ fontSize: 12, color: C.text, marginTop: 3, opacity: 0.85 }}>{ai.rawSummary}</div>}
                  </div>
                  {exp && (
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 12px', background: C.light }}>
                      {ai.suggestedAction && (
                        <div style={{ background: '#FFF9EC', border: `1px solid ${C.gold}`, borderRadius: 6,
                          padding: '6px 10px', marginBottom: 8, fontSize: 12 }}>
                          <span style={{ color: C.gold, fontWeight: 600 }}>💡 </span>
                          {ai.suggestedAction}
                        </div>
                      )}
                      <button onClick={() => handleSaveNote(email)}
                        disabled={savingId === email.messageId || email._saved}
                        style={btnStyle(email._saved ? C.green : C.orange, savingId === email.messageId || email._saved)}>
                        {email._saved ? '✓ 已保存' : '💾 保存为备注'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const errorStyle = {
  background: '#FEF0EF', border: `1px solid ${C.red}`, color: C.red,
  borderRadius: 6, padding: '8px 10px', fontSize: 12, marginTop: 8,
};

// Placeholder — Document and Snapshot sections added in Tasks 8-9
export default function SmartAI({ selectedClient, selectedCase, onImportClient, onImportCase, onAddNote }) {
  const [gmail, setGmail] = useState(readSession);
  const [emails, setEmails] = useState([]);

  // NOTE: Do NOT add a hash-reading useEffect here.
  // App.js (Task 5) owns post-OAuth hash reading. It writes the token to sessionStorage
  // and restores the client modal. SmartAI reads the session via readSession() above.

  const updateGmail = useCallback((session) => {
    if (!session) clearSession();
    setGmail(session);
  }, []);

  return (
    <div style={{ fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif" }}>
      <div style={{ background: `linear-gradient(135deg,${C.blue} 0%,${C.mid} 100%)`,
        color: C.white, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>🤖</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>AI 智能助手</div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>Gmail 同步 · 文件识别 · 客户快照</div>
        </div>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <GmailSection
          gmail={gmail} onGmailUpdate={updateGmail}
          selectedClient={selectedClient}
          onAddNote={onAddNote}
          emails={emails} setEmails={setEmails}
        />
        {/* Document and Snapshot sections coming in Tasks 8-9 */}
      </div>
    </div>
  );
}
