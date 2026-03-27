// src/CaseAI.jsx
import React, { useState, useCallback } from 'react';
import * as mammoth from 'mammoth';
import { readSession, sessionIsValid, getValidToken } from './utils/gmailSession';

const C = {
  blue: '#4f46e5', green: '#059669', red: '#dc2626',
  orange: '#d97706', mid: '#64748b', muted: '#94a3b8',
  border: '#e2e8f0',
};

const btnStyle = (color, disabled) => ({
  padding: '9px 16px', fontSize: 13, fontWeight: 600,
  background: disabled ? '#e5e7eb' : color,
  color: disabled ? '#9ca3af' : '#fff',
  border: 'none', borderRadius: 8, cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.7 : 1,
});

/* ── JSON repair (same as SmartAI) ──────────────────────────────────────── */
function repairAndParseJSON(raw) {
  try { return JSON.parse(raw); } catch { /* fall through */ }
  let s = raw.replace(/,\s*$/, '').replace(/:\s*$/, ':null').replace(/"[^"]*$/, '"');
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

/* ── Shared Claude fetch (both Generate and Apply calls) ────────────────── */
async function callClaude(body) {
  const r = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const rawText = await r.text();
  let data;
  try { data = JSON.parse(rawText); }
  catch {
    throw new Error(r.status === 413
      ? 'PDF 文件太大，请减小文件大小后重试（Vercel 请求体限制 4.5MB）'
      : `服务器返回非 JSON 响应 (${r.status}): ${rawText.slice(0, 120)}`);
  }
  if (!r.ok) throw new Error(
    typeof data.error === 'object'
      ? (data.error?.message || JSON.stringify(data.error))
      : data.error || '请求失败'
  );
  return data;
}

/* ── Prompt builder ─────────────────────────────────────────────────────── */
function buildCaseBriefPrompt(client, caseObj, emailContext, driveContext) {
  const c = caseObj || {};
  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

  const crmData = [
    client?.name        && `客户姓名：${client.name}`,
    client?.email       && `邮箱：${client.email}`,
    client?.phone       && `电话：${client.phone}`,
    c.type              && `案件类型：${c.type}`,
    c.status            && `当前状态：${c.status}`,
    c.priority          && `优先级：${c.priority}`,
    c.dueDate           && `截止日期：${new Date(c.dueDate).toLocaleDateString('zh-CN')}`,
    c.snapshot          && `案件摘要：${c.snapshot}`,
    c.caseTimeline?.length && `时间线：\n${c.caseTimeline.map(t =>
      `  [${t.date || ''}] ${t.event || ''} — ${t.status || ''}`).join('\n')}`,
    c.keyIssues?.length && `关键问题：\n${c.keyIssues.map(i =>
      `  [${i.priority || ''}] ${i.item || ''}`).join('\n')}`,
    c.nextSteps?.length && `下步行动：\n${c.nextSteps.map((s, i) =>
      `  ${i + 1}. ${s}`).join('\n')}`,
    c.docs && Object.keys(c.docs).length && `文件清单：\n${Object.entries(c.docs).map(([k, v]) =>
      `  [${v ? '✓' : ' '}] ${k}`).join('\n')}`,
  ].filter(Boolean).join('\n');

  return `你是澳洲移民公司 Ozsky Perth 的 AI 助理。
根据以下资料，生成一份案件进度简报，供顾问接案或内部交接使用。
如某项信息不足，写"资料待补充"，不要虚构。

${driveContext ? `╔═══════════════════════════════════════════════╗
║  📁 Google Drive 客户文件夹文件（主要数据来源）  ║
╚═══════════════════════════════════════════════╝
${driveContext}

` : ''}═══════════════════════════════
CRM 案件数据（补充参考）：
═══════════════════════════════
${crmData || '（暂无 CRM 数据）'}

${emailContext ? `═══════════════════════════════
相关邮件摘要：
═══════════════════════════════
${emailContext}` : ''}

═══════════════════════════════
请严格按以下格式输出（中英文双语，内容尽量详细）：

================================================================================
  案件进度简报  |  CASE PROGRESS BRIEF
  ${client?.name || '[客户姓名]'} — ${c.type || '[案件类型]'}
  生成日期：${today} | 经办顾问：${caseObj?.assignedTo || 'Liang Jiang'} | Ozsky Migration
================================================================================

━━━ 一、案件概况  CASE OVERVIEW ━━━
案件类型、当前状态、优先级、截止日期

━━━ 二、文件进度  DOCUMENT STATUS ━━━
列出所有文件，标注 [✓] 已收到 / [ ] 待收集
以 Drive 文件夹内容为主，结合 CRM 文件清单

━━━ 三、当前进展  CURRENT PROGRESS ━━━
已完成 / 处理中 / 待办

━━━ 四、关键问题与风险  KEY ISSUES & RISKS ━━━
🔴 高 / 🟡 中 / 🟢 低

━━━ 五、下步行动  NEXT STEPS ━━━
编号行动项，注明优先级

━━━ 六、时间线  TIMELINE ━━━
YYYY-MM-DD | 事件 — 状态（Completed / In Progress / Pending）

================================================================================
  本简报由 AI 辅助整理，仅供内部参考，不构成法律意见。
================================================================================

如输出长度受限，优先保留：一、二、四、五节。`;
}

/* ── Main component ─────────────────────────────────────────────────────── */
export default function CaseAI({ selectedClient, selectedCase, onSaveCase }) {
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [step, setStep]           = useState('');
  const [brief, setBrief]         = useState('');
  const [error, setError]         = useState('');
  const [driveStatus, setDriveStatus] = useState(null);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyMsg, setApplyMsg]   = useState('');

  const generate = useCallback(async () => {
    if (!selectedCase) return;
    setLoading(true); setError(''); setBrief(''); setDriveStatus(null);

    const gmail = readSession();
    let driveContext = '';
    let pdfBlocks = [];

    // ── Drive ──────────────────────────────────────────────────────────────
    if (selectedClient && sessionIsValid(gmail)) {
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
            if (driveData.folderFound && driveData.processed?.length) {
              const textParts = [];
              const binaryNames = [];
              for (const f of driveData.processed) {
                if (f.textContent) {
                  textParts.push(`[文件: ${f.name}]\n${f.textContent.slice(0, 4000)}`);
                } else if (
                  f.base64Content &&
                  f.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                ) {
                  try {
                    const binary = atob(f.base64Content);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    const { value: docxText } = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
                    if (docxText?.trim()) {
                      textParts.push(`[文件: ${f.name}]\n${docxText.slice(0, 4000)}`);
                    } else {
                      binaryNames.push(`  [✓] ${f.name}`);
                    }
                  } catch {
                    binaryNames.push(`  [✓] ${f.name}`);
                  }
                } else if (
                  (f.mimeType?.includes('pdf') || f.mimeType?.startsWith('image/')) &&
                  pdfBlocks.length < 3
                ) {
                  setStep(`📄 下载文件: ${f.name}...`);
                  try {
                    let fileBase64 = f.base64Content;
                    if (!fileBase64) {
                      const dlRes = await fetch(
                        `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&supportsAllDrives=true`,
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
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
                      pdfBlocks.push({
                        type: blockType,
                        source: { type: 'base64', media_type: f.mimeType, data: fileBase64 },
                        _name: f.name,
                      });
                    } else {
                      binaryNames.push(`  [✓] ${f.name}`);
                    }
                  } catch {
                    binaryNames.push(`  [✓] ${f.name}`);
                  }
                } else {
                  binaryNames.push(`  [✓] ${f.name}`);
                }
              }
              const parts = [...textParts];
              if (pdfBlocks.length) {
                parts.push(`以下 PDF/图片文件已附加至消息供 AI 直接阅读：\n${pdfBlocks.map(b => `  [📄] ${b._name}`).join('\n')}`);
              }
              if (binaryNames.length) {
                parts.push(`已存档（未读取）：\n${binaryNames.join('\n')}`);
              }
              if (parts.length) {
                driveContext = `Google Drive 文件夹: ${driveData.folderName} (共${driveData.totalFiles}个文件)\n\n` +
                  parts.join('\n\n---\n\n');
              }
              setDriveStatus({
                found: true,
                folderName: driveData.folderName,
                fileCount: driveData.totalFiles,
                readCount: textParts.length + pdfBlocks.length,
              });
            } else {
              setDriveStatus({ found: false, message: driveData.message || '未找到客户文件夹' });
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

    // ── Gmail ──────────────────────────────────────────────────────────────
    let emailContext = '';
    if (selectedClient && sessionIsValid(gmail)) {
      setStep('📧 读取相关邮件...');
      try {
        const token = await getValidToken();
        if (token) {
          const gmailQ = selectedClient.email
            ? `from:${selectedClient.email} OR to:${selectedClient.email}`
            : `"${selectedClient.name}"`;
          const r = await fetch('/api/gmail-sync', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: token, maxResults: 10, q: gmailQ }),
          });
          if (r.ok) {
            const data = await r.json();
            const relevant = (data.emails || []).filter(e => e.ai?.isRelevant !== false);
            if (relevant.length > 0) {
              emailContext = relevant.slice(0, 10).map((e, i) => {
                const ai = e.ai || {};
                return [
                  `[邮件${i + 1}] ${e.date ? new Date(e.date).toLocaleDateString('zh-CN') : ''} | ${e.subject}`,
                  ai.rawSummary && `摘要：${ai.rawSummary}`,
                  ai.keyNeeds   && `需求：${ai.keyNeeds}`,
                ].filter(Boolean).join('\n');
              }).join('\n\n');
            }
          }
        }
      } catch { /* non-blocking */ }
    }

    // ── Generate brief ─────────────────────────────────────────────────────
    setStep('🤖 生成案件简报...');
    try {
      const prompt = buildCaseBriefPrompt(selectedClient, selectedCase, emailContext, driveContext);

      // Cap combined PDF payload at 3MB (Vercel body limit is 4.5MB)
      const MAX_PDF_BYTES = 3 * 1024 * 1024;
      let totalPdfBytes = 0;
      const safePdfBlocks = [];
      const skippedNames = [];
      for (const block of pdfBlocks) {
        const sz = (block.source?.data?.length || 0) * 0.75;
        if (totalPdfBytes + sz <= MAX_PDF_BYTES) {
          safePdfBlocks.push(block);
          totalPdfBytes += sz;
        } else {
          skippedNames.push(block._name);
        }
      }
      const hasPdfs = safePdfBlocks.length > 0;
      const finalPrompt = skippedNames.length
        ? prompt + `\n\n（以下文件因超出大小限制未能附加，请人工查阅：${skippedNames.join('、')}）`
        : prompt;
      const messageContent = hasPdfs
        ? [{ type: 'text', text: finalPrompt }, ...safePdfBlocks.map(({ type, source }) => ({ type, source }))]
        : finalPrompt;

      const data = await callClaude({
        model: 'claude-sonnet-4-6', max_tokens: 4096,
        messages: [{ role: 'user', content: messageContent }],
        ...(hasPdfs ? { _beta: 'pdfs-2024-09-25' } : {}),
      });
      setBrief(data.content?.[0]?.text || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false); setStep('');
    }
  }, [selectedClient, selectedCase]);

  const handleApply = async () => {
    if (!brief) return;
    setApplyBusy(true); setError('');
    try {
      const data = await callClaude({
        model: 'claude-sonnet-4-6', max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `从以下案件简报提取信息，返回纯 JSON（无 markdown，无注释）。只填写找到的字段，找不到的用空字符串或空数组。

{
  "status": "",
  "snapshot": "",
  "caseTimeline": [{ "date": "", "event": "", "status": "Completed" }],
  "docs": { "Document Name": true },
  "keyIssues": [{ "item": "", "priority": "High" }],
  "nextSteps": [""]
}

规则：
1. status: 英文，如 "In Progress" / "Awaiting Decision"
2. snapshot: 一句话案件摘要（中文）
3. caseTimeline: status 用 Completed/In Progress/Pending/Urgent
4. docs: true = 已收到，false = 待收集
5. keyIssues: priority 用 High/Medium/Low
6. nextSteps: 每条一个字符串

简报文本：\n${brief}`,
        }],
      });

      const text = data.content?.[0]?.text || '';

      // Balanced-bracket JSON extractor
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
      const ex = repairAndParseJSON(jsonStr);

      // Merge caseTimeline — append only, dedup by trim+lowercase date AND event
      const existingTimeline = selectedCase.caseTimeline || [];
      const existingKeys = new Set(
        existingTimeline.map(t =>
          `${(t.date || '').trim().toLowerCase()}|${(t.event || '').trim().toLowerCase()}`
        )
      );
      const newEntries = (ex.caseTimeline || []).filter(t => {
        if (!t.date && !t.event) return false;
        return !existingKeys.has(
          `${(t.date || '').trim().toLowerCase()}|${(t.event || '').trim().toLowerCase()}`
        );
      });
      const mergedTimeline = [...existingTimeline, ...newEntries];

      // Merge docs — add new keys; upgrade false→true; never overwrite true→false
      const existingDocs = selectedCase.docs || {};
      const mergedDocs = { ...existingDocs };
      for (const [k, v] of Object.entries(ex.docs || {})) {
        if (!(k in mergedDocs)) {
          mergedDocs[k] = v;
        } else if (v === true) {
          mergedDocs[k] = true;
        }
        // v === false on existing key: leave unchanged
      }

      // Build note — included in updatedCase so single write covers everything
      const dateStr = new Date().toISOString().slice(0, 10);
      const briefNote = {
        id: 'n' + Math.random().toString(36).slice(2, 9),
        text: `[AI 案件简报 ${dateStr}]\n${brief.slice(0, 1500)}`, // truncate to keep note size reasonable
        createdAt: new Date().toISOString(),
        type: 'note',
      };
      const existingNotes = Array.isArray(selectedCase.notes) ? selectedCase.notes : [];

      const updatedCase = {
        ...selectedCase,
        status:       ex.status?.trim()    || selectedCase.status,
        snapshot:     ex.snapshot?.trim()  || selectedCase.snapshot,
        caseTimeline: mergedTimeline,
        docs:         mergedDocs,
        keyIssues:    ex.keyIssues?.length  ? ex.keyIssues  : (selectedCase.keyIssues  || []),
        nextSteps:    ex.nextSteps?.length  ? ex.nextSteps  : (selectedCase.nextSteps  || []),
        notes:        [briefNote, ...existingNotes],
      };

      await onSaveCase(updatedCase);
      setApplyMsg('✅ 已应用到案件档案');
      setTimeout(() => setApplyMsg(''), 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setApplyBusy(false);
    }
  };

  const driveStatusLine = () => {
    if (!driveStatus) return null;
    if (driveStatus.found) {
      return `📁 ${driveStatus.folderName} — 已读取 ${driveStatus.readCount}/${driveStatus.fileCount} 个文件`;
    }
    return `📁 ${driveStatus.message}`;
  };

  return (
    <div style={{ marginTop: 16, border: `1.5px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: '#f1f5f9', border: 'none', padding: '10px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151',
        }}
      >
        <span>🤖 AI 案件简报</span>
        <span style={{ fontSize: 11, color: C.muted }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={generate} disabled={loading || applyBusy || !selectedCase}
              style={btnStyle(C.blue, loading || !selectedCase)}>
              {loading ? `⏳ ${step}` : '✨ 生成案件简报'}
            </button>
            {brief && (
              <button onClick={handleApply} disabled={applyBusy}
                style={btnStyle(C.green, applyBusy)}>
                {applyBusy ? '⏳...' : '⬆️ 应用到案件'}
              </button>
            )}
          </div>

          {driveStatus && (
            <div style={{ fontSize: 11, color: driveStatus.found ? C.mid : C.orange }}>
              {driveStatusLine()}
            </div>
          )}

          {brief && (
            <textarea
              readOnly
              value={brief}
              style={{
                width: '100%', minHeight: 280, fontSize: 12, fontFamily: 'monospace',
                borderRadius: 8, border: `1.5px solid ${C.border}`, padding: '10px 12px',
                resize: 'vertical', boxSizing: 'border-box', background: '#fff',
              }}
            />
          )}

          {applyMsg && (
            <div style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>{applyMsg}</div>
          )}
          {error && (
            <div style={{
              background: '#FEF0EF', border: `1px solid ${C.red}`, color: C.red,
              borderRadius: 6, padding: '8px 10px', fontSize: 12,
            }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
