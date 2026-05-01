// src/CaseAI.jsx — Phase 2: Manus API + per-case Project + Research Chat
import React, { useState, useCallback, useRef, useEffect } from 'react';
import BriefRenderer from './BriefRenderer';
import { readSession, sessionIsValid, getValidToken } from './utils/gmailSession';

const C = {
  blue: '#4f46e5', green: '#059669', red: '#dc2626',
  orange: '#d97706', mid: '#64748b', muted: '#94a3b8',
  border: '#e2e8f0', purple: '#7c3aed', teal: '#0d9488',
};

const btnStyle = (color, disabled) => ({
  padding: '9px 16px', fontSize: 13, fontWeight: 600,
  background: disabled ? '#e5e7eb' : color,
  color: disabled ? '#9ca3af' : '#fff',
  border: 'none', borderRadius: 8, cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.7 : 1, transition: 'opacity 0.15s',
});

/* ── JSON repair ──────────────────────────────────────────────────────────── */
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

/* ── Manus API call (non-streaming, returns Anthropic-compatible shape) ───── */
async function callManus(body, projectId = null) {
  const safeBody = {
    ...body,
    _stream: false,
    ...(projectId ? { project_id: projectId } : {}),
  };
  let r;
  try {
    r = await fetch('/api/manus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safeBody),
    });
  } catch (networkErr) {
    // Fallback to direct Claude if Manus unreachable
    const fallbackBody = { ...body, _stream: false };
    r = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fallbackBody),
    });
  }
  const rawText = await r.text();
  let data;
  try { data = JSON.parse(rawText); }
  catch {
    throw new Error(r.status === 413
      ? 'PDF 文件太大，请减小文件大小后重试（请求体限制 8MB）'
      : `服务器返回非 JSON 响应 (${r.status}): ${rawText.slice(0, 120)}`);
  }
  if (!r.ok) throw new Error(
    typeof data.error === 'object'
      ? (data.error?.message || JSON.stringify(data.error))
      : data.error || '请求失败'
  );
  return data;
}

/* ── Manus streaming call for Research Chat ──────────────────────────────── */
async function callManusStream(body, projectId, onChunk) {
  const safeBody = {
    ...body,
    _stream: true,
    ...(projectId ? { project_id: projectId } : {}),
  };
  const r = await fetch('/api/manus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(safeBody),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Manus error ${r.status}: ${errText.slice(0, 120)}`);
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const evt = JSON.parse(line.slice(6));
        if (evt.type === 'delta' && evt.text) {
          fullText += evt.text;
          onChunk(fullText);
        } else if (evt.type === 'done') {
          fullText = evt.text || fullText;
          onChunk(fullText);
        } else if (evt.type === 'error') {
          throw new Error(evt.message || 'Manus stream error');
        }
      } catch { /* skip malformed SSE line */ }
    }
  }
  return fullText;
}

/* ── Create or retrieve Manus Project for this case ─────────────────────── */
async function ensureManusProject(caseObj, client, onSaveCase) {
  // Already has a project — return it
  if (caseObj.manusProjectId) return caseObj.manusProjectId;

  try {
    const r = await fetch('/api/manus-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        caseId: caseObj.id,
        caseName: caseObj.type || 'Visa Case',
        clientName: client?.name || 'Client',
        visaSubclass: caseObj.type || '',
        agentName: caseObj.assignedTo || 'Ozsky Team',
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (data.project_id) {
      // Persist project_id to case record
      const updatedCase = { ...caseObj, manusProjectId: data.project_id, manusProjectUrl: data.project_url };
      await onSaveCase(updatedCase);
      return data.project_id;
    }
  } catch { /* non-blocking — proceed without project */ }
  return null;
}

/* ── Deep case brief prompt ──────────────────────────────────────────────── */
function buildCaseBriefPrompt(client, caseObj, emailContext, driveContext) {
  const c = caseObj || {};
  const today = new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });
  const visaSubclass = c.type || 'Unknown Visa Subclass';

  const crmData = [
    client?.name        && `Client Name: ${client.name}`,
    client?.email       && `Email: ${client.email}`,
    client?.phone       && `Phone: ${client.phone}`,
    client?.profile?.dob && `DOB: ${client.profile.dob}`,
    client?.profile?.nationality && `Nationality: ${client.profile.nationality}`,
    client?.profile?.occupation && `Occupation: ${client.profile.occupation}`,
    c.type              && `Case Type: ${c.type}`,
    c.status            && `Current Status: ${c.status}`,
    c.priority          && `Priority: ${c.priority}`,
    c.dueDate           && `Due Date: ${c.dueDate}`,
    c.assignedTo        && `Assigned Agent: ${c.assignedTo}`,
    c.snapshot          && `Case Summary: ${c.snapshot}`,
    c.caseTimeline?.length && `Timeline:\n${c.caseTimeline.map(t =>
      `  [${t.date || ''}] ${t.event || ''} — ${t.status || ''}`).join('\n')}`,
    c.keyIssues?.length && `Key Issues:\n${c.keyIssues.map(i =>
      `  [${i.priority || ''}] ${i.item || ''}`).join('\n')}`,
    c.nextSteps?.length && `Next Steps:\n${c.nextSteps.map((s, i) =>
      `  ${i + 1}. ${s}`).join('\n')}`,
    c.docs && Object.keys(c.docs).length && `Document Checklist:\n${Object.entries(c.docs).map(([k, v]) =>
      `  [${v ? '✓' : ' '}] ${k}`).join('\n')}`,
  ].filter(Boolean).join('\n');

  return `You are an expert Australian migration AI assistant for Ozsky International, Perth WA.

Your task: Generate a comprehensive, accurate case progress brief for internal use by migration agents.

VISA CONTEXT: ${visaSubclass}
- Apply relevant DHA policy, Migration Act 1958, and PAM3 guidelines for this visa subclass
- Reference specific criteria (e.g., Schedule 2 criteria, TSS stream requirements, skills assessment bodies)
- Flag any compliance risks, character/health issues, or procedural deadlines proactively
- 请以中文为主要语言输出，英文作为辅助标注（括号内）
- Use Australian English spelling for any English content

${driveContext ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIMARY DATA SOURCE — Google Drive Client Folder
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${driveContext}

` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRM CASE DATA (supplementary)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${crmData || '(No CRM data available)'}

${emailContext ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RELATED EMAIL CORRESPONDENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${emailContext}` : ''}

OUTPUT FORMAT — produce a bilingual (English/Chinese) case brief using EXACTLY this structure:

================================================================================
  CASE PROGRESS BRIEF  |  案件进度简报
  ${client?.name || '[Client Name]'} — ${visaSubclass}
  Generated: ${today} | Agent: ${caseObj?.assignedTo || 'Ozsky Migration'} | CONFIDENTIAL
================================================================================

━━━ 1. CASE OVERVIEW  案件概况 ━━━
Visa subclass, current status, priority, key dates, assigned agent.
Include relevant visa stream/pathway (e.g., ENS Direct Entry, TSS Short-term).

━━━ 2. DOCUMENT STATUS  文件进度 ━━━
List ALL documents with status. Format: [✓] Received / [✗] Missing / [?] Unverified
Group by category: Identity / Qualification / Employment / Health & Character / Sponsor
Cross-reference Drive files with CRM checklist.

━━━ 3. CURRENT PROGRESS  当前进展 ━━━
Completed milestones, in-progress items, blocked items.
Reference specific DHA processing stages where applicable.

━━━ 4. KEY ISSUES & RISKS  关键问题与风险 ━━━
🔴 HIGH — Blocking issues requiring immediate action
🟡 MEDIUM — Issues to monitor or address soon
🟢 LOW — Minor items or improvements
Include relevant visa criteria references (e.g., cl.186.223, s.65 Migration Act).

━━━ 5. NEXT STEPS  下步行动 ━━━
Numbered action items with owner (Agent/Client/Sponsor) and suggested timeframe.
Prioritise by urgency.

━━━ 6. TIMELINE  时间线 ━━━
YYYY-MM-DD | Event — Status (Completed / In Progress / Pending / Urgent)
Include all key milestones from Drive files and CRM data.

━━━ 7. COMPLIANCE NOTES  合规备注 ━━━
Any legislative, policy, or procedural compliance items to flag.
Mention relevant ANZSCO codes, skills assessment bodies, or state nomination requirements if applicable.

================================================================================
  AI-assisted brief for internal use only. Not legal advice. Ozsky International.
  本简报由 AI 辅助整理，仅供内部参考，不构成法律意见。
================================================================================

IMPORTANT: If information is unavailable, write "Information pending" — do NOT fabricate details.
Keep each section concise (3-6 lines). Total length: 800-1200 words.`;
}

/* ── Main component ─────────────────────────────────────────────────────── */
export default function CaseAI({ selectedClient, selectedCase, onSaveCase }) {
  const [open, setOpen]               = useState(false);
  const [loading, setLoading]         = useState(false);
  const [step, setStep]               = useState('');
  const [brief, setBrief]             = useState('');
  const [error, setError]             = useState('');
  const [driveStatus, setDriveStatus] = useState(null);
  const [applyBusy, setApplyBusy]     = useState(false);
  const [applyMsg, setApplyMsg]       = useState('');
  const [previousCase, setPreviousCase] = useState(null);
  const [folderCandidates, setFolderCandidates] = useState(null);
  const [projectId, setProjectId]     = useState(selectedCase?.manusProjectId || null);
  const [projectUrl, setProjectUrl]   = useState(selectedCase?.manusProjectUrl || null);

  // Research Chat state
  const [chatOpen, setChatOpen]       = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput]     = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Sync projectId when selectedCase changes
  useEffect(() => {
    setProjectId(selectedCase?.manusProjectId || null);
    setProjectUrl(selectedCase?.manusProjectUrl || null);
    // Restore previously generated brief from case data
    if (selectedCase?.aiBrief) {
      setBrief(selectedCase.aiBrief);
    } else {
      setBrief('');
    }
  }, [selectedCase?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll chat
  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatOpen]);

  /* ── Drive fetch ─────────────────────────────────────────────────────── */
  const fetchDriveContext = useCallback(async (token, confirmedFolderId = null, confirmedFolderName = null) => {
    const r = await fetch('/api/drive-sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: token,
        clientName: selectedClient.name,
        ...(confirmedFolderId ? { confirmedFolderId, confirmedFolderName } : {}),
      }),
    });
    if (!r.ok) throw new Error(`Drive sync failed: ${r.status}`);
    return r.json();
  }, [selectedClient]);

  /* ── Generate brief ──────────────────────────────────────────────────── */
  const generate = useCallback(async (confirmedFolderId = null, confirmedFolderName = null) => {
    if (!selectedCase) return;
    setLoading(true); setError(''); setBrief(''); setDriveStatus(null); setFolderCandidates(null);

    const gmail = readSession();
    let driveContext = '';

    // Step 1: Ensure Manus Project exists for this case
    setStep('🚀 初始化案件 Project...');
    let pid = projectId;
    if (!pid) {
      pid = await ensureManusProject(selectedCase, selectedClient, onSaveCase);
      if (pid) { setProjectId(pid); }
    }

    // Step 2: Drive
    if (selectedClient && sessionIsValid(gmail)) {
      setStep('📁 读取 Drive 文件夹...');
      try {
        const token = await getValidToken();
        if (token) {
          const driveData = await fetchDriveContext(token, confirmedFolderId, confirmedFolderName);
          if (driveData.needsConfirmation) {
            setFolderCandidates(driveData.candidates);
            setDriveStatus({ found: false, message: driveData.message });
            setLoading(false); setStep('');
            return;
          }
          if (driveData.folderFound && driveData.processed?.length) {
            const textParts = [], binaryNames = [];
            const CHARS_PER_FILE = 2000, TOTAL_DRIVE_CHARS = 6000;
            let driveCharsUsed = 0;
            for (const f of driveData.processed) {
              if (f.textContent) {
                const snippet = f.textContent.slice(0, CHARS_PER_FILE);
                if (driveCharsUsed + snippet.length <= TOTAL_DRIVE_CHARS) {
                  textParts.push(`[File: ${f.name}]\n${snippet}`);
                  driveCharsUsed += snippet.length;
                } else { binaryNames.push(`  [✓] ${f.name} (content over budget)`); }
              } else { binaryNames.push(`  [✓] ${f.name}`); }
            }
            const parts = [...textParts];
            if (binaryNames.length) parts.push(`Archived files (filename only):\n${binaryNames.join('\n')}`);
            if (parts.length) {
              driveContext = `Google Drive Folder: ${driveData.folderName} (${driveData.totalFiles} files)\n\n` + parts.join('\n\n---\n\n');
            }
            setDriveStatus({ found: true, folderName: driveData.folderName, fileCount: driveData.totalFiles, readCount: textParts.length });
          } else {
            setDriveStatus({ found: false, message: driveData.message || 'Client folder not found' });
          }
        }
      } catch (driveErr) {
        setDriveStatus({ found: false, message: `Drive error: ${driveErr.message}` });
      }
    }

    // Step 3: Gmail
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
                  `[Email ${i + 1}] ${e.date ? new Date(e.date).toLocaleDateString('en-AU') : ''} | ${e.subject}`,
                  ai.rawSummary && `Summary: ${ai.rawSummary}`,
                  ai.keyNeeds   && `Key needs: ${ai.keyNeeds}`,
                ].filter(Boolean).join('\n');
              }).join('\n\n');
            }
          }
        }
      } catch { /* non-blocking */ }
    }

    // Step 4: Generate brief via Manus
    setStep('🤖 生成案件简报 (Manus AI)...');
    try {
      const prompt = buildCaseBriefPrompt(selectedClient, selectedCase, emailContext, driveContext);
      const data = await callManus({
        model: 'claude-haiku-4-5-20251001', max_tokens: 2000,
        _title: `Case Brief — ${selectedClient?.name || 'Client'} ${selectedCase?.type || ''}`,
        messages: [{ role: 'user', content: prompt }],
      }, pid);
      const briefText = data.content?.[0]?.text || '';
      setBrief(briefText);
      await applyBriefText(briefText, pid);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false); setStep('');
    }
  }, [selectedClient, selectedCase, fetchDriveContext, projectId, onSaveCase]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Revert ──────────────────────────────────────────────────────────── */
  const handleRevert = async () => {
    if (!previousCase) return;
    try {
      await onSaveCase(previousCase);
      setPreviousCase(null);
      setApplyMsg('⏮ 已还原到上一版本');
      setTimeout(() => setApplyMsg(''), 3000);
    } catch (e) { setError(e.message); }
  };

  /* ── Apply brief to case ─────────────────────────────────────────────── */
  const applyBriefText = async (briefText, pid = projectId) => {
    if (!briefText) return;
    setApplyBusy(true); setApplyMsg(''); setError('');
    try {
      setPreviousCase({ ...selectedCase });
      const data = await callManus({
        model: 'claude-haiku-4-5-20251001', max_tokens: 1200,
        _title: `Extract JSON — ${selectedClient?.name || 'Client'}`,
        messages: [{
          role: 'user',
          content: `Extract information from the case brief below and return ONLY a single valid JSON object.

STRICT RULES:
- Output ONLY the JSON object, nothing else — no markdown fences, no comments, no explanation
- Use double quotes for all keys and string values
- No trailing commas, no JavaScript comments (// or /* */)
- All brackets must be properly closed
- If a field is not found, use empty string "" or empty array []

JSON schema:
{
  "status": "",
  "snapshot": "",
  "caseTimeline": [{ "date": "YYYY-MM-DD", "event": "", "status": "Completed" }],
  "docs": { "Document Name": true },
  "keyIssues": [{ "item": "", "priority": "High" }],
  "nextSteps": [""]
}

Field rules:
1. status: English only — "In Progress" / "Awaiting Decision" / "Completed" / "On Hold"
2. snapshot: one sentence summary in Chinese, max 50 characters
3. caseTimeline: status must be Completed/In Progress/Pending/Urgent; max 10 most recent entries; dates in YYYY-MM-DD
4. docs: true = received, false = pending
5. keyIssues: priority must be High/Medium/Low; max 5 items
6. nextSteps: one string per step; max 5 items

Case brief:
${briefText.slice(0, 6000)}`,
        }],
      }, pid);

      const text = data.content?.[0]?.text || '';
      const jsonStr = (() => {
        const mdMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (mdMatch) return mdMatch[1];
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
        return start !== -1 ? text.slice(start) : null;
      })();
      if (!jsonStr) throw new Error(`无法从 AI 响应中提取 JSON。原始响应：${text.slice(0, 200)}`);

      const cleanedJson = jsonStr
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/,\s*([}\]])/g, '$1');
      const ex = repairAndParseJSON(cleanedJson);

      // Merge timeline
      const existingTimeline = selectedCase.caseTimeline || [];
      const existingKeys = new Set(existingTimeline.map(t =>
        `${(t.date || '').trim().toLowerCase()}|${(t.event || '').trim().toLowerCase()}`
      ));
      const newEntries = (ex.caseTimeline || []).filter(t => {
        if (!t.date && !t.event) return false;
        return !existingKeys.has(`${(t.date || '').trim().toLowerCase()}|${(t.event || '').trim().toLowerCase()}`);
      });

      // Merge docs
      const existingDocs = selectedCase.docs || {};
      const mergedDocs = { ...existingDocs };
      for (const [k, v] of Object.entries(ex.docs || {})) {
        if (!(k in mergedDocs)) mergedDocs[k] = v;
        else if (v === true) mergedDocs[k] = true;
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const briefNote = {
        id: 'n' + Math.random().toString(36).slice(2, 9),
        text: [
          `🤖 AI Case Brief — ${selectedCase.type || 'Case'} [Manus AI]`,
          ex.snapshot   ? `Summary: ${ex.snapshot}` : '',
          ex.status     ? `Status: ${ex.status}` : '',
          ex.nextSteps?.length ? `Next Steps: ${ex.nextSteps.join('; ')}` : '',
          ex.keyIssues?.length ? `Key Issues: ${ex.keyIssues.map(i => `[${i.priority}] ${i.item}`).join('; ')}` : '',
          `Generated: ${dateStr}`,
        ].filter(Boolean).join('\n'),
        createdAt: new Date().toISOString(),
        type: 'ai-brief',
      };

      const updatedCase = {
        ...selectedCase,
        status:       ex.status?.trim()    || selectedCase.status,
        snapshot:     ex.snapshot?.trim()  || selectedCase.snapshot,
        aiBrief:      briefText,
        aiBriefDate:  dateStr,
        caseTimeline: [...existingTimeline, ...newEntries],
        docs:         mergedDocs,
        keyIssues:    ex.keyIssues?.length  ? ex.keyIssues  : (selectedCase.keyIssues  || []),
        nextSteps:    ex.nextSteps?.length  ? ex.nextSteps  : (selectedCase.nextSteps  || []),
        notes:        [briefNote, ...(Array.isArray(selectedCase.notes) ? selectedCase.notes : [])],
        ...(pid && !selectedCase.manusProjectId ? { manusProjectId: pid } : {}),
      };

      await onSaveCase(updatedCase);
      setApplyMsg('✅ 已应用到案件档案 (Manus AI)');
      setTimeout(() => setApplyMsg(''), 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setApplyBusy(false);
    }
  };

  /* ── Research Chat send ──────────────────────────────────────────────── */
  const handleChatSend = async () => {
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    setChatInput('');
    setChatLoading(true);

    const userMsg = { role: 'user', content: q };
    setChatMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', loading: true }]);

    // Build context-aware system prompt
    const caseContext = `Case: ${selectedCase?.type || 'Visa'} | Client: ${selectedClient?.name || 'Client'} | Status: ${selectedCase?.status || 'Unknown'}`;

    try {
      // Ensure project exists
      let pid = projectId;
      if (!pid) {
        pid = await ensureManusProject(selectedCase, selectedClient, onSaveCase);
        if (pid) setProjectId(pid);
      }

      const messages = [
        {
          role: 'user',
          content: `You are an expert Australian migration assistant for Ozsky International, Perth WA.
Current case context: ${caseContext}
Answer the following question with specific reference to Australian migration law, DHA policy, and relevant visa criteria.
Use Australian English. Be concise but thorough. Flag any compliance risks clearly.

Question: ${q}`,
        },
      ];

      let fullResponse = '';
      await callManusStream(
        { model: 'claude-haiku-4-5-20251001', max_tokens: 1000, messages, _title: `Research: ${q.slice(0, 60)}` },
        pid,
        (text) => {
          fullResponse = text;
          setChatMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: text, loading: false };
            return updated;
          });
        }
      );

      if (!fullResponse) throw new Error('No response from Manus');
    } catch (e) {
      setChatMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: `❌ Error: ${e.message}`, loading: false, error: true };
        return updated;
      });
    } finally {
      setChatLoading(false);
    }
  };

  /* ── Drive status line ───────────────────────────────────────────────── */
  const driveStatusLine = () => {
    if (!driveStatus) return null;
    if (driveStatus.found) return `📁 ${driveStatus.folderName} — 已读取 ${driveStatus.readCount}/${driveStatus.fileCount} 个文件`;
    return `📁 ${driveStatus.message}`;
  };

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{ marginTop: 16, border: `1.5px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: '#F8FAFC', border: 'none', borderBottom: '1px solid #E2E8F0',
          padding: '11px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#1A2035', fontFamily: 'inherit',
        }}
      >
        <span>🤖 AI 案件简报</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {projectId && (
            <span style={{ fontSize: 10, background: '#EDE9FE', color: C.purple, padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>
              Manus Project ✓
            </span>
          )}
          <span style={{ fontSize: 11, color: C.muted }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => generate()} disabled={loading || applyBusy || !selectedCase}
              style={btnStyle(C.blue, loading || applyBusy || !selectedCase)}>
              {loading ? `⏳ ${step}` : applyBusy ? '⏳ 应用中...' : '✨ 生成并应用简报'}
            </button>
            {previousCase && (
              <button onClick={handleRevert} disabled={loading || applyBusy}
                style={btnStyle('#6b7280', loading || applyBusy)}>
                ↩️ 恢复上一版本
              </button>
            )}
            <button
              onClick={() => setChatOpen(o => !o)}
              style={{ ...btnStyle(C.purple, false), marginLeft: 'auto' }}
              title="向 Manus AI 提问签证法律问题"
            >
              💬 {chatOpen ? '关闭研究助手' : '研究助手'}
            </button>
            {projectUrl && (
              <a href={projectUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: C.purple, textDecoration: 'none', fontWeight: 600 }}>
                🔗 Manus Project ↗
              </a>
            )}
          </div>

          {/* Folder confirmation */}
          {folderCandidates && (
            <div style={{ background: '#FFFBEB', border: '1.5px solid #F59E0B', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
                ⚠️ 找到多个可能匹配的文件夹，请确认使用哪一个：
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {folderCandidates.map(f => (
                  <button key={f.id} onClick={() => { setFolderCandidates(null); generate(f.id, f.name); }}
                    style={{ textAlign: 'left', padding: '7px 12px', background: '#fff', border: '1.5px solid #d97706', borderRadius: 6, fontSize: 13, color: '#1c1917', cursor: 'pointer', fontWeight: 500 }}>
                    📁 {f.name}
                  </button>
                ))}
                <button onClick={() => { setFolderCandidates(null); setDriveStatus(null); }}
                  style={{ textAlign: 'left', padding: '6px 12px', background: 'none', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>
                  跳过 Drive，仅使用 CRM 数据生成
                </button>
              </div>
            </div>
          )}

          {/* Drive status */}
          {driveStatus && (
            <div style={{ fontSize: 11, color: driveStatus.found ? C.mid : C.orange }}>
              {driveStatusLine()}
            </div>
          )}

          {/* Brief output */}
          {brief && (
            <div style={{ position: 'relative' }}>
              {selectedCase?.aiBriefDate && !loading && (
                <div style={{ fontSize: 11, color: '#6366f1', marginBottom: 4, fontWeight: 600 }}>
                  📋 上次生成：{selectedCase.aiBriefDate}
                </div>
              )}
              <BriefRenderer
                text={brief}
                onCopy={() => {
                  navigator.clipboard.writeText(brief).then(() => {
                    setApplyMsg('📋 已复制到剪贴板');
                    setTimeout(() => setApplyMsg(''), 3000);
                  });
                }}
              />
            </div>
          )}

          {/* Apply message */}
          {applyMsg && <div style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>{applyMsg}</div>}

          {/* Error */}
          {error && (
            <div style={{ background: '#FEF0EF', border: `1px solid ${C.red}`, color: C.red, borderRadius: 6, padding: '8px 10px', fontSize: 12 }}>
              {error}
            </div>
          )}

          {/* ── Research Chat ─────────────────────────────────────────────── */}
          {chatOpen && (
            <div style={{ border: `1.5px solid #DDD6FE`, borderRadius: 10, overflow: 'hidden', marginTop: 4 }}>
              {/* Chat header */}
              <div style={{ background: '#F5F3FF', padding: '10px 14px', borderBottom: '1px solid #DDD6FE', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.purple }}>💬 Manus 研究助手</span>
                <span style={{ fontSize: 11, color: '#7c3aed', background: '#EDE9FE', padding: '2px 7px', borderRadius: 10 }}>
                  ozsky-migration-agent
                </span>
                <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>
                  {selectedCase?.type || 'Visa'} | {selectedClient?.name || 'Client'}
                </span>
              </div>

              {/* Messages */}
              <div style={{ maxHeight: 320, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: '#FAFAFA' }}>
                {chatMessages.length === 0 && (
                  <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '20px 0' }}>
                    向 Manus AI 提问签证法律、政策或案件相关问题
                    <br />
                    <span style={{ fontSize: 11 }}>例：What are the key criteria for SC-186 Direct Entry stream?</span>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    background: msg.role === 'user' ? C.purple : (msg.error ? '#FEF0EF' : '#fff'),
                    color: msg.role === 'user' ? '#fff' : (msg.error ? C.red : '#1e293b'),
                    borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    padding: '8px 12px', fontSize: 12, lineHeight: 1.6,
                    border: msg.role === 'assistant' ? `1px solid ${msg.error ? '#fca5a5' : '#e2e8f0'}` : 'none',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {msg.loading ? (
                      <span style={{ color: C.muted }}>⏳ Manus AI 思考中...</span>
                    ) : msg.content}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '10px 12px', borderTop: '1px solid #DDD6FE', display: 'flex', gap: 8, background: '#fff' }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
                  placeholder="Ask about visa criteria, policy, documents..."
                  disabled={chatLoading}
                  style={{
                    flex: 1, padding: '8px 12px', fontSize: 12, borderRadius: 8,
                    border: `1.5px solid ${chatLoading ? '#e2e8f0' : '#DDD6FE'}`,
                    outline: 'none', fontFamily: 'inherit', background: chatLoading ? '#f8fafc' : '#fff',
                  }}
                />
                <button onClick={handleChatSend} disabled={chatLoading || !chatInput.trim()}
                  style={btnStyle(C.purple, chatLoading || !chatInput.trim())}>
                  {chatLoading ? '⏳' : '发送'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
