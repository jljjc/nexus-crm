// src/SmartAI.jsx
// Smart AI Assistant panel for Ozsky CRM
// Combines: Gmail sync, Document OCR, Client Snapshot generation
//
// Usage in App.js:
//   import SmartAI from './SmartAI';
//   // Inside your JSX (e.g. inside a tab or modal):
//   <SmartAI
//     selectedClient={selectedClient}          // current client object from state
//     selectedCase={selectedCase}              // current case object from state
//     onImportClient={(data) => { ... }}       // callback to pre-fill client form fields
//     onImportCase={(data) => { ... }}         // callback to pre-fill case form fields
//     onAddNote={(text) => { ... }}            // callback to add a note to the case
//   />

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Brand colours (match App.js) ─────────────────────────────────────────────
const C = {
  blue:   '#1E3A5F',
  gold:   '#C9A84C',
  mid:    '#2E6DA4',
  light:  '#EBF3FB',
  border: '#D0E3F5',
  red:    '#C0392B',
  green:  '#27AE60',
  orange: '#E67E22',
  text:   '#2C3E50',
  muted:  '#7F8C8D',
  white:  '#FFFFFF',
};

// ── Urgency badge colours ─────────────────────────────────────────────────────
const urgencyColor = { urgent: C.red, high: C.orange, medium: C.gold, low: C.green };
const urgencyLabel = { urgent: '紧急', high: '高', medium: '中', low: '低' };

// ── Document type options ─────────────────────────────────────────────────────
const DOC_TYPES = [
  { value: 'passport',    label: '护照' },
  { value: 'visa',        label: '签证' },
  { value: 'education',   label: '学历证明' },
  { value: 'employment',  label: '雇用证明' },
  { value: 'bank',        label: '银行对账单' },
  { value: 'skillsAssess',label: '职业评估' },
];

// ════════════════════════════════════════════════════════════════════════════
// Main SmartAI Component
// ════════════════════════════════════════════════════════════════════════════
export default function SmartAI({
  selectedClient,
  selectedCase,
  onImportClient,
  onImportCase,
  onAddNote,
}) {
  const [activeTab, setActiveTab] = useState('gmail');   // 'gmail' | 'ocr' | 'snapshot'

  return (
    <div style={{
      fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
      background: C.white,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(30,58,95,0.1)',
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${C.blue} 0%, ${C.mid} 100%)`,
        color: C.white, padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 22 }}>🤖</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>AI 智能助手</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>Gmail 同步 · 文件识别 · 客户快照</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.light }}>
        {[
          { id: 'gmail',    icon: '📧', label: 'Gmail 同步' },
          { id: 'ocr',      icon: '📄', label: '文件识别' },
          { id: 'snapshot', icon: '📊', label: '客户快照' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer',
              background: activeTab === tab.id ? C.white : 'transparent',
              borderBottom: activeTab === tab.id ? `2px solid ${C.gold}` : '2px solid transparent',
              color: activeTab === tab.id ? C.blue : C.muted,
              fontWeight: activeTab === tab.id ? 700 : 400,
              fontSize: 13, transition: 'all 0.2s',
            }}
          >
            <span style={{ marginRight: 4 }}>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div style={{ padding: 16 }}>
        {activeTab === 'gmail'    && <GmailPanel onImportClient={onImportClient} onImportCase={onImportCase} onAddNote={onAddNote} />}
        {activeTab === 'ocr'     && <OcrPanel    onImportClient={onImportClient} onImportCase={onImportCase} selectedClient={selectedClient} />}
        {activeTab === 'snapshot'&& <SnapshotPanel selectedClient={selectedClient} selectedCase={selectedCase} />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Gmail Panel
// ════════════════════════════════════════════════════════════════════════════
function GmailPanel({ onImportClient, onImportCase, onAddNote }) {
  const [accessToken,   setAccessToken]   = useState(null);
  const [userEmail,     setUserEmail]     = useState('');
  const [loading,       setLoading]       = useState(false);
  const [emails,        setEmails]        = useState([]);
  const [error,         setError]         = useState('');
  const [maxResults,    setMaxResults]    = useState(15);
  const [query,         setQuery]         = useState('is:unread category:primary');
  const [expandedId,    setExpandedId]    = useState(null);
  const [importingId,   setImportingId]   = useState(null);

  // Read token from URL fragment on mount (set by api/gmail-auth.js redirect)
  useEffect(() => {
    if (!window.location.hash) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token  = params.get('gmail_access_token');
    const email  = params.get('gmail_user_email') || '';
    if (token) {
      setAccessToken(token);
      setUserEmail(email);
      // Clean fragment from URL without reload
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  const handleConnect = async () => {
    try {
      const r    = await fetch('/api/gmail-auth?action=url');
      const data = await r.json();
      window.location.href = data.url;
    } catch {
      setError('无法获取 Google 授权链接，请检查环境配置');
    }
  };

  const handleSync = async () => {
    if (!accessToken) return;
    setLoading(true); setError(''); setEmails([]);
    try {
      const r = await fetch('/api/gmail-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, maxResults, q: query }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '同步失败');
      setEmails(data.emails || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (email) => {
    setImportingId(email.messageId);
    try {
      const ai = email.ai || {};
      // Build client data from AI extraction
      const clientData = {
        name:        ai.clientName  || '',
        email:       ai.clientEmail || email.from?.match(/<(.+)>/)?.[1] || email.from || '',
        phone:       ai.clientPhone || '',
        nationality: ai.nationality || '',
        notes:       ai.rawSummary  || '',
      };
      // Build case data
      const caseData = {
        visaType:    ai.visaType          || '',
        status:      ai.currentVisaStatus || '',
        assignee:    ai.suggestedAssignee || '',
        priority:    ai.urgency           || 'medium',
        nextAction:  ai.suggestedAction   || '',
        keyNeeds:    ai.keyNeeds          || '',
      };
      if (onImportClient) onImportClient(clientData);
      if (onImportCase)   onImportCase(caseData);
      if (onAddNote && ai.rawSummary) {
        onAddNote(`[Gmail导入 ${new Date().toLocaleString('zh-CN')}]\n来自：${email.from}\n主题：${email.subject}\n摘要：${ai.rawSummary}`);
      }
      // Visual feedback — mark as imported
      setEmails(prev => prev.map(e => e.messageId === email.messageId ? { ...e, _imported: true } : e));
    } finally {
      setImportingId(null);
    }
  };

  if (!accessToken) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
        <div style={{ color: C.blue, fontWeight: 600, marginBottom: 6 }}>连接 Gmail 邮箱</div>
        <div style={{ color: C.muted, fontSize: 13, marginBottom: 18 }}>
          授权后 AI 将自动识别客户邮件并提取信息
        </div>
        <button onClick={handleConnect} style={btnStyle(C.blue)}>
          🔐 连接 Google 账号
        </button>
        {error && <div style={errorStyle}>{error}</div>}
      </div>
    );
  }

  return (
    <div>
      {/* Connected bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ color: C.green, fontSize: 12 }}>●</span>
        <span style={{ fontSize: 12, color: C.muted }}>{userEmail || '已连接 Gmail'}</span>
        <button onClick={() => setAccessToken(null)} style={{ ...btnStyle(C.muted), padding: '3px 8px', fontSize: 11, marginLeft: 'auto' }}>断开</button>
      </div>

      {/* Search config */}
      <div style={{ background: C.light, borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>搜索条件</label>
            <input value={query} onChange={e => setQuery(e.target.value)} style={inputStyle} placeholder="Gmail 搜索语法" />
          </div>
          <div style={{ width: 70 }}>
            <label style={labelStyle}>数量</label>
            <input type="number" min={1} max={50} value={maxResults}
              onChange={e => setMaxResults(Number(e.target.value))} style={inputStyle} />
          </div>
        </div>
        <button onClick={handleSync} disabled={loading} style={btnStyle(C.mid, loading)}>
          {loading ? '⏳ 正在同步...' : '🔄 立即同步'}
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      {/* Email list */}
      {emails.length === 0 && !loading && (
        <div style={{ textAlign: 'center', color: C.muted, padding: 20, fontSize: 13 }}>
          点击「立即同步」获取邮件
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {emails.map(email => {
          const ai  = email.ai  || {};
          const exp = expandedId === email.messageId;
          return (
            <div key={email.messageId} style={{
              border: `1px solid ${ai.isRelevant ? C.border : '#EEE'}`,
              borderLeft: `3px solid ${ai.isRelevant ? (urgencyColor[ai.urgency] || C.gold) : '#CCC'}`,
              borderRadius: 8, overflow: 'hidden',
              opacity: ai.isRelevant ? 1 : 0.55,
            }}>
              {/* Email header row */}
              <div
                onClick={() => setExpandedId(exp ? null : email.messageId)}
                style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8 }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {ai.isRelevant && (
                      <span style={{ ...badgeStyle, background: urgencyColor[ai.urgency] || C.gold }}>
                        {urgencyLabel[ai.urgency] || '?'}
                      </span>
                    )}
                    {ai.enquiryType && (
                      <span style={{ ...badgeStyle, background: C.mid }}>
                        {ai.enquiryType}
                      </span>
                    )}
                    {!ai.isRelevant && (
                      <span style={{ ...badgeStyle, background: C.muted }}>非业务邮件</span>
                    )}
                    {email._imported && (
                      <span style={{ ...badgeStyle, background: C.green }}>✓ 已导入</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: C.text, marginTop: 4,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {email.subject || '（无主题）'}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {email.from?.slice(0, 50)} · {email.date?.slice(0, 16)}
                  </div>
                  {ai.rawSummary && (
                    <div style={{ fontSize: 12, color: C.text, marginTop: 4, opacity: 0.85 }}>
                      {ai.rawSummary}
                    </div>
                  )}
                </div>
                <span style={{ color: C.muted, fontSize: 12, flexShrink: 0 }}>{exp ? '▲' : '▼'}</span>
              </div>

              {/* Expanded details */}
              {exp && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 12px', background: C.light }}>
                  {ai.isRelevant && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                      {[
                        ['客户姓名', ai.clientName],
                        ['邮箱',     ai.clientEmail],
                        ['电话',     ai.clientPhone],
                        ['国籍',     ai.nationality],
                        ['签证类型', ai.visaType],
                        ['当前状态', ai.currentVisaStatus],
                        ['建议分配', ai.suggestedAssignee],
                        ['核心需求', ai.keyNeeds],
                      ].filter(([, v]) => v).map(([k, v]) => (
                        <div key={k} style={{ background: C.white, borderRadius: 6, padding: '6px 8px' }}>
                          <div style={{ fontSize: 10, color: C.muted }}>{k}</div>
                          <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {ai.suggestedAction && (
                    <div style={{ background: '#FFF9EC', border: `1px solid ${C.gold}`, borderRadius: 6,
                      padding: '8px 10px', marginBottom: 10, fontSize: 12 }}>
                      <span style={{ color: C.gold, fontWeight: 600 }}>💡 建议行动：</span>
                      <span style={{ color: C.text }}>{ai.suggestedAction}</span>
                    </div>
                  )}
                  {ai.isRelevant && (
                    <button
                      onClick={() => handleImport(email)}
                      disabled={importingId === email.messageId || email._imported}
                      style={btnStyle(email._imported ? C.green : C.blue, importingId === email.messageId)}
                    >
                      {email._imported ? '✓ 已导入到当前客户/案件' :
                       importingId === email.messageId ? '⏳ 导入中...' : '⬆️ 导入到当前客户/案件'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// OCR Document Panel
// ════════════════════════════════════════════════════════════════════════════
function OcrPanel({ onImportClient, onImportCase, selectedClient }) {
  const [docType,    setDocType]    = useState('passport');
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState('');
  const [preview,    setPreview]    = useState('');
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setResult(null);

    // Preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => setPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreview('');
    }

    // Convert to base64
    const base64 = await fileToBase64(file);
    setLoading(true);
    try {
      const r = await fetch('/api/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64:   base64,
          mimeType:     file.type,
          documentType: docType,
          fileName:     file.name,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '识别失败');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleImport = () => {
    if (!result?.extracted) return;
    const d = result.extracted;
    if (docType === 'passport') {
      onImportClient?.({
        name:          d.fullName || `${d.firstName || ''} ${d.lastName || ''}`.trim(),
        nameZh:        d.fullNameZh,
        dob:           d.dateOfBirth,
        nationality:   d.nationality,
        passportNo:    d.passportNumber,
        passportExpiry:d.expiryDate,
      });
    } else if (docType === 'visa') {
      onImportCase?.({
        visaType:       d.visaSubclass ? `子类 ${d.visaSubclass}` : d.visaType,
        visaExpiry:     d.expiryDate,
        visaGrantDate:  d.grantDate,
        visaConditions: (d.conditions || []).join(', '),
        caseRef:        d.caseReference,
      });
    } else if (docType === 'employment') {
      onImportCase?.({
        employer:    d.employerName,
        employerABN: d.employerABN,
        position:    d.position,
        anzsco:      d.positionAnzsco,
        salary:      d.annualSalary,
      });
    }
    // For education/bank/skillsAssess add as note
    if (['education', 'bank', 'skillsAssess'].includes(docType)) {
      const summary = Object.entries(d)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\n');
      onImportClient?.({ notes: `[${DOC_TYPES.find(t=>t.value===docType)?.label} 识别 ${new Date().toLocaleString('zh-CN')}]\n${summary}` });
    }
  };

  const confidence = result?.confidence;
  const confColor  = confidence === 'high' ? C.green : confidence === 'medium' ? C.orange : C.red;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>文件类型</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {DOC_TYPES.map(t => (
            <button key={t.value} onClick={() => { setDocType(t.value); setResult(null); setError(''); }}
              style={{
                padding: '5px 12px', borderRadius: 20, border: `1px solid ${docType===t.value?C.blue:C.border}`,
                background: docType===t.value?C.blue:'white', color: docType===t.value?'white':C.text,
                cursor: 'pointer', fontSize: 12, fontWeight: docType===t.value?600:400,
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Upload area */}
      <div
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${C.border}`, borderRadius: 10, padding: '20px',
          textAlign: 'center', cursor: 'pointer', background: C.light,
          transition: 'border-color 0.2s',
        }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) { fileRef.current.files = e.dataTransfer.files; handleFile({ target: fileRef.current }); }
        }}
      >
        {preview ? (
          <img src={preview} alt="preview" style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 6 }} />
        ) : (
          <>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            <div style={{ color: C.blue, fontWeight: 600, fontSize: 14 }}>点击上传或拖拽文件</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>支持 JPG · PNG · PDF</div>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFile} />
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 16, color: C.mid }}>
          <div style={{ fontSize: 24, animation: 'spin 1s linear infinite' }}>⏳</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>AI 正在识别文件...</div>
        </div>
      )}

      {error && <div style={errorStyle}>{error}</div>}

      {result && !loading && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>识别结果</span>
            <span style={{ ...badgeStyle, background: confColor }}>
              {confidence === 'high' ? '高置信度' : confidence === 'medium' ? '中置信度' : '低置信度'}
              {' '}({result.fillRate}%)
            </span>
          </div>
          <div style={{ background: C.light, borderRadius: 8, padding: 12 }}>
            {Object.entries(result.extracted)
              .filter(([, v]) => v !== null && v !== undefined && v !== '')
              .map(([k, v]) => (
                <div key={k} style={{ display: 'flex', borderBottom: `1px solid ${C.border}`,
                  padding: '5px 0', fontSize: 12 }}>
                  <span style={{ color: C.muted, width: 130, flexShrink: 0 }}>{k}</span>
                  <span style={{ color: C.text, fontWeight: 500 }}>
                    {Array.isArray(v) ? v.join(', ') : String(v)}
                  </span>
                </div>
              ))}
          </div>
          <button onClick={handleImport} style={{ ...btnStyle(C.blue), marginTop: 10 }}>
            ⬆️ 填入{selectedClient ? `「${selectedClient.name || '当前客户'}」` : '当前客户/案件'}信息
          </button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Client Snapshot Panel
// ════════════════════════════════════════════════════════════════════════════
function SnapshotPanel({ selectedClient, selectedCase }) {
  const [loading,   setLoading]   = useState(false);
  const [snapshot,  setSnapshot]  = useState('');
  const [error,     setError]     = useState('');
  const [copied,    setCopied]    = useState(false);

  const generate = useCallback(async () => {
    if (!selectedClient && !selectedCase) {
      setError('请先选择客户或案件');
      return;
    }
    setLoading(true); setError(''); setSnapshot('');
    try {
      const prompt = buildSnapshotPrompt(selectedClient, selectedCase);
      const r = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '生成失败');
      const text = data.content?.[0]?.text || '';
      setSnapshot(text);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedClient, selectedCase]);

  const handleCopy = () => {
    navigator.clipboard.writeText(snapshot).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 12, color: C.text, fontSize: 13 }}>
        {selectedClient
          ? <span>当前客户：<strong>{selectedClient.name || selectedClient.email || '（未命名）'}</strong></span>
          : <span style={{ color: C.muted }}>请在主界面选择一个客户</span>}
        {selectedCase && (
          <span style={{ marginLeft: 8, color: C.muted }}>· 案件：{selectedCase.visaType || selectedCase.id}</span>
        )}
      </div>

      <button onClick={generate} disabled={loading || (!selectedClient && !selectedCase)}
        style={btnStyle(C.blue, loading || (!selectedClient && !selectedCase))}>
        {loading ? '⏳ 生成中...' : '✨ 生成客户快照'}
      </button>

      {error && <div style={errorStyle}>{error}</div>}

      {snapshot && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>客户快照</span>
            <button onClick={handleCopy} style={{ ...btnStyle(C.muted), padding: '3px 10px', fontSize: 11 }}>
              {copied ? '✓ 已复制' : '📋 复制'}
            </button>
          </div>
          <div style={{
            background: C.light, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: 12, fontSize: 13, color: C.text, lineHeight: 1.7,
            whiteSpace: 'pre-wrap', maxHeight: 380, overflowY: 'auto',
          }}>
            {snapshot}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Build snapshot prompt from client + case data ────────────────────────────
function buildSnapshotPrompt(client, caseObj) {
  const c = client || {};
  const s = caseObj || {};
  return `你是澳洲移民留学咨询公司 Ozsky Perth 的 AI 助理。
请根据以下客户信息生成一份简洁专业的客户快照，供顾问在接案前快速了解。

客户信息：
姓名：${c.name || '未知'}
邮箱：${c.email || ''}
电话：${c.phone || ''}
国籍：${c.nationality || ''}
护照号：${c.passportNo || ''}
护照到期：${c.passportExpiry || ''}
签证类型：${s.visaType || c.visaType || ''}
当前签证状态：${s.status || c.visaStatus || ''}
案件备注：${s.notes || c.notes || ''}
案件负责人：${s.assignee || ''}
核心需求：${s.keyNeeds || ''}
下一步行动：${s.nextAction || ''}

请生成包含以下部分的快照（中文，简洁清晰）：
1. 客户概况（1-2句话）
2. 签证情况与关键时间节点
3. 当前主要需求
4. 风险点或注意事项（如有）
5. 建议下一步行动

保持专业、准确，避免过多废话。`;
}

// ── Utilities ────────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const btnStyle = (bg, disabled = false) => ({
  background: disabled ? '#CCC' : bg,
  color: 'white', border: 'none', borderRadius: 6,
  padding: '8px 16px', cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 13, fontWeight: 600, transition: 'opacity 0.2s',
  opacity: disabled ? 0.6 : 1,
});

const inputStyle = {
  width: '100%', padding: '6px 10px', border: `1px solid ${C.border}`,
  borderRadius: 6, fontSize: 13, color: C.text, boxSizing: 'border-box',
  outline: 'none', background: 'white',
};

const labelStyle = {
  display: 'block', fontSize: 11, color: C.muted,
  marginBottom: 4, fontWeight: 600,
};

const badgeStyle = {
  display: 'inline-block', padding: '1px 6px', borderRadius: 10,
  fontSize: 10, fontWeight: 700, color: 'white',
};

const errorStyle = {
  background: '#FEF0EF', border: `1px solid ${C.red}`,
  color: C.red, borderRadius: 6, padding: '8px 10px',
  fontSize: 12, marginTop: 8,
};
