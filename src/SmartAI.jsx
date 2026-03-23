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

function formatTimelineNote(clientName, emails) {
  const capped = emails.slice(0, 50);
  const lines = capped
    .sort((a, b) => {
      const da = parseEmailDate(a.date), db = parseEmailDate(b.date);
      if (da && db) return da - db;
      return (a.date || '').localeCompare(b.date || '');
    })
    .map(e => {
      const ai = e.ai || {};
      const summary = ai.rawSummary ? ` — ${ai.rawSummary.slice(0, 80)}` : '';
      return `• ${fmtDate(e.date)} | ${e.subject || '（无主题）'}${summary}`;
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

function buildSnapshotPrompt(client, caseObj, emailContext, sessionDocs) {
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

═══════════════════════════════
CRM 档案数据：
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
（清单：[✓] 已有 / [ ] 待收集）

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

================================================================================
  本快照由 AI 辅助整理，仅供移民代理内部参考，不构成法律意见。
  信息以原始文件为准。
================================================================================

如输出长度受限，优先保留：一、二、三、六节，其余节可简写。`;
}

/* ════════════════════════════════════════════════════════════════════════════
   Document Section
════════════════════════════════════════════════════════════════════════════ */
function DocumentSection({ selectedClient, sessionDocs, setSessionDocs, onImportClient }) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setPreview(null);

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
      if (!r.ok) throw new Error(data.error || '识别失败');

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
  snapshot, setSnapshot, onAddNote, onImportClient,
}) {
  const [loading, setLoading]     = useState(false);
  const [step, setStep]           = useState('');
  const [error, setError]         = useState('');
  const [copied, setCopied]       = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyPreview, setApplyPreview] = useState(null);
  const [overwrite, setOverwrite] = useState(false);

  const generate = useCallback(async () => {
    if (!selectedClient) { setError('请先选择客户'); return; }
    setLoading(true); setError(''); setSnapshot('');

    let emailContext = '';
    if (sessionIsValid(gmail) && selectedClient.email) {
      setStep('📧 读取相关邮件...');
      try {
        const token = await getValidToken();
        if (token) {
          const r = await fetch('/api/gmail-sync', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: token, maxResults: 20,
              q: `from:${selectedClient.email} OR to:${selectedClient.email}` }),
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
      const prompt = buildSnapshotPrompt(selectedClient, selectedCase, emailContext, sessionDocs);
      const r = await fetch('/api/claude', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '生成失败');
      setSnapshot(data.content?.[0]?.text || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false); setStep('');
    }
  }, [selectedClient, selectedCase, gmail, sessionDocs, setSnapshot]);

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
          model: 'claude-sonnet-4-6', max_tokens: 2000,
          messages: [{ role: 'user', content: `请从以下客户快照中提取所有结构化信息，以纯JSON返回（不含markdown），严格使用以下结构，缺失字段用null：
{"name":"","email":"","phone":"","nationality":"","type":"Migration","nameChinese":"",
"profile":{"sex":null,"dob":null,"birthplace":null,"passportNo":null,"passportExpiry":null,"auAddress":null,"maritalStatus":null,"chinaId":null,"consultant":null,"visaTarget":null,
"visaHistory":[{"applicationNo":"","visaType":"","grantDate":"","expiry":"","status":""}],
"skillsAssessments":[{"appId":"","occupation":"","outcome":"","submitted":""}],
"caseTimeline":[{"date":"","event":"","status":"Completed"}],
"keyIssues":[{"priority":"High","item":"","detail":""}],
"sponsor":{"name":null,"dob":null,"nationality":null,"passportNo":null,"relationship":null,"address":null,"occupation":null},
"serviceAgreement":{"contractDate":null,"totalFee":null}}}

快照文本：\n${snapshot.slice(0, 6000)}` }] }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'AI 提取失败');
      const text = data.content?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('无法解析 AI 返回的 JSON');
      setApplyPreview(JSON.parse(match[0]));
    } catch (e) {
      setError(e.message);
    } finally {
      setApplyBusy(false);
    }
  };

  const handleConfirmApply = () => {
    if (!applyPreview) return;
    onImportClient?.(applyPreview, overwrite);
    setApplyPreview(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button onClick={generate} disabled={loading || !selectedClient}
        style={{ ...btnStyle(C.blue, loading || !selectedClient), padding: '11px 20px', fontSize: 14 }}>
        {loading ? `⏳ ${step}` : '✨ 生成客户快照'}
      </button>

      {error && <div style={errorStyle}>{error}</div>}

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
              <button onClick={handleApply} disabled={applyBusy}
                style={{ ...btnStyle(C.blue, applyBusy), padding: '4px 10px', fontSize: 11 }}>
                {applyBusy ? '⏳...' : '⬆️ 应用到档案'}
              </button>
            </div>
          </div>
          <div style={{ background: C.light, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: 12, fontSize: 12.5, color: C.text, lineHeight: 1.8, whiteSpace: 'pre-wrap',
            maxHeight: 480, overflowY: 'auto', fontFamily: "'JetBrains Mono','Courier New',monospace" }}>
            {snapshot}
          </div>

          {applyPreview && (
            <div style={{ marginTop: 12, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: C.light, padding: '10px 14px', fontWeight: 700, fontSize: 13, color: C.blue }}>
                ✅ 信息提取完成 — 确认后将应用到客户档案
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 12 }}>
                  {[
                    ['姓名', applyPreview.name],
                    ['国籍', applyPreview.nationality],
                    ['出生日期', applyPreview.profile?.dob],
                    ['护照号', applyPreview.profile?.passportNo],
                    ['护照有效期', applyPreview.profile?.passportExpiry],
                    ['澳洲地址', applyPreview.profile?.auAddress],
                    ['担保人', applyPreview.profile?.sponsor?.name],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} style={{ background: '#f9fafb', borderRadius: 7, padding: '7px 10px', border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase' }}>{k}</div>
                      <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />
                  覆盖已有字段（默认只填补空白）
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleConfirmApply} style={btnStyle(C.blue)}>✅ 确认应用</button>
                  <button onClick={() => setApplyPreview(null)}
                    style={{ ...btnStyle(C.muted), background: '#f1f5f9', color: C.text }}>取消</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SmartAI({ selectedClient, selectedCase, onImportClient, onImportCase, onAddNote }) {
  const [gmail, setGmail] = useState(readSession);
  const [emails, setEmails] = useState([]);
  const [sessionDocs, setSessionDocs] = useState([]);
  const [snapshot, setSnapshot] = useState('');

  // NOTE: No hash-reading useEffect here — App.js (Task 5) owns the OAuth callback.
  // SmartAI always reads Gmail session from sessionStorage via readSession() above.

  // Clear snapshot when the selected client changes (avoid showing stale data)
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
            />
            <SnapshotSection
              selectedClient={selectedClient} selectedCase={selectedCase}
              gmail={gmail} emails={emails} sessionDocs={sessionDocs}
              snapshot={snapshot} setSnapshot={setSnapshot}
              onAddNote={onAddNote}
              onImportClient={handleImportClient}
            />
          </>
        )}
      </div>
    </div>
  );
}
