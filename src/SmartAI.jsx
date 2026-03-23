// src/SmartAI.jsx  —  v2  (2026-03)
// AI 智能助手面板：Gmail 同步 · 文件识别 · 客户快照
//
// 主要改进：
//   1. Gmail token 提升至顶层 state，快照面板可复用已授权的 token
//   2. Gmail 默认查询改为当前客户邮箱/姓名，搜全部邮件（不限未读）
//   3. 快照生成前自动抓取相关邮件作为上下文，生成详细中英文快照
//   4. 每封邮件可单独「保存到备注」
//   5. 快照格式与标准 .txt 模板对齐

import { useState, useEffect, useRef, useCallback } from 'react';

/* ── Brand colours ─────────────────────────────────────────────────────── */
const C = {
  blue:'#1E3A5F', gold:'#C9A84C', mid:'#2E6DA4',
  light:'#EBF3FB', border:'#D0E3F5',
  red:'#C0392B', green:'#27AE60', orange:'#E67E22',
  text:'#2C3E50', muted:'#7F8C8D', white:'#FFFFFF',
};
const urgencyColor = { urgent:C.red, high:C.orange, medium:C.gold, low:C.green };
const urgencyLabel = { urgent:'紧急', high:'高', medium:'中', low:'低' };

const DOC_TYPES = [
  { value:'passport',    label:'护照' },
  { value:'visa',        label:'签证' },
  { value:'education',   label:'学历证明' },
  { value:'employment',  label:'雇用证明' },
  { value:'bank',        label:'银行对账单' },
  { value:'skillsAssess',label:'职业评估' },
];

/* ════════════════════════════════════════════════════════════════════════
   Root component
════════════════════════════════════════════════════════════════════════ */
export default function SmartAI({ selectedClient, selectedCase, onImportClient, onImportCase, onAddNote }) {
  const [activeTab,    setActiveTab]    = useState('gmail');
  // Gmail token 提升到顶层，方便快照面板复用
  const [accessToken,  setAccessToken]  = useState(null);
  const [userEmail,    setUserEmail]    = useState('');

  // 从 URL fragment 读取 token（OAuth 回调后）
  useEffect(() => {
    if (!window.location.hash) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('gmail_access_token');
    const email = params.get('gmail_user_email') || '';
    if (token) {
      setAccessToken(token);
      setUserEmail(email);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setActiveTab('gmail');
    }
  }, []);

  return (
    <div style={{
      fontFamily:"'PingFang SC','Microsoft YaHei',sans-serif",
      background:C.white, border:`1px solid ${C.border}`,
      borderRadius:12, overflow:'hidden',
      boxShadow:'0 2px 12px rgba(30,58,95,0.1)',
    }}>
      {/* Header */}
      <div style={{
        background:`linear-gradient(135deg,${C.blue} 0%,${C.mid} 100%)`,
        color:C.white, padding:'16px 20px',
        display:'flex', alignItems:'center', gap:10,
      }}>
        <span style={{fontSize:22}}>🤖</span>
        <div>
          <div style={{fontWeight:700,fontSize:16}}>AI 智能助手</div>
          <div style={{fontSize:11,opacity:0.8}}>
            Gmail 同步 · 文件识别 · 客户快照
            {accessToken && <span style={{marginLeft:8,opacity:0.7}}>● Gmail 已连接</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${C.border}`,background:C.light}}>
        {[
          {id:'gmail',    icon:'📧', label:'Gmail 同步'},
          {id:'ocr',      icon:'📄', label:'文件识别'},
          {id:'snapshot', icon:'📊', label:'客户快照'},
        ].map(tab => (
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
            flex:1, padding:'10px 4px', border:'none', cursor:'pointer',
            background: activeTab===tab.id ? C.white : 'transparent',
            borderBottom: activeTab===tab.id ? `2px solid ${C.gold}` : '2px solid transparent',
            color: activeTab===tab.id ? C.blue : C.muted,
            fontWeight: activeTab===tab.id ? 700 : 400,
            fontSize:13, transition:'all 0.2s',
          }}>
            <span style={{marginRight:4}}>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      <div style={{padding:16}}>
        {activeTab==='gmail' && (
          <GmailPanel
            accessToken={accessToken} setAccessToken={setAccessToken}
            userEmail={userEmail} setUserEmail={setUserEmail}
            selectedClient={selectedClient}
            onImportClient={onImportClient} onImportCase={onImportCase}
            onAddNote={onAddNote}
          />
        )}
        {activeTab==='ocr' && (
          <OcrPanel onImportClient={onImportClient} onImportCase={onImportCase} selectedClient={selectedClient} />
        )}
        {activeTab==='snapshot' && (
          <SnapshotPanel
            selectedClient={selectedClient} selectedCase={selectedCase}
            accessToken={accessToken}
            onConnectGmail={() => setActiveTab('gmail')}
          />
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Gmail Panel
════════════════════════════════════════════════════════════════════════ */
function GmailPanel({ accessToken, setAccessToken, userEmail, setUserEmail,
                      selectedClient, onImportClient, onImportCase, onAddNote }) {

  // 默认查询：优先用客户邮箱搜全部往来邮件
  const defaultQuery = selectedClient?.email
    ? `from:${selectedClient.email} OR to:${selectedClient.email}`
    : selectedClient?.name
      ? `subject:"${selectedClient.name}"`
      : '';

  const [loading,     setLoading]     = useState(false);
  const [emails,      setEmails]      = useState([]);
  const [error,       setError]       = useState('');
  const [maxResults,  setMaxResults]  = useState(30);
  const [query,       setQuery]       = useState(defaultQuery);
  const [expandedId,  setExpandedId]  = useState(null);
  const [importingId, setImportingId] = useState(null);
  const [savingId,    setSavingId]    = useState(null);

  // 当切换客户时更新默认 query
  useEffect(() => {
    setQuery(defaultQuery);
    setEmails([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient?.id]);

  const handleConnect = async () => {
    try {
      const r = await fetch('/api/gmail-auth?action=url');
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
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ accessToken, maxResults, q: query || 'in:all' }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '同步失败');
      setEmails(data.emails || []);
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async (email) => {
    setSavingId(email.messageId);
    const ai = email.ai || {};
    const noteText = [
      `[Gmail 邮件 ${email.date?.slice(0,16) || ''}]`,
      `发件人：${email.from}`,
      `主题：${email.subject}`,
      ai.rawSummary ? `AI 摘要：${ai.rawSummary}` : '',
      ai.suggestedAction ? `建议行动：${ai.suggestedAction}` : '',
    ].filter(Boolean).join('\n');
    onAddNote?.(noteText);
    setEmails(prev => prev.map(e => e.messageId===email.messageId ? {...e, _saved:true} : e));
    setSavingId(null);
  };

  const handleImport = (email) => {
    setImportingId(email.messageId);
    const ai = email.ai || {};
    if (onImportClient) onImportClient({
      name:        ai.clientName  || '',
      email:       ai.clientEmail || email.from?.match(/<(.+)>/)?.[1] || '',
      phone:       ai.clientPhone || '',
      nationality: ai.nationality || '',
    });
    if (onImportCase) onImportCase({
      visaType:   ai.visaType          || '',
      status:     ai.currentVisaStatus || '',
      assignee:   ai.suggestedAssignee || '',
      priority:   ai.urgency           || 'medium',
      nextAction: ai.suggestedAction   || '',
      keyNeeds:   ai.keyNeeds          || '',
    });
    if (onAddNote && ai.rawSummary) {
      onAddNote(`[Gmail导入 ${new Date().toLocaleString('zh-CN')}]\n来自：${email.from}\n主题：${email.subject}\n摘要：${ai.rawSummary}`);
    }
    setEmails(prev => prev.map(e => e.messageId===email.messageId ? {...e,_imported:true} : e));
    setImportingId(null);
  };

  if (!accessToken) {
    return (
      <div style={{textAlign:'center',padding:'24px 0'}}>
        <div style={{fontSize:40,marginBottom:12}}>📬</div>
        <div style={{color:C.blue,fontWeight:600,marginBottom:6}}>连接 Gmail 邮箱</div>
        <div style={{color:C.muted,fontSize:13,marginBottom:4}}>授权后 AI 将自动识别客户邮件并提取信息</div>
        {selectedClient?.email && (
          <div style={{color:C.mid,fontSize:12,marginBottom:16}}>
            将搜索与 <strong>{selectedClient.email}</strong> 相关的所有邮件
          </div>
        )}
        <button onClick={handleConnect} style={btnStyle(C.blue)}>🔐 连接 Google 账号</button>
        {error && <div style={errorStyle}>{error}</div>}
      </div>
    );
  }

  return (
    <div>
      {/* Connected bar */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <span style={{color:C.green,fontSize:12}}>●</span>
        <span style={{fontSize:12,color:C.muted}}>{userEmail || '已连接 Gmail'}</span>
        <button onClick={()=>{setAccessToken(null);setEmails([]);}}
          style={{...btnStyle(C.muted),padding:'3px 8px',fontSize:11,marginLeft:'auto'}}>断开</button>
      </div>

      {/* Search bar */}
      <div style={{background:C.light,borderRadius:8,padding:12,marginBottom:12}}>
        {selectedClient?.email && (
          <div style={{fontSize:11,color:C.mid,marginBottom:6}}>
            当前客户：<strong>{selectedClient.name}</strong>
            <button onClick={()=>setQuery(`from:${selectedClient.email} OR to:${selectedClient.email}`)}
              style={{marginLeft:8,background:'none',border:`1px solid ${C.mid}`,borderRadius:4,
                padding:'1px 6px',fontSize:11,color:C.mid,cursor:'pointer'}}>
              重置为客户邮件
            </button>
          </div>
        )}
        <div style={{display:'flex',gap:8,marginBottom:8}}>
          <div style={{flex:1}}>
            <label style={labelStyle}>搜索条件（留空 = 全部）</label>
            <input value={query} onChange={e=>setQuery(e.target.value)} style={inputStyle}
              placeholder={`from:xxx@gmail.com OR subject:客户姓名`} />
          </div>
          <div style={{width:70}}>
            <label style={labelStyle}>数量</label>
            <input type="number" min={1} max={100} value={maxResults}
              onChange={e=>setMaxResults(Number(e.target.value))} style={inputStyle}/>
          </div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button onClick={handleSync} disabled={loading} style={btnStyle(C.mid,loading)}>
            {loading ? '⏳ 读取中...' : '🔄 读取邮件'}
          </button>
          {emails.length > 0 && (
            <button
              onClick={() => {
                const relevant = emails.filter(e => e.ai?.isRelevant);
                relevant.forEach(e => handleSaveNote(e));
              }}
              style={btnStyle(C.green)}
            >
              💾 全部保存到备注 ({emails.filter(e=>e.ai?.isRelevant&&!e._saved).length})
            </button>
          )}
        </div>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      {emails.length===0 && !loading && (
        <div style={{textAlign:'center',color:C.muted,padding:20,fontSize:13}}>
          {query ? `点击「读取邮件」搜索：${query}` : '点击「读取邮件」获取全部邮件'}
        </div>
      )}

      {/* Stats bar */}
      {emails.length > 0 && (
        <div style={{fontSize:12,color:C.muted,marginBottom:8}}>
          共 {emails.length} 封 · 相关 {emails.filter(e=>e.ai?.isRelevant).length} 封 · 已保存 {emails.filter(e=>e._saved).length} 封
        </div>
      )}

      {/* Email list */}
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {emails.map(email => {
          const ai  = email.ai || {};
          const exp = expandedId===email.messageId;
          return (
            <div key={email.messageId} style={{
              border:`1px solid ${ai.isRelevant ? C.border:'#EEE'}`,
              borderLeft:`3px solid ${ai.isRelevant ? (urgencyColor[ai.urgency]||C.gold):'#CCC'}`,
              borderRadius:8, overflow:'hidden',
              opacity: ai.isRelevant ? 1 : 0.6,
            }}>
              <div onClick={()=>setExpandedId(exp?null:email.messageId)}
                style={{padding:'10px 12px',cursor:'pointer',display:'flex',alignItems:'flex-start',gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:2}}>
                    {ai.isRelevant && (
                      <span style={{...badgeStyle,background:urgencyColor[ai.urgency]||C.gold}}>
                        {urgencyLabel[ai.urgency]||'?'}
                      </span>
                    )}
                    {ai.enquiryType && <span style={{...badgeStyle,background:C.mid}}>{ai.enquiryType}</span>}
                    {!ai.isRelevant && <span style={{...badgeStyle,background:C.muted}}>非业务邮件</span>}
                    {email._saved    && <span style={{...badgeStyle,background:C.green}}>✓ 已存备注</span>}
                    {email._imported && <span style={{...badgeStyle,background:C.blue}}>✓ 已导入</span>}
                  </div>
                  <div style={{fontWeight:600,fontSize:13,color:C.text,
                    whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                    {email.subject||'（无主题）'}
                  </div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                    {email.from?.slice(0,50)} · {email.date?.slice(0,16)}
                  </div>
                  {ai.rawSummary && (
                    <div style={{fontSize:12,color:C.text,marginTop:4,opacity:0.85}}>
                      {ai.rawSummary}
                    </div>
                  )}
                </div>
                <span style={{color:C.muted,fontSize:12,flexShrink:0}}>{exp?'▲':'▼'}</span>
              </div>

              {exp && (
                <div style={{borderTop:`1px solid ${C.border}`,padding:'12px',background:C.light}}>
                  {ai.isRelevant && (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                      {[
                        ['客户姓名',ai.clientName],['邮箱',ai.clientEmail],
                        ['国籍',ai.nationality],['签证类型',ai.visaType],
                        ['当前状态',ai.currentVisaStatus],['建议分配',ai.suggestedAssignee],
                        ['核心需求',ai.keyNeeds],
                      ].filter(([,v])=>v).map(([k,v])=>(
                        <div key={k} style={{background:C.white,borderRadius:6,padding:'6px 8px'}}>
                          <div style={{fontSize:10,color:C.muted}}>{k}</div>
                          <div style={{fontSize:12,color:C.text,fontWeight:500}}>{v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {ai.suggestedAction && (
                    <div style={{background:'#FFF9EC',border:`1px solid ${C.gold}`,borderRadius:6,
                      padding:'8px 10px',marginBottom:10,fontSize:12}}>
                      <span style={{color:C.gold,fontWeight:600}}>💡 建议行动：</span>
                      <span style={{color:C.text}}>{ai.suggestedAction}</span>
                    </div>
                  )}
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    <button onClick={()=>handleSaveNote(email)}
                      disabled={savingId===email.messageId || email._saved}
                      style={btnStyle(email._saved ? C.green : C.orange, savingId===email.messageId||email._saved)}>
                      {email._saved ? '✓ 已保存到备注' : savingId===email.messageId ? '⏳' : '💾 保存到备注'}
                    </button>
                    {ai.isRelevant && (
                      <button onClick={()=>handleImport(email)}
                        disabled={importingId===email.messageId||email._imported}
                        style={btnStyle(email._imported?C.green:C.blue, importingId===email.messageId||email._imported)}>
                        {email._imported ? '✓ 已导入' : importingId===email.messageId ? '⏳' : '⬆️ 导入到客户/案件'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Snapshot Panel  —  先抓邮件再生成快照
════════════════════════════════════════════════════════════════════════ */
function SnapshotPanel({ selectedClient, selectedCase, accessToken, onConnectGmail }) {
  const [loading,   setLoading]   = useState(false);
  const [step,      setStep]      = useState('');   // 进度描述
  const [snapshot,  setSnapshot]  = useState('');
  const [error,     setError]     = useState('');
  const [copied,    setCopied]    = useState(false);
  const [emailCount,setEmailCount]= useState(0);

  const generate = useCallback(async () => {
    if (!selectedClient) { setError('请先选择客户'); return; }
    setLoading(true); setError(''); setSnapshot(''); setEmailCount(0);

    let emailContext = '';

    // ── Step 1: 尝试从 Gmail 拉取相关邮件 ──────────────────────────────
    if (accessToken && selectedClient.email) {
      setStep('📧 正在搜索相关邮件...');
      try {
        const gmailQ = `from:${selectedClient.email} OR to:${selectedClient.email}`;
        const r = await fetch('/api/gmail-sync', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ accessToken, maxResults:20, q: gmailQ }),
        });
        if (r.ok) {
          const data = await r.json();
          const relevant = (data.emails || []).filter(e => e.ai?.isRelevant !== false);
          setEmailCount(relevant.length);
          if (relevant.length > 0) {
            emailContext = relevant.slice(0, 10).map((e, i) => {
              const ai = e.ai || {};
              return [
                `[邮件${i+1}] 日期：${e.date?.slice(0,16)} | 主题：${e.subject}`,
                ai.rawSummary      ? `摘要：${ai.rawSummary}`           : '',
                ai.keyNeeds        ? `需求：${ai.keyNeeds}`             : '',
                ai.suggestedAction ? `建议：${ai.suggestedAction}`      : '',
                ai.visaType        ? `签证类型：${ai.visaType}`          : '',
                ai.extractedDates?.length ? `重要日期：${ai.extractedDates.join(', ')}` : '',
              ].filter(Boolean).join('\n');
            }).join('\n\n');
          }
        }
      } catch(e) {
        // Gmail 失败不阻断，继续用 CRM 数据
        console.warn('Gmail fetch for snapshot failed:', e);
      }
    }

    // ── Step 2: 调用 Claude 生成快照 ────────────────────────────────────
    setStep('🤖 正在生成快照...');
    try {
      const prompt = buildSnapshotPrompt(selectedClient, selectedCase, emailContext);
      const r = await fetch('/api/claude', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          messages: [{ role:'user', content: prompt }],
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '生成失败');
      setSnapshot(data.content?.[0]?.text || '');
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false); setStep('');
    }
  }, [selectedClient, selectedCase, accessToken]);

  const handleCopy = () => {
    navigator.clipboard.writeText(snapshot).then(() => {
      setCopied(true); setTimeout(()=>setCopied(false), 2000);
    });
  };

  const handleSaveTxt = () => {
    const blob = new Blob([snapshot], { type:'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${selectedClient?.name || 'Client'}_Snapshot_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Client info bar */}
      <div style={{marginBottom:12,padding:'10px 12px',background:C.light,borderRadius:8}}>
        {selectedClient ? (
          <div>
            <div style={{fontWeight:600,fontSize:13,color:C.blue}}>{selectedClient.name || selectedClient.email}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>
              {[selectedClient.email, selectedClient.nationality, selectedClient.profile?.passportNo]
                .filter(Boolean).join(' · ')}
            </div>
            {selectedCase && (
              <div style={{fontSize:12,color:C.mid,marginTop:2}}>
                案件：{selectedCase.type || selectedCase.title || '—'}
              </div>
            )}
          </div>
        ) : (
          <span style={{color:C.muted,fontSize:13}}>请先在主界面选择一个客户</span>
        )}
      </div>

      {/* Gmail hint */}
      {!accessToken && selectedClient && (
        <div style={{background:'#FFF9EC',border:`1px solid ${C.gold}`,borderRadius:8,
          padding:'10px 12px',marginBottom:12,fontSize:12}}>
          <span style={{color:C.gold,fontWeight:600}}>💡 提示：</span>
          <span style={{color:C.text}}>连接 Gmail 后快照将自动读取相关邮件，信息更完整。</span>
          <button onClick={onConnectGmail}
            style={{marginLeft:8,background:'none',border:`1px solid ${C.gold}`,
              borderRadius:4,padding:'2px 8px',fontSize:11,color:C.gold,cursor:'pointer'}}>
            去连接 →
          </button>
        </div>
      )}
      {accessToken && selectedClient?.email && !snapshot && (
        <div style={{fontSize:12,color:C.green,marginBottom:10}}>
          ✅ Gmail 已连接，将自动读取与 <strong>{selectedClient.email}</strong> 相关邮件作为快照依据
        </div>
      )}

      <button onClick={generate}
        disabled={loading || !selectedClient}
        style={btnStyle(C.blue, loading || !selectedClient)}>
        {loading ? `⏳ ${step}` : '✨ 生成客户快照'}
      </button>

      {emailCount > 0 && !loading && (
        <div style={{fontSize:12,color:C.green,marginTop:8}}>
          ✅ 已读取 {emailCount} 封相关邮件作为生成依据
        </div>
      )}

      {error && <div style={errorStyle}>{error}</div>}

      {snapshot && (
        <div style={{marginTop:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>客户快照</span>
            <div style={{display:'flex',gap:6}}>
              <button onClick={handleSaveTxt}
                style={{...btnStyle(C.mid),padding:'4px 10px',fontSize:11}}>
                ⬇️ 下载 .txt
              </button>
              <button onClick={handleCopy}
                style={{...btnStyle(C.muted),padding:'4px 10px',fontSize:11}}>
                {copied ? '✓ 已复制' : '📋 复制'}
              </button>
            </div>
          </div>
          <div style={{
            background:C.light, border:`1px solid ${C.border}`, borderRadius:8,
            padding:12, fontSize:13, color:C.text, lineHeight:1.8,
            whiteSpace:'pre-wrap', maxHeight:440, overflowY:'auto',
            fontFamily:"'JetBrains Mono','Courier New',monospace",
          }}>
            {snapshot}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   OCR Panel
════════════════════════════════════════════════════════════════════════ */
function OcrPanel({ onImportClient, onImportCase, selectedClient }) {
  const [docType,  setDocType]  = useState('passport');
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState('');
  const [preview,  setPreview]  = useState('');
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setResult(null);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => setPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else { setPreview(''); }
    const base64 = await fileToBase64(file);
    setLoading(true);
    try {
      const r = await fetch('/api/parse-document', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ fileBase64:base64, mimeType:file.type, documentType:docType, fileName:file.name }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error||'识别失败');
      setResult(data);
    } catch(err) {
      setError(err.message);
    } finally {
      setLoading(false); e.target.value='';
    }
  };

  const handleImport = () => {
    if (!result?.extracted) return;
    const d = result.extracted;
    if (docType==='passport') {
      onImportClient?.({
        name: d.fullName || `${d.firstName||''} ${d.lastName||''}`.trim(),
        dob:  d.dateOfBirth, nationality: d.nationality,
        passportNo: d.passportNumber, passportExpiry: d.expiryDate,
      });
    } else if (docType==='visa') {
      onImportCase?.({
        visaType: d.visaSubclass ? `子类 ${d.visaSubclass}` : d.visaType,
        visaExpiry: d.expiryDate, visaGrantDate: d.grantDate,
        visaConditions: (d.conditions||[]).join(', '), caseRef: d.caseReference,
      });
    }
  };

  const confColor = result?.confidence==='high' ? C.green : result?.confidence==='medium' ? C.orange : C.red;

  return (
    <div>
      <div style={{marginBottom:12}}>
        <label style={labelStyle}>文件类型</label>
        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
          {DOC_TYPES.map(t=>(
            <button key={t.value} onClick={()=>{setDocType(t.value);setResult(null);setError('');}} style={{
              padding:'5px 12px', borderRadius:20,
              border:`1px solid ${docType===t.value?C.blue:C.border}`,
              background: docType===t.value?C.blue:'white',
              color: docType===t.value?'white':C.text,
              cursor:'pointer', fontSize:12, fontWeight:docType===t.value?600:400,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div onClick={()=>fileRef.current?.click()} style={{
        border:`2px dashed ${C.border}`, borderRadius:10, padding:'20px',
        textAlign:'center', cursor:'pointer', background:C.light,
      }}
        onDragOver={e=>e.preventDefault()}
        onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files?.[0];if(f){fileRef.current.files=e.dataTransfer.files;handleFile({target:fileRef.current});}}}
      >
        {preview ? (
          <img src={preview} alt="preview" style={{maxHeight:160,maxWidth:'100%',borderRadius:6}}/>
        ) : (
          <><div style={{fontSize:32,marginBottom:8}}>📂</div>
            <div style={{color:C.blue,fontWeight:600,fontSize:14}}>点击上传或拖拽文件</div>
            <div style={{color:C.muted,fontSize:12,marginTop:4}}>支持 JPG · PNG · PDF</div></>
        )}
        <input ref={fileRef} type="file" accept="image/*,.pdf" style={{display:'none'}} onChange={handleFile}/>
      </div>

      {loading && (
        <div style={{textAlign:'center',padding:16,color:C.mid}}>
          <div style={{fontSize:24}}>⏳</div>
          <div style={{fontSize:13,marginTop:6}}>AI 正在识别文件...</div>
        </div>
      )}
      {error && <div style={errorStyle}>{error}</div>}

      {result && !loading && (
        <div style={{marginTop:12}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>识别结果</span>
            <span style={{...badgeStyle,background:confColor}}>
              {result.confidence==='high'?'高置信度':result.confidence==='medium'?'中置信度':'低置信度'}
              {' '}({result.fillRate}%)
            </span>
          </div>
          <div style={{background:C.light,borderRadius:8,padding:12}}>
            {Object.entries(result.extracted)
              .filter(([,v])=>v!==null&&v!==undefined&&v!=='')
              .map(([k,v])=>(
                <div key={k} style={{display:'flex',borderBottom:`1px solid ${C.border}`,padding:'5px 0',fontSize:12}}>
                  <span style={{color:C.muted,width:130,flexShrink:0}}>{k}</span>
                  <span style={{color:C.text,fontWeight:500}}>{Array.isArray(v)?v.join(', '):String(v)}</span>
                </div>
              ))}
          </div>
          <button onClick={handleImport} style={{...btnStyle(C.blue),marginTop:10}}>
            ⬆️ 填入{selectedClient?`「${selectedClient.name||'当前客户'}」`:'当前客户/案件'}信息
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Snapshot prompt ─────────────────────────────────────────────────── */
function buildSnapshotPrompt(client, caseObj, emailContext) {
  const c  = client  || {};
  const p  = c.profile || {};
  const s  = caseObj || {};

  // 组装 CRM 已有数据
  const crmData = [
    c.name         && `姓名：${c.name}`,
    c.email        && `邮箱：${c.email}`,
    c.phone        && `电话：${c.phone}`,
    c.nationality  && `国籍：${c.nationality}`,
    p.dob          && `出生日期：${p.dob}`,
    p.passportNo   && `护照号：${p.passportNo}`,
    p.passportExpiry && `护照有效期：${p.passportExpiry}`,
    p.auAddress    && `澳洲地址：${p.auAddress}`,
    p.visaTarget   && `签证目标：${p.visaTarget}`,
    p.consultant   && `负责顾问：${p.consultant}`,
    s.type         && `当前案件类型：${s.type}`,
    s.status       && `案件状态：${s.status}`,
    s.notes        && `案件备注：${s.notes}`,
    // 签证历史
    p.visaHistory?.length && `签证历史：\n${p.visaHistory.map(v=>`  - ${v.visaType||''} ${v.granted?'(批准:'+v.granted+')':''} ${v.expiry?'到期:'+v.expiry:''}`).join('\n')}`,
    // 职业评估
    p.skillsAssessments?.length && `职业评估：\n${p.skillsAssessments.map(a=>`  - ${a.occupation||''} ${a.outcome||''} ${a.submitted?'递交:'+a.submitted:''}`).join('\n')}`,
    // 大事记
    p.caseTimeline?.length && `案件时间线：\n${p.caseTimeline.map(t=>`  [${t.date||''}] ${t.event||''} — ${t.status||''}`).join('\n')}`,
    // 当前问题
    p.keyIssues?.length && `关键问题：\n${p.keyIssues.map(i=>`  [${i.priority||''}] ${i.item||''}: ${i.detail||''}`).join('\n')}`,
    // 服务合同
    p.serviceAgreement?.totalFee && `服务合同：总费用 ${p.serviceAgreement.totalFee}，签署日 ${p.serviceAgreement.contractDate||'—'}`,
    // 客户备注
    c.notes?.length && `备注记录：\n${(Array.isArray(c.notes)?c.notes:[]).slice(0,5).map(n=>`  [${n.createdAt?.slice(0,10)||''}] ${n.text||''}`).join('\n')}`,
  ].filter(Boolean).join('\n');

  return `你是澳洲移民留学咨询公司 Ozsky Perth 的 AI 助理。
请根据以下资料生成一份详细专业的客户快照，供顾问接案前阅读。

═══════════════════════════
CRM 档案数据：
═══════════════════════════
${crmData || '（暂无 CRM 数据）'}

${emailContext ? `═══════════════════════════
相关邮件摘要（共 ${emailContext.split('[邮件').length - 1} 封）：
═══════════════════════════
${emailContext}` : ''}

═══════════════════════════
请按以下格式输出快照（中英文双语，尽量详细）：

================================================================================
  客户快照  |  CLIENT SNAPSHOT
  [姓名] — [签证类型]
  生成日期：[今天日期]
================================================================================

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
一、基本信息  PERSONAL DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
（填入已知信息，未知填"待补充"）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
二、签证状态  VISA STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
（当前签证、有效期、条件等）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
三、案件进展  CASE PROGRESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
（从邮件和 CRM 数据综合整理）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
四、⚠️ 关键风险与待办事项  KEY ISSUES & ACTION ITEMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
（按🔴高 🟡中 🟢低 优先级列出）

================================================================================
  本快照由 AI 辅助整理，仅供移民代理内部参考，不构成法律意见。
================================================================================

注意：如果资料不足某一项，请说明"资料待补充"而不是留空。`;
}

/* ── Utilities ──────────────────────────────────────────────────────── */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const btnStyle = (bg, disabled=false) => ({
  background: disabled?'#CCC':bg, color:'white', border:'none', borderRadius:6,
  padding:'8px 16px', cursor:disabled?'not-allowed':'pointer',
  fontSize:13, fontWeight:600, transition:'opacity 0.2s', opacity:disabled?0.6:1,
});
const inputStyle = {
  width:'100%', padding:'6px 10px', border:`1px solid ${C.border}`,
  borderRadius:6, fontSize:13, color:C.text, boxSizing:'border-box',
  outline:'none', background:'white',
};
const labelStyle = { display:'block', fontSize:11, color:C.muted, marginBottom:4, fontWeight:600 };
const badgeStyle = {
  display:'inline-block', padding:'1px 6px', borderRadius:10,
  fontSize:10, fontWeight:700, color:'white',
};
const errorStyle = {
  background:'#FEF0EF', border:`1px solid ${C.red}`,
  color:C.red, borderRadius:6, padding:'8px 10px',
  fontSize:12, marginTop:8,
};
