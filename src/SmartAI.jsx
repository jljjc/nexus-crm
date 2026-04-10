// src/SmartAI.jsx — Unified AI Assistant Panel v3
// Architecture: Sources (Gmail + Docs) → Generate → Snapshot output
import { useState, useEffect, useRef, useCallback } from 'react';
import * as mammoth from 'mammoth';
import {
  readSession, clearSession, sessionIsValid, getValidToken,
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
function parseEmailDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d)) return null;
  return d;
}
function fmtDate(raw) {
  const d = parseEmailDate(raw);
  if (!d) return raw?.slice(0, 10) || '?';
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatEmailNote(email) {
  const ai = email.ai || {};
  return [
    `[Gmail ${fmtDate(email.date)}]`,
    `主题：${email.subject || '（无主题）'}`,
    `发件人：${email.from || ''}`,
    ai.rawSummary        ? `摘要：${ai.rawSummary}` : '',
    ai.suggestedAction   ? `建议行动：${ai.suggestedAction}` : '',
    ai.urgency           ? `紧急程度：${urgencyLabel[ai.urgency] || ai.urgency}` : '',
  ].filter(Boolean).join('\n');
}


/* ── JSON repair ─────────────────────────────────────────────────────────── */
function repairAndParseJSON(raw) {
  try { return JSON.parse(raw); } catch { /* fall through to repair */ }
  // Remove trailing incomplete token: comma, colon, or partial string
  let s = raw.replace(/,\s*$/, '').replace(/:\s*$/, ':null').replace(/"[^"]*$/, '"');
  // Close unclosed strings, arrays, objects by tracking the stack
  const stack = [];
  let inStr = false, escaped = false;
  for (const ch of s) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inStr) { escaped = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }
  if (inStr) s += '"';
  s += stack.reverse().join('');
  return JSON.parse(s);
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
      if (!r.ok) throw new Error(typeof data.error === 'object' ? (data.error?.message || JSON.stringify(data.error)) : data.error || '同步失败');
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
    onAddNote?.({
      text: formatEmailNote(email),
      type: 'gmail',
      urgency: email.ai?.urgency,
      subject: email.subject,
      emailDate: email.date,
    });
    setEmails(prev => prev.map(e => e.messageId === email.messageId ? { ...e, _saved: true } : e));
    setSavingId(null);
  }, [onAddNote, setEmails]);

  const handleSaveTimeline = () => {
    const relevant = emails.filter(e => e.ai?.isRelevant !== false);
    const sorted = [...relevant].sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach(email => {
      onAddNote?.({
        text: formatEmailNote(email),
        type: 'gmail',
        urgency: email.ai?.urgency,
        subject: email.subject,
        emailDate: email.date,
      });
    });
    setEmails(prev => prev.map(e => ({ ...e, _saved: true })));
  };

  const handleReconnect = async () => {
    try {
      const res = await fetch('/api/gmail-auth?action=url');
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) { /* ignore */ }
  };

  if (!sessionIsValid(gmail)) {
    return (
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle(true)}>
          <span>📧</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: C.blue }}>Gmail + Drive</span>
        </div>
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📬</div>
          <div style={{ color: C.muted, fontSize: 13, marginBottom: 8 }}>
            未连接 — 连接后可读取 Gmail 邮件和 Google Drive 客户文件
          </div>
          <button onClick={handleReconnect}
            style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', border:'none', borderRadius:8,
              padding:'9px 20px', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            🔗 连接 Gmail &amp; Drive
          </button>
          {error && <div style={{ ...errorStyle, marginTop: 10 }}>{error}</div>}
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

function buildSnapshotPrompt(client, caseObj, emailContext, sessionDocs, driveContext) {
  const p = client?.profile || {};
  const s = caseObj || {};

  const crmData = [
    client?.name         && `姓名：${client.name}`,
    client?.email        && `邮箱：${client.email}`,
    client?.phone        && `电话：${client.phone}`,
    client?.nationality  && `国籍：${client.nationality}`,
    p.dob                && `出生日期：${p.dob}`,
    p.passportNo         && `护照号：${p.passportNo}`,
    p.passportExpiry     && `护照有效期：${p.passportExpiry}`,
    p.auAddress          && `澳洲地址：${p.auAddress}`,
    p.visaTarget         && `签证目标：${p.visaTarget}`,
    p.consultant         && `负责顾问：${p.consultant}`,
    s.type               && `当前案件类型：${s.type}`,
    s.status             && `案件状态：${s.status}`,
    p.visaHistory?.length && `签证历史：\n${p.visaHistory.map(v =>
      `  - ${v.visaType||v.type||''} 申请号:${v.applicationNo||v.appNo||''} 批准:${v.grantDate||v.granted||''} 到期:${v.expiry||''}`).join('\n')}`,
    p.skillsAssessments?.length && `职业评估：\n${p.skillsAssessments.map(a =>
      `  - ${a.occupation||''} ${a.outcome||''} 递交:${a.submitted||a.lodgeDate||''}`).join('\n')}`,
    p.caseTimeline?.length && `案件时间线：\n${p.caseTimeline.map(t =>
      `  [${t.date||''}] ${t.event||''} — ${t.status||''}`).join('\n')}`,
    p.keyIssues?.length && `关键问题：\n${p.keyIssues.map(i =>
      `  [${i.priority||''}] ${i.item||''}: ${i.detail||''}`).join('\n')}`,
    p.serviceAgreement?.totalFee && `服务合同：总费用 ${p.serviceAgreement.totalFee}，签署日 ${p.serviceAgreement.contractDate||'—'}`,
    p.sponsor?.name && `担保人：${p.sponsor.name} | 国籍：${p.sponsor.nationality||''} | 护照：${p.sponsor.passportNo||''}`,
    client?.notes?.length && `备注记录（最近5条）：\n${(client.notes||[]).slice(0,5).map(n =>
      `  [${n.createdAt?.slice(0,10)||''}] ${n.text||''}`).join('\n')}`,
  ].filter(Boolean).join('\n');

  const docData = sessionDocs.length > 0
    ? sessionDocs.map((d, i) =>
        `[文件${i+1}: ${d.fileName}]\n${JSON.stringify(d.extracted, null, 2)}`
      ).join('\n\n')
    : '';

  const today = new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' });

  return `你是澳洲移民留学咨询公司 Ozsky Perth 的 AI 助理。
请根据以下所有资料，生成一份详细、专业的双语客户快照，供顾问接案前阅读。
如某部分信息不足，写"资料待补充"——不要留空，不要虚构信息。
重要提示：
• 如 Google Drive 文件包含 PDF 附件，请仔细阅读其全部内容，提取护照号码、护照有效期、出生日期、国籍、地址等个人信息。
• 如上传文件中确实没有护照扫描件，请在"四、关键文件清单"中注明"护照扫描件：未在 Drive 文件夹中找到"。
• 请区分"资料待补充（文件中无相关内容）"与"资料待收集（文件未上传）"。

${driveContext ? `╔═══════════════════════════════════════════════╗
║  📁 Google Drive 客户文件夹文件（主要数据来源）  ║
╚═══════════════════════════════════════════════╝
${driveContext}

` : ''}═══════════════════════════════
CRM 档案数据（补充参考）：
═══════════════════════════════
${crmData || '（暂无 CRM 数据）'}

${docData ? `═══════════════════════════════
本次上传文件提取数据：
═══════════════════════════════
${docData}` : ''}

${emailContext ? `═══════════════════════════════
相关邮件摘要：
═══════════════════════════════
${emailContext}` : ''}

═══════════════════════════════
请严格按以下格式输出（中英文双语，内容尽量详细）：

================================================================================
  客户快照  |  CLIENT SNAPSHOT
  ${client?.name || '[姓名]'} — [签证类型]
  生成日期：${today} | 经办代理：Liang Jiang | Ozsky Migration
================================================================================

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
一、基本信息  PERSONAL DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
（申请人详情 + 担保人详情（如适用））

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
二、签证申请历史  VISA APPLICATION HISTORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
（表格：序号 | 签证类型 | 申请ID | 获批日期 | 有效期/说明）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
三、当前签证状态  CURRENT VISA STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
（表格：签证类型 | 状态 | 备注）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
四、关键文件清单  KEY DOCUMENTS ON FILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
（列出 Drive 文件夹中已有文件，并标注缺少的必要文件）
（格式：[✓] 已有 / [ ] 待收集）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
五、案件备注  CASE NOTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
（编号观察事项、交叉核对、潜在不一致）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
六、⚠️ 关键风险与待办事项  KEY ISSUES & ACTION ITEMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
（🔴 高 / 🟡 中 / 🟢 低 优先级列出）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
七、时间线  TIMELINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
（按时间顺序：YYYY-MM-DD | 事件）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
八、移民路径建议与可行选项  OPTIONS TO CONSIDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
根据客户目前已知情况，列出3-5个可行移民路径或下一步行动选项。每个选项须包含：
• 选项名称（如：申请 Subclass 100 / 转技术移民 / 维持现状观察等）
• 适用条件（当前哪些因素支持此路径）
• 主要优势与风险
• 建议优先级（🔴 推荐 / 🟡 可考虑 / 🔵 备选）
如信息不足，可提出假设性分析并注明"待核实后确认"。

Based on the client's known situation, list 3-5 viable immigration pathways or action options.
Each option should include: option name, applicable conditions, pros/cons, and recommended priority.

================================================================================
  本快照由 AI 辅助整理，仅供移民代理内部参考，不构成法律意见。
  信息以原始文件为准。
================================================================================

如输出长度受限，优先保留：一、二、三、六、八节，其余节可简写。`;
}

/* ════════════════════════════════════════════════════════════════════════════
   Document Section
════════════════════════════════════════════════════════════════════════════ */
function DocumentSection({ selectedClient, sessionDocs, setSessionDocs, onImportClient, onLoadSnapshot }) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [docMsg, setDocMsg] = useState('');
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setDocMsg(''); setPreview(null);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => setPreview({ imageUrl: ev.target.result });
      reader.readAsDataURL(file);
    }

    setLoading(true);
    try {
      let body;

      if (file.name.toLowerCase().endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const { value: textContent } = await mammoth.extractRawText({ arrayBuffer });
        if (!textContent?.trim()) throw new Error('DOCX 文本提取失败（文件可能受密码保护或已损坏）');
        body = { fileName: file.name, textContent, mimeType: 'text/plain' };
      } else if (file.name.toLowerCase().endsWith('.txt')) {
        const textContent = await file.text();
        // If this looks like a client snapshot, load it directly into the Snapshot section
        // so the user can use "⬆️ 应用到档案" with the full extraction schema
        const isSnapshot = /CLIENT SNAPSHOT|客户快照|Client Snapshot/i.test(textContent.slice(0, 500));
        if (isSnapshot && onLoadSnapshot) {
          onLoadSnapshot(textContent);
          setLoading(false);
          e.target.value = '';
          setDocMsg('✅ 快照文件已载入 — 请在下方「客户快照」区域点击「⬆️ 应用到档案」以更新客户资料');
          return; // Skip parse-document; let SnapshotSection handle it
        }
        body = { fileName: file.name, textContent, mimeType: 'text/plain' };
      } else {
        const base64 = await fileToBase64(file);
        body = { fileBase64: base64, mimeType: file.type || guessMime(file.name), fileName: file.name };
      }

      const r = await fetch('/api/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(typeof data.error === 'object' ? (data.error?.message || JSON.stringify(data.error)) : data.error || '识别失败');

      const docEntry = {
        id: Date.now(),
        fileName: file.name,
        docType: data.documentType || 'unknown',
        extracted: data.extracted || {},
        summary: buildDocSummary(data.documentType, data.extracted || {}),
      };
      setSessionDocs(prev => [...prev, docEntry]);
      setPreview(prev => ({ ...(prev || {}), extracted: data.extracted, docType: data.documentType }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleApplyDoc = (docEntry) => {
    if (!onImportClient) return;
    const d = docEntry.extracted;
    onImportClient({
      name: d.fullName || '',
      nationality: d.nationality || '',
      profile: {
        dob: d.dob || '',
        passportNo: d.passportNo || '',
        passportExpiry: d.passportExpiry || d.expiryDate || '',
        nameZh: d.nameChinese || '',
        auAddress: d.auAddress || '',
        chinaId: d.chinaId || '',
        maritalStatus: d.maritalStatus || '',
        sex: d.sex || '',
        sponsor: d.sponsorName ? {
          name: d.sponsorName, dob: d.sponsorDob, nationality: d.sponsorNationality,
          passportNo: d.sponsorPassportNo, address: d.sponsorAddress,
          occupation: d.sponsorOccupation, relationship: d.sponsorRelationship,
        } : undefined,
      },
    });
  };

  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle(open)} onClick={() => setOpen(o => !o)}>
        <span>📄</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: C.blue }}>文件识别</span>
        {sessionDocs.length > 0 && (
          <span style={{ ...badgeStyle, background: C.mid, marginLeft: 4 }}>{sessionDocs.length}</span>
        )}
        <span style={{ color: C.muted, fontSize: 12, marginLeft: 'auto' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: 14 }}>
          <div onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0];
              if (f) { fileRef.current.files = e.dataTransfer.files; handleFile({ target: fileRef.current }); } }}
            style={{ border: `2px dashed ${C.border}`, borderRadius: 10, padding: 16,
              textAlign: 'center', cursor: 'pointer', background: C.light, marginBottom: 12 }}>
            {preview?.imageUrl
              ? <img src={preview.imageUrl} alt="preview" style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 6 }} />
              : <><div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
                <div style={{ color: C.blue, fontWeight: 600, fontSize: 13 }}>点击上传或拖拽文件</div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>JPG · PNG · PDF · DOCX · TXT</div></>
            }
            <input ref={fileRef} type="file" accept="image/*,.pdf,.docx,.txt" style={{ display: 'none' }} onChange={handleFile} />
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: 12, color: C.mid }}>
              <div style={{ fontSize: 22 }}>⏳</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>AI 正在识别文件...</div>
            </div>
          )}
          {error && <div style={errorStyle}>{error}</div>}
          {docMsg && <div style={{ background:'#EBF9F1', border:`1px solid ${C.green}`, color:'#166534', borderRadius:6, padding:'8px 10px', fontSize:12 }}>{docMsg}</div>}

          {sessionDocs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sessionDocs.map(doc => (
                <div key={doc.id} style={{ background: C.light, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>📄</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {doc.fileName}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>{doc.summary}</div>
                  </div>
                  <button onClick={() => handleApplyDoc(doc)} style={{ ...btnStyle(C.mid), padding: '4px 10px', fontSize: 11 }}>
                    ⬆️ 应用
                  </button>
                  <button onClick={() => setSessionDocs(prev => prev.filter(d => d.id !== doc.id))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 14 }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function buildDocSummary(docType, extracted) {
  const parts = [];
  if (docType) parts.push(docType);
  if (extracted.fullName) parts.push(extracted.fullName);
  if (extracted.passportNo) parts.push(extracted.passportNo);
  if (extracted.applicationId) parts.push(`ID: ${extracted.applicationId}`);
  if (extracted.expiryDate) parts.push(`到期: ${extracted.expiryDate}`);
  return parts.join(' — ') || '已识别';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function guessMime(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif', webp:'image/webp', pdf:'application/pdf' }[ext] || 'image/jpeg';
}

/* ════════════════════════════════════════════════════════════════════════════
   Snapshot Section
════════════════════════════════════════════════════════════════════════════ */
function SnapshotSection({
  selectedClient, selectedCase, gmail, emails, sessionDocs,
  snapshot, setSnapshot, onAddNote, onImportClient, onSaveSnapshot,
}) {
  const [loading, setLoading]     = useState(false);
  const [step, setStep]           = useState('');
  const [error, setError]         = useState('');
  const [copied, setCopied]       = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [overwrite] = useState(true); // always overwrite when applying snapshot
  const [applyMsg, setApplyMsg]   = useState('');
  const [driveStatus, setDriveStatus] = useState(null); // {found, folderName, fileCount} | null

  const generate = useCallback(async () => {
    if (!selectedClient) { setError('请先选择客户'); return; }
    setLoading(true); setError(''); setSnapshot(''); setDriveStatus(null);

    // ── Step 1: Fetch Drive files ──────────────────────────────────────────
    let driveContext = '';
    let pdfBlocks = []; // PDF/image blocks to attach to Claude snapshot call
    if (sessionIsValid(gmail)) {
      setStep('📁 读取 Drive 文件夹...');
      try {
        const token = await getValidToken();
        if (token) {
          const r = await fetch('/api/drive-sync', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: token, clientName: selectedClient.name }),
          });
          if (r.ok) {
            const driveData = await r.json();
            if (!driveData.folderFound) {
              // Case 1: folder genuinely missing
              setDriveStatus({ found: false, message: driveData.message });
            } else if (!driveData.processed?.length) {
              // Case 2: folder found but empty (new client, no files yet)
              setDriveStatus({ found: true, folderName: driveData.folderName, fileCount: driveData.totalFiles || 0, readCount: 0, fileDebug: [] });
            } else {
              // Case 3: folder found with files
              const textParts = [];
              const binaryNames = [];
              const fileDebug = []; // diagnostic: track what happened to each file
              for (const f of driveData.processed) {
                const dbg = { name: f.name, mime: f.mimeType || 'null', hasB64: !!f.base64Content, hasTxt: !!f.textContent, skipped: !!f.skipped, err: f.error || null, outcome: '' };
                if (f.textContent) {
                  textParts.push(`[文件: ${f.name}]\n${f.textContent.slice(0, 4000)}`);
                  dbg.outcome = 'text';
                } else if (f.base64Content && f.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                  // DOCX — extract text client-side with mammoth
                  try {
                    const binary = atob(f.base64Content);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    const { value: docxText } = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
                    if (docxText?.trim()) {
                      textParts.push(`[文件: ${f.name}]\n${docxText.slice(0, 4000)}`);
                      dbg.outcome = 'docx-text';
                    } else {
                      binaryNames.push(`  [✓] ${f.name}`);
                      dbg.outcome = 'docx-empty';
                    }
                  } catch (e) {
                    binaryNames.push(`  [✓] ${f.name}`);
                    dbg.outcome = `docx-err:${e.message}`;
                  }
                } else if ((f.mimeType?.includes('pdf') || f.mimeType?.startsWith('image/')) && pdfBlocks.length < 3) {
                  // PDF/image — attach directly to Claude call
                  setStep(`📄 下载文件: ${f.name}...`);
                  try {
                    let fileBase64 = f.base64Content;
                    if (!fileBase64) {
                      const dlRes = await fetch(
                        `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&supportsAllDrives=true`,
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
                      dbg.dlStatus = dlRes.status;
                      if (dlRes.ok) {
                        const blob = await dlRes.blob();
                        fileBase64 = await new Promise(resolve => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(reader.result.split(',')[1]);
                          reader.readAsDataURL(blob);
                        });
                      }
                    }
                    if (fileBase64) {
                      const blockType = f.mimeType === 'application/pdf' ? 'document' : 'image';
                      // Validate PDF magic bytes before sending — invalid PDFs cause Claude API errors
                      if (blockType === 'document') {
                        try {
                          const header = atob(fileBase64.slice(0, 8));
                          if (!header.startsWith('%PDF')) {
                            binaryNames.push(`  [✓] ${f.name}`);
                            dbg.outcome = 'pdf-invalid-header';
                            continue;
                          }
                        } catch {
                          binaryNames.push(`  [✓] ${f.name}`);
                          dbg.outcome = 'pdf-header-decode-err';
                          continue;
                        }
                      }
                      pdfBlocks.push({ type: blockType, source: { type: 'base64', media_type: f.mimeType, data: fileBase64 }, _name: f.name });
                      dbg.outcome = `pdf-block(${blockType})`;
                    } else {
                      binaryNames.push(`  [✓] ${f.name}`);
                      dbg.outcome = 'pdf-dl-failed';
                    }
                  } catch (e) {
                    binaryNames.push(`  [✓] ${f.name}`);
                    dbg.outcome = `pdf-err:${e.message}`;
                  }
                } else {
                  binaryNames.push(`  [✓] ${f.name}`);
                  dbg.outcome = 'unhandled-mime';
                }
                fileDebug.push(dbg);
              }
              // Build drive context: text content + PDF note + binary file list
              const parts = [...textParts];
              if (pdfBlocks.length) {
                parts.push(`以下 PDF/图片文件已附加至消息供 AI 直接阅读：\n${pdfBlocks.map(b => `  [📄] ${b._name}`).join('\n')}`);
              }
              if (binaryNames.length) {
                parts.push(`已存档（未读取）：\n${binaryNames.join('\n')}`);
              }
              if (parts.length) {
                driveContext = `Google Drive 文件夹: ${driveData.folderName} (共${driveData.totalFiles}个文件)\n\n` + parts.join('\n\n---\n\n');
              }
              setDriveStatus({ found: true, folderName: driveData.folderName, fileCount: driveData.totalFiles, readCount: textParts.length + pdfBlocks.length, fileDebug });
            }
          } else {
            const errData = await r.json().catch(() => ({}));
            setDriveStatus({ found: false, message: `Drive 读取失败: ${errData.error || r.status}` });
          }
        }
      } catch (driveErr) {
        setDriveStatus({ found: false, message: `Drive 连接失败: ${driveErr.message}` });
      }
    }

    // ── Step 2: Fetch Gmail emails ─────────────────────────────────────────
    let emailContext = '';
    if (sessionIsValid(gmail) && (selectedClient.email || selectedClient.name)) {
      setStep('📧 读取相关邮件...');
      try {
        const token = await getValidToken();
        if (token) {
          // Search by email address if available, otherwise search by client name
          const gmailQ = selectedClient.email
            ? `from:${selectedClient.email} OR to:${selectedClient.email}`
            : `"${selectedClient.name}"`;
          const r = await fetch('/api/gmail-sync', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: token, maxResults: 20, q: gmailQ }),
          });
          if (r.ok) {
            const data = await r.json();
            const relevant = (data.emails || []).filter(e => e.ai?.isRelevant !== false);
            if (relevant.length > 0) {
              emailContext = relevant.slice(0, 10).map((e, i) => {
                const ai = e.ai || {};
                return [`[邮件${i+1}] ${fmtDate(e.date)} | ${e.subject}`,
                  ai.rawSummary && `摘要：${ai.rawSummary}`,
                  ai.keyNeeds   && `需求：${ai.keyNeeds}`,
                  ai.visaType   && `签证：${ai.visaType}`,
                ].filter(Boolean).join('\n');
              }).join('\n\n');
            }
          }
        }
      } catch { /* non-blocking */ }
    }

    setStep('🤖 生成快照...');
    try {
      const prompt = buildSnapshotPrompt(selectedClient, selectedCase, emailContext, sessionDocs, driveContext);
      // Vercel body limit ~4.5MB — cap total base64 PDF payload to ~3MB to stay safe
      const MAX_PDF_BYTES = 3 * 1024 * 1024;
      let totalPdfBytes = 0;
      const safePdfBlocks = [];
      const skippedPdfNames = [];
      for (const block of pdfBlocks) {
        const sz = (block.source?.data?.length || 0) * 0.75; // base64 → approx bytes
        if (totalPdfBytes + sz <= MAX_PDF_BYTES) {
          safePdfBlocks.push(block);
          totalPdfBytes += sz;
        } else {
          skippedPdfNames.push(block._name);
        }
      }
      const hasPdfs = safePdfBlocks.length > 0;
      const finalPrompt = skippedPdfNames.length
        ? prompt + `\n\n（以下文件因超过大小限制未能附加，请人工查阅：${skippedPdfNames.join('、')}）`
        : prompt;
      const messageContent = hasPdfs
        ? [{ type: 'text', text: finalPrompt }, ...safePdfBlocks.map(({ type, source }) => ({ type, source }))]
        : finalPrompt;

      // ── Streaming fetch: read SSE events, build text incrementally ──────────
      // This avoids Vercel 504 timeout — the Edge function pipes tokens in real-time
      // and the browser stays connected until "done" event arrives.
      const r = await fetch('/api/claude', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 1500,
          messages: [{ role: 'user', content: messageContent }],
          ...(hasPdfs ? { _beta: 'pdfs-2024-09-25' } : {}),
        }),
      });

      if (!r.ok) {
        const raw = await r.text();
        throw new Error(r.status === 413
          ? 'PDF 文件太大，请减小文件大小后重试'
          : `服务器错误 (${r.status}): ${raw.slice(0, 120)}`);
      }

      const contentType = r.headers.get('content-type') || '';
      let snapshotResult = '';

      if (contentType.includes('text/event-stream')) {
        // New streaming path: read SSE line by line
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop();

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;
            try {
              const ev = JSON.parse(raw);
              if (ev.type === 'error') throw new Error(ev.message || '生成失败');
              if (ev.type === 'delta') {
                accumulated += ev.text;
                // Show live progress in step indicator
                const wordCount = accumulated.length;
                setStep(`🤖 生成中... (${wordCount} 字)`);
              }
              if (ev.type === 'done') { snapshotResult = ev.text; }
            } catch (parseErr) {
              if (parseErr.message !== '生成失败' && !parseErr.message.includes('JSON')) throw parseErr;
            }
          }
        }
        if (!snapshotResult && accumulated) snapshotResult = accumulated;
      } else {
        // Fallback: plain JSON response
        const rawText = await r.text();
        let data;
        try { data = JSON.parse(rawText); }
        catch { throw new Error(`服务器返回非 JSON 响应 (${r.status}): ${rawText.slice(0, 120)}`); }
        if (data.error) throw new Error(typeof data.error === 'object' ? (data.error?.message || JSON.stringify(data.error)) : data.error);
        snapshotResult = data.content?.[0]?.text || '';
      }

      if (!snapshotResult) throw new Error('AI 返回内容为空');
      setSnapshot(snapshotResult);
      onSaveSnapshot?.(snapshotResult);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false); setStep('');
    }
  }, [selectedClient, selectedCase, gmail, sessionDocs, setSnapshot, onSaveSnapshot]);

  const handleCopy = () => {
    navigator.clipboard.writeText(snapshot).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleDownload = () => {
    const blob = new Blob([snapshot], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${selectedClient?.name || 'Client'}_Snapshot_${new Date().toISOString().slice(0,10)}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleSaveAsNote = () => {
    if (snapshot) onAddNote?.(`[AI 快照 ${new Date().toLocaleDateString('zh-CN')}]\n${snapshot.slice(0, 2000)}`);
  };

  const handleApply = async () => {
    if (!snapshot) return;
    setApplyBusy(true);
    try {
      const r = await fetch('/api/claude', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 1000,
          messages: [{ role: 'user', content: `从以下客户快照提取信息，返回纯JSON（无markdown，无注释）。只填写找到的字段，找不到的字段用空字符串或空数组。数组字段如果没有数据则返回[]。

{
  "name": "",
  "email": "",
  "phone": "",
  "nationality": "",
  "nameChinese": "",
  "profile": {
    "sex": "",
    "dob": "",
    "birthplace": "",
    "passportNo": "",
    "passportExpiry": "",
    "auAddress": "",
    "maritalStatus": "",
    "chinaId": "",
    "nameZh": "",
    "visaTarget": "",
    "consultant": "",
    "currentStatus": "",
    "serviceAgreement": {
      "totalFee": "",
      "contractDate": ""
    },
    "sponsor": {
      "name": "",
      "dob": "",
      "nationality": "",
      "passportNo": "",
      "relationship": "",
      "address": "",
      "occupation": ""
    },
    "visaHistory": [
      {"type": "", "applicationNo": "", "lodgeDate": "", "grantDate": "", "status": "", "notes": ""}
    ],
    "caseTimeline": [
      {"date": "", "event": "", "status": "Completed"}
    ],
    "keyIssues": [
      {"item": "", "priority": "High"}
    ],
    "nextSteps": [""]
  }
}

提取规则：
1. visaHistory: 提取所有签证申请历史，每条一个对象，status用英文（Approved/In Progress/Refused/Not Yet Lodged）
2. caseTimeline: 提取所有时间线事件，按日期排序，status用Completed/In Progress/Pending/Urgent
3. keyIssues: 提取关键问题/风险，每条一个对象，priority用High/Medium/Low
4. nextSteps: 提取下步行动计划，每条一个字符串
5. serviceAgreement.totalFee: 提取服务费金额（如 "AUD 3,080"）

快照文本：\n${snapshot}` }] }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(typeof data.error === 'object' ? (data.error?.message || JSON.stringify(data.error)) : data.error || 'AI 提取失败');
      const text = data.content?.[0]?.text || '';
      // Extract outermost {...} using bracket counting — stops at matching }, ignores trailing text
      const jsonStr = (() => {
        const start = text.indexOf('{');
        if (start === -1) return null;
        let depth = 0, inStr = false, esc = false;
        for (let i = start; i < text.length; i++) {
          const ch = text[i];
          if (esc) { esc = false; continue; }
          if (ch === '\\' && inStr) { esc = true; continue; }
          if (ch === '"') { inStr = !inStr; continue; }
          if (inStr) continue;
          if (ch === '{') depth++;
          else if (ch === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
        }
        return null;
      })();
      if (!jsonStr) throw new Error('无法解析 AI 返回的 JSON');
      const extracted = repairAndParseJSON(jsonStr);
      // Apply directly — no confirm step needed
      onImportClient?.(extracted, overwrite);
      setApplyMsg('✅ 已应用到客户档案');
      setTimeout(() => setApplyMsg(''), 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setApplyBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={generate} disabled={loading || !selectedClient}
          style={{ ...btnStyle(C.blue, loading || !selectedClient), padding: '11px 20px', fontSize: 14, flex: 1 }}>
          {loading ? `⏳ ${step}` : '✨ 生成客户快照'}
        </button>
        <button onClick={handleApply} disabled={!snapshot || applyBusy}
          style={{ ...btnStyle(C.green, !snapshot || applyBusy), padding: '11px 16px', fontSize: 13, whiteSpace: 'nowrap' }}>
          {applyBusy ? '⏳...' : '⬆️ 应用到档案'}
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}
      {applyMsg && <div style={{ background:'#EBF9F1', border:`1px solid ${C.green}`, color:C.green, borderRadius:6, padding:'8px 10px', fontSize:12 }}>{applyMsg}</div>}

      {driveStatus && (
        <div style={{ borderRadius: 7, padding: '7px 12px', fontSize: 12,
          background: driveStatus.found ? '#EBF9F1' : '#FFF7ED',
          border: `1px solid ${driveStatus.found ? C.green : '#f59e0b'}`,
          color: driveStatus.found ? '#166534' : '#92400e' }}>
          <div>{driveStatus.found
            ? `📁 Drive: ${driveStatus.folderName} — 已读取 ${driveStatus.readCount}/${driveStatus.fileCount} 个文件`
            : `📁 Drive: ${driveStatus.message || 'ozsky-clients 文件夹中未找到该客户文件夹'}`}
          </div>
          {driveStatus.fileDebug?.map((d, i) => (
            <div key={i} style={{ marginTop: 2, fontSize: 11, opacity: 0.85, fontFamily: 'monospace' }}>
              [{d.outcome}] {d.name} | mime={d.mime} | b64={String(d.hasB64)} txt={String(d.hasTxt)} skip={String(d.skipped)}{d.err ? ` err=${d.err}` : ''}{d.dlStatus ? ` dl=${d.dlStatus}` : ''}
            </div>
          ))}
        </div>
      )}

      {snapshot && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>客户快照</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={handleDownload} style={{ ...btnStyle(C.mid), padding: '4px 10px', fontSize: 11 }}>⬇️ 下载</button>
              <button onClick={handleCopy} style={{ ...btnStyle(C.muted), padding: '4px 10px', fontSize: 11 }}>
                {copied ? '✓ 已复制' : '📋 复制'}
              </button>
              <button onClick={handleSaveAsNote} style={{ ...btnStyle(C.orange), padding: '4px 10px', fontSize: 11 }}>💾 存为备注</button>
            </div>
          </div>
          <div style={{ background: C.light, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: 12, fontSize: 12.5, color: C.text, lineHeight: 1.8, whiteSpace: 'pre-wrap',
            maxHeight: 480, overflowY: 'auto', fontFamily: "'JetBrains Mono','Courier New',monospace" }}>
            {snapshot}
          </div>

        </div>
      )}
    </div>
  );
}

export default function SmartAI({ selectedClient, selectedCase, onImportClient, onImportCase, onAddNote, onSaveSnapshot }) {
  const [gmail, setGmail] = useState(readSession);
  const [emails, setEmails] = useState([]);
  const [sessionDocs, setSessionDocs] = useState([]);
  const [snapshot, setSnapshot] = useState('');

  // NOTE: No hash-reading useEffect here — App.js (Task 5) owns the OAuth callback.
  // SmartAI always reads Gmail session from sessionStorage via readSession() above.

  // Clear snapshot and Drive status when the selected client changes
  useEffect(() => { setSnapshot(''); }, [selectedClient?.id]);

  const updateGmail = useCallback((session) => {
    if (!session) clearSession();
    setGmail(session);
  }, []);

  // Wrap onImportClient to accept (data, overwrite) from SnapshotSection
  const handleImportClient = useCallback((data, overwrite = false) => {
    onImportClient?.(data, overwrite);
  }, [onImportClient]);

  return (
    <div style={{ fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
      border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(30,58,95,0.1)' }}>
      <div style={{ background: `linear-gradient(135deg,${C.blue} 0%,${C.mid} 100%)`,
        color: C.white, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>🤖</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>AI 智能助手</div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>
            Gmail 同步 · 文件识别 · 客户快照
            {sessionIsValid(gmail) && <span style={{ marginLeft: 8 }}>● Gmail 已连接</span>}
          </div>
        </div>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!selectedClient && (
          <div style={{ textAlign: 'center', padding: 20, color: C.muted, fontSize: 13 }}>
            请先在主界面选择一个客户
          </div>
        )}
        {selectedClient && (
          <>
            <GmailSection
              gmail={gmail} onGmailUpdate={updateGmail}
              selectedClient={selectedClient}
              onAddNote={onAddNote}
              emails={emails} setEmails={setEmails}
            />
            <DocumentSection
              selectedClient={selectedClient}
              sessionDocs={sessionDocs} setSessionDocs={setSessionDocs}
              onImportClient={handleImportClient}
              onLoadSnapshot={setSnapshot}
            />
            <SnapshotSection
              selectedClient={selectedClient} selectedCase={selectedCase}
              gmail={gmail} emails={emails} sessionDocs={sessionDocs}
              snapshot={snapshot} setSnapshot={setSnapshot}
              onAddNote={onAddNote}
              onImportClient={handleImportClient}
              onSaveSnapshot={onSaveSnapshot}
            />
          </>
        )}
      </div>
    </div>
  );
}
