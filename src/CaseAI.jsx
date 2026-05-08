// src/CaseAI.jsx — Phase 2: Manus API + per-case Project + Research Chat + Human Override Layer (B+C)
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
    if (r.status === 413) throw new Error('PDF 文件太大，请减小文件大小后重试（请求体限制 8MB）');
    if (r.status === 504 || rawText.includes('FUNCTION_INVOCATION_TIMEOUT')) throw new Error('AI 服务响应超时（504）。文件较多时处理时间较长，请稍后重试，或减少文件数量后再试。');
    throw new Error(`服务器返回非 JSON 响应 (${r.status}): ${rawText.slice(0, 120)}`);
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
      const updatedCase = { ...caseObj, manusProjectId: data.project_id, manusProjectUrl: data.project_url };
      await onSaveCase(updatedCase);
      return data.project_id;
    }
  } catch { /* non-blocking */ }
  return null;
}

/* ── Deep case brief prompt ──────────────────────────────────────────────── */
const DOC_CHECKLISTS_AI = {
  'Subclass 500 – Student Visa':               ['Offer Letter / CoE', 'Passport', 'English Test Results', 'Financial Evidence', 'Overseas Student Health Cover (OSHC)', 'Genuine Temporary Entrant (GTE) Statement'],
  'Subclass 500 – Student (School)':           ['Offer Letter / CoE', 'Passport', 'Financial Evidence', 'OSHC', 'GTE Statement', 'Parent/Guardian Consent (if under 18)'],
  'Subclass 590 – Student Guardian':           ['Passport', 'Student Visa Grant (child)', 'Financial Evidence', 'OSHC', 'Relationship Evidence'],
  'Subclass 190 – Skilled (Nominated)':        ['Skills Assessment', 'State/Territory Nomination', 'English Test Results', 'EOI via SkillSelect', 'Passport', 'Health & Character Checks'],
  'Subclass 491 – Skilled Regional (State)':   ['Skills Assessment', 'State/Territory Nomination', 'English Test Results', 'EOI via SkillSelect', 'Passport', 'Health & Character Checks', 'Employment References'],
  'Subclass 491 – Skilled Regional (Family)':  ['Skills Assessment', 'Eligible Relative Sponsorship', 'English Test Results', 'EOI via SkillSelect', 'Passport', 'Health & Character Checks'],
  'Subclass 494 – Employer Sponsored Regional':['Employer Sponsorship Approval', 'Skills Assessment', 'Passport', 'Labour Market Testing Evidence', 'English Evidence', 'Health & Character Checks'],
  'Subclass 887 – Skilled (Residence)':        ['491/494 Grant Letter', 'Passport', 'Evidence of Regional Living/Working (2 yrs)', 'Health & Character Checks'],
  'Subclass 482 – TSS (Short-term)':           ['Approved Sponsorship', 'Job Offer / Contract', 'Passport', 'Skills Assessment (if required)', 'English Evidence', 'Health & Character Checks'],
  'Subclass 482 – TSS (Medium-term)':          ['Approved Sponsorship', 'Job Offer / Contract', 'Passport', 'Skills Assessment', 'English Evidence', 'Health & Character Checks', 'Labour Market Testing'],
  'Subclass 186 – ENS (Direct Entry)':         ['Employer Nomination Approval', 'Skills Assessment', 'Passport', 'English Evidence', 'Health & Character Checks', 'Employment References (3 yrs)'],
  'Subclass 186 – ENS (TRT)':                  ['Employer Nomination Approval', 'Passport', 'Evidence of 2 Years Employment with Sponsor', 'English Evidence', 'Health & Character Checks'],
  'Subclass 407 – Training Visa':              ['Training Plan', 'Sponsor Approval', 'Passport', 'English Evidence', 'Health & Character Checks'],
  'Subclass 820/801 – Partner (Onshore)':      ['Relationship Evidence (photos/comms/finance)', 'Joint Bank Statements', 'Statutory Declarations (x2)', 'Both Passports', 'Health Examination', 'Police Clearance'],
  'Subclass 309/100 – Partner (Offshore)':     ['Relationship Evidence', 'Joint Financial Evidence', 'Statutory Declarations', 'Both Passports', 'Health Examination', 'Police Clearance'],
  'Subclass 300 – Prospective Marriage':       ['Proof of Genuine Relationship', 'Passports', 'Evidence of Meeting in Person', 'Health & Character Checks'],
  'Subclass 600 – Visitor':                    ['Passport', 'Travel Itinerary', 'Financial Evidence', 'Ties to Home Country Evidence', 'Travel Insurance (recommended)'],
  'Subclass 408 – Temp Activity':              ['Passport', 'Sponsor Approval or Event Invitation', 'Activity Evidence', 'Health & Character Checks'],
  'Bridging Visa A':                           ['Current Visa Copy', 'Substantive Visa Application Receipt', 'Passport'],
  'Bridging Visa B':                           ['Current BVA Grant Letter', 'Passport', 'Evidence of Compelling Reason to Travel'],
  'Bridging Visa C':                           ['Current Application Reference', 'Passport'],
  'Enrollment Support':                        ['Offer Letter', 'Academic Transcripts', 'English Test Results', 'Passport Copy'],
  'Scholarship Application':                   ['Academic Transcripts', 'English Test Results', 'Research Proposal / Personal Statement', 'Referee Letters (2-3)', 'Passport', 'CV/Resume'],
  'Other':                                     ['Passport', 'Supporting Documents'],
};

function buildCaseBriefPrompt(client, caseObj, emailContext, driveContext) {
  const c = caseObj || {};
  const p = client?.profile || {};
  const today = new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });
  const visaSubclass = c.type || 'Unknown Visa Subclass';
  const na = '待确认 (unconfirmed)';

  const standardDocs = DOC_CHECKLISTS_AI[c.type] || [];
  const receivedDocs = c.docs || {};
  const allDocKeys = [...new Set([...standardDocs, ...Object.keys(receivedDocs)])];
  const docChecklistText = allDocKeys.length
    ? `Document Checklist (${allDocKeys.filter(k => receivedDocs[k]).length}/${allDocKeys.length} received):\n` +
      allDocKeys.map(k => `  [${receivedDocs[k] ? '✓' : '✗'}] ${k}`).join('\n')
    : '';

  const visaHistoryText = (p.visaHistory || []).length
    ? `Visa History:\n${p.visaHistory.map(v =>
        `  ${v.visaType || ''}${v.applicationNo ? ' (App# ' + v.applicationNo + ')' : ''} | Lodged: ${v.lodged || '—'} | Granted: ${v.granted || '—'} | Expiry: ${v.expiry || '—'} | Status: ${v.status || '—'}`
      ).join('\n')}`
    : '';

  const skillsText = (p.skillsAssessments || []).length
    ? `Skills Assessments:\n${p.skillsAssessments.map(s =>
        `  ${s.body || ''} | ${s.occupation || ''} | Result: ${s.result || '—'} | Expiry: ${s.expiry || '—'}`
      ).join('\n')}`
    : '';

  const crmData = [
    `Client Name (EN): ${client?.name || na}`,
    `Client Name (ZH): ${p.nameZh || p.nameChinese || na}`,
    `Email: ${client?.email || na}`,
    `Phone: ${client?.phone || na}`,
    `Sex: ${p.sex || na}`,
    `Date of Birth: ${p.dob || na}`,
    `Birthplace: ${p.birthplace || na}`,
    `Nationality: ${client?.nationality || na}`,
    `Passport No: ${p.passportNo || na}`,
    `Passport Expiry: ${p.passportExpiry || na}`,
    `China ID: ${p.chinaId || na}`,
    `Marital Status: ${p.maritalStatus || na}`,
    `AU Address: ${p.auAddress || na}`,
    `Consultant: ${p.consultant || c.assignedTo || na}`,
    `Visa Target: ${p.visaTarget || c.type || na}`,
    visaHistoryText,
    skillsText,
    `Case Type: ${c.type || na}`,
    `Current Status: ${c.status || na}`,
    `Priority: ${c.priority || na}`,
    `Due Date: ${c.dueDate || na}`,
    `Assigned Agent: ${c.assignedTo || na}`,
    c.snapshot          && `Case Summary: ${c.snapshot}`,
    c.caseTimeline?.length && `Timeline:\n${c.caseTimeline.map(t =>
      `  [${t.date || ''}] ${t.event || ''} — ${t.status || ''}`).join('\n')}`,
    c.keyIssues?.length && `Key Issues:\n${c.keyIssues.map(i =>
      `  [${i.priority || ''}] ${i.item || ''}`).join('\n')}`,
    c.nextSteps?.length && `Next Steps:\n${c.nextSteps.map((s, i) =>
      `  ${i + 1}. ${s}`).join('\n')}`,
    docChecklistText,
  ].filter(Boolean).join('\n');

  return `You are an expert Australian migration AI for Ozsky International, Perth WA. Generate a concise internal case brief.

VISA: ${visaSubclass}. Output primarily in Chinese with English in brackets. Use Australian English.

DATA RULES:
1. Drive files = ground truth. If a document exists, the step is DONE — not "pending".
2. CRM "Case Summary" = OLD snapshot, may be outdated. Trust Drive/email over snapshot.
3. Never fabricate. Missing info = 待确认 (unconfirmed).
4. Skills assessment letters from VETASSESS/ACS/EA/AHPRA/ANMAC/NAATI = COMPLETED assessment.
5. EOI submission email/file present = EOI submitted (report actual points).

${driveContext ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIMARY DATA SOURCE — Google Drive Client Folder (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${driveContext}

` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRM CASE DATA (supplementary — "Case Summary" field is an OLD snapshot, may be outdated)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${crmData || '(No CRM data available)'}

${emailContext ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RELATED EMAIL CORRESPONDENCE (HIGH PRIORITY — check for skills assessment results, EOI submissions, visa updates)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${emailContext}` : ''}

OUTPUT FORMAT — use EXACTLY this structure (concise, 600-900 words total):

================================================================================
  CASE PROGRESS BRIEF  |  案件进度简报
  ${client?.name || '[Client Name]'}${(p.nameZh || p.nameChinese) ? ' (' + (p.nameZh || p.nameChinese) + ')' : ''} — ${visaSubclass}
  Generated: ${today} | Agent: ${caseObj?.assignedTo || 'Ozsky Migration'} | CONFIDENTIAL
================================================================================

━━━ 1. CASE OVERVIEW  案件概况 ━━━
Visa subclass, status, priority, key dates, assigned agent. (3-4 lines)

━━━ 2. DOCUMENT STATUS  文件进度 ━━━
[✓] = CRM shows received | [✗] = missing | [?] = unconfirmed
Group: Identity / Qualification / Employment / Health & Character

━━━ 3. CURRENT PROGRESS  当前进展 ━━━
Completed milestones, in-progress, blocked. (3-4 lines)

━━━ 4. KEY ISSUES & RISKS  关键问题与风险 ━━━
🔴 HIGH | 🟡 MEDIUM | 🟢 LOW (max 4 items)

━━━ 5. NEXT STEPS  下步行动 ━━━
Numbered, with owner (Agent/Client) and timeframe. (max 4 steps)

━━━ 6. TIMELINE  时间线 ━━━
YYYY-MM-DD | Event — Status (max 6 entries)

━━━ 7. COMPLIANCE NOTES  合规备注 ━━━
Key legislative/policy items. (2-3 lines)

================================================================================
  AI-assisted brief for internal use only. Not legal advice. Ozsky International.
================================================================================

RULES: Never fabricate. Chinese name MUST come from CRM 'Client Name (ZH)' only. [✓] only if CRM shows ✓.`;
}

/* ── Human Override helpers ──────────────────────────────────────────────── */
// Get the effective value for a field: humanOverride > AI generated
function getEffectiveValue(caseObj, field) {
  const overrides = caseObj?.humanOverrides || {};
  if (overrides[field] !== undefined) return overrides[field].value;
  return caseObj?.[field];
}

// Build a humanOverride entry
function makeOverride(value, editedBy = 'Agent') {
  return { value, editedAt: new Date().toISOString().slice(0, 10), editedBy };
}

// Detect conflicts between new AI values and existing humanOverrides
function detectConflicts(caseObj, aiExtracted) {
  const overrides = caseObj?.humanOverrides || {};
  const conflicts = [];

  // Check status
  if (overrides.status && aiExtracted.status && aiExtracted.status.trim() !== overrides.status.value) {
    conflicts.push({
      field: 'status',
      label: '案件状态',
      humanValue: overrides.status.value,
      aiValue: aiExtracted.status.trim(),
      editedAt: overrides.status.editedAt,
    });
  }

  // Check snapshot
  if (overrides.snapshot && aiExtracted.snapshot && aiExtracted.snapshot.trim() !== overrides.snapshot.value) {
    conflicts.push({
      field: 'snapshot',
      label: '案件概况',
      humanValue: overrides.snapshot.value,
      aiValue: aiExtracted.snapshot.trim(),
      editedAt: overrides.snapshot.editedAt,
    });
  }

  // Check keyIssues (compare serialised)
  if (overrides.keyIssues && aiExtracted.keyIssues?.length) {
    const humanSer = JSON.stringify(overrides.keyIssues.value);
    const aiSer = JSON.stringify(aiExtracted.keyIssues);
    if (humanSer !== aiSer) {
      conflicts.push({
        field: 'keyIssues',
        label: '关键问题',
        humanValue: (overrides.keyIssues.value || []).map(i => `[${i.priority}] ${i.item}`).join('\n'),
        aiValue: aiExtracted.keyIssues.map(i => `[${i.priority}] ${i.item}`).join('\n'),
        editedAt: overrides.keyIssues.editedAt,
      });
    }
  }

  // Check nextSteps
  if (overrides.nextSteps && aiExtracted.nextSteps?.length) {
    const humanSer = JSON.stringify(overrides.nextSteps.value);
    const aiSer = JSON.stringify(aiExtracted.nextSteps);
    if (humanSer !== aiSer) {
      conflicts.push({
        field: 'nextSteps',
        label: '下步行动',
        humanValue: (overrides.nextSteps.value || []).map((s, i) => `${i + 1}. ${s}`).join('\n'),
        aiValue: aiExtracted.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
        editedAt: overrides.nextSteps.editedAt,
      });
    }
  }

  // Check docs — only flag if AI wants to mark something as false that human marked true
  if (overrides.docs) {
    const humanDocs = overrides.docs.value || {};
    const aiDocs = aiExtracted.docs || {};
    const docConflicts = [];
    for (const [k, humanVal] of Object.entries(humanDocs)) {
      if (humanVal === true && aiDocs[k] === false) {
        docConflicts.push(k);
      }
    }
    if (docConflicts.length) {
      conflicts.push({
        field: 'docs',
        label: '文件清单',
        humanValue: docConflicts.map(k => `✓ ${k} (人工确认已收)`).join('\n'),
        aiValue: docConflicts.map(k => `✗ ${k} (AI 认为缺失)`).join('\n'),
        editedAt: overrides.docs.editedAt,
        docConflicts,
      });
    }
  }

  return conflicts;
}

/* ── Conflict Resolution Modal ───────────────────────────────────────────── */
function ConflictModal({ conflicts, onResolve, onCancel }) {
  const [decisions, setDecisions] = useState(() => {
    const d = {};
    conflicts.forEach(c => { d[c.field] = 'human'; }); // default: keep human
    return d;
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560,
        maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', padding: '14px 18px', borderRadius: '14px 14px 0 0' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>⚠️ 发现冲突 — 请选择保留哪个版本</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 3 }}>
            AI 新生成的内容与你之前手工修改的内容不一致，请逐项确认
          </div>
        </div>

        {/* Conflicts */}
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {conflicts.map(conflict => (
            <div key={conflict.field} style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: '#f8fafc', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#374151' }}>
                📌 {conflict.label}
                <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400, marginLeft: 8 }}>手工修改于 {conflict.editedAt}</span>
              </div>
              <div style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {/* Human option */}
                <label style={{
                  border: `2px solid ${decisions[conflict.field] === 'human' ? '#059669' : '#e2e8f0'}`,
                  borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
                  background: decisions[conflict.field] === 'human' ? '#f0fdf4' : '#fff',
                  transition: 'all 0.15s',
                }}>
                  <input type="radio" name={conflict.field} value="human"
                    checked={decisions[conflict.field] === 'human'}
                    onChange={() => setDecisions(d => ({ ...d, [conflict.field]: 'human' }))}
                    style={{ display: 'none' }}
                  />
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', marginBottom: 4 }}>🔒 保留手工版本</div>
                  <div style={{ fontSize: 11, color: '#111827', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{conflict.humanValue}</div>
                </label>
                {/* AI option */}
                <label style={{
                  border: `2px solid ${decisions[conflict.field] === 'ai' ? '#4f46e5' : '#e2e8f0'}`,
                  borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
                  background: decisions[conflict.field] === 'ai' ? '#eef2ff' : '#fff',
                  transition: 'all 0.15s',
                }}>
                  <input type="radio" name={conflict.field} value="ai"
                    checked={decisions[conflict.field] === 'ai'}
                    onChange={() => setDecisions(d => ({ ...d, [conflict.field]: 'ai' }))}
                    style={{ display: 'none' }}
                  />
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#4f46e5', marginBottom: 4 }}>🤖 使用 AI 新版本</div>
                  <div style={{ fontSize: 11, color: '#111827', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{conflict.aiValue}</div>
                </label>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1.5px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
            取消
          </button>
          <button onClick={() => onResolve(decisions)} style={{ padding: '8px 20px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
            ✅ 确认并应用
          </button>
        </div>
      </div>
    </div>
  );
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

  // Conflict resolution state
  const [pendingConflicts, setPendingConflicts] = useState(null);
  const [pendingApplyData, setPendingApplyData] = useState(null);

  // Research Chat state
  const [chatOpen, setChatOpen]       = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput]     = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // File rename state
  const [renameOpen, setRenameOpen]   = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameStep, setRenameStep]   = useState('');
  const [renameSuggestions, setRenameSuggestions] = useState(null); // [{id, oldName, newName, keep}]
  const [renameApplying, setRenameApplying] = useState(false);
  const [renameMsg, setRenameMsg]     = useState('');

  // Sync projectId when selectedCase changes
  useEffect(() => {
    setProjectId(selectedCase?.manusProjectId || null);
    setProjectUrl(selectedCase?.manusProjectUrl || null);
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
  const fetchDriveContext = useCallback(async (token, confirmedFolderId = null, confirmedFolderName = null, ignoreScore = false, listOnly = false) => {
    const r = await fetch('/api/drive-sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: token,
        clientName: selectedClient.name,
        ...(confirmedFolderId ? { confirmedFolderId, confirmedFolderName } : {}),
        ...(ignoreScore ? { ignoreScore: true } : {}),
        ...(listOnly ? { listOnly: true } : {}),
      }),
    });
    if (!r.ok) throw new Error(`Drive sync failed: ${r.status}`);
    return r.json();
  }, [selectedClient]);

  /* ── AI Organise File Names ──────────────────────────────────────────── */
  const handleOrganiseNames = useCallback(async () => {
    if (!selectedClient) return;
    setRenameLoading(true); setRenameStep('📁 读取文件列表...'); setRenameSuggestions(null); setRenameMsg('');
    try {
      const token = await getValidToken();
      if (!token) throw new Error('请先登录 Google 账号');

      // listOnly: just get file names, no content
      const driveData = await fetchDriveContext(token, null, null, false, true);
      if (!driveData.folderFound) throw new Error(driveData.message || '未找到文件夹');

      const files = (driveData.processed || []).filter(f => !f.name.includes('/')); // skip subfolder paths for rename
      const allFiles = driveData.processed || [];

      setRenameStep('🤖 AI 分析文件名...');
      const fileList = allFiles.map((f, i) => `${i + 1}. [score:${f.relevanceScore ?? '?'}] ${f.name}`).join('\n');

      const prompt = `You are an Australian migration document organiser for Ozsky International.
The following files are in a client's Google Drive folder. Many have non-standard names (Chinese names, random strings, unclear labels).

Your task: Suggest a standardised English filename for EACH file, following this naming convention:
- Use underscore_case (no spaces)
- Include document type and date if visible in the filename
- Keep extensions unchanged
- If a filename is already clear and standard, mark it as "keep"
- Only suggest renames for files that would improve to a score of 45+ (immigration-relevant docs)
- Skip design/marketing files

Scoring reference (what score they should ideally get):
- passport, visa_grant, bridging_visa, birth_cert → 90+
- ielts_result, pte_score, skills_assessment, outcome_letter → 85+
- degree_certificate, transcript, employment_letter → 70+
- resume, cv, marriage_cert, police_clearance → 55+

Current files:
${fileList}

Return ONLY a JSON array (no markdown fences, no explanation):
[
  { "index": 1, "oldName": "原文件名.pdf", "newName": "suggested_name.pdf", "reason": "brief reason in Chinese" },
  ...
]
For files that are already well-named or should not be renamed, set "newName" to the same as "oldName".`;

      const data = await callManus({
        model: 'claude-haiku-4-5-20251001', max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = data.content?.[0]?.text || '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('AI 未返回有效的 JSON 数组');
      const suggestions = JSON.parse(jsonMatch[0]);

      // Merge with file IDs
      const withIds = suggestions.map(s => {
        const file = allFiles[s.index - 1];
        return {
          id: file?.id,
          oldName: s.oldName || file?.name,
          newName: s.newName || s.oldName || file?.name,
          reason: s.reason || '',
          keep: s.newName === s.oldName || !s.newName,
          mimeType: file?.mimeType,
          score: file?.relevanceScore ?? 0,
        };
      }).filter(s => s.id);

      setRenameSuggestions(withIds);
    } catch (e) {
      setRenameMsg(`❌ ${e.message}`);
    } finally {
      setRenameLoading(false); setRenameStep('');
    }
  }, [selectedClient, fetchDriveContext]);

  /* ── Apply rename suggestions ────────────────────────────────────────── */
  const handleApplyRenames = useCallback(async () => {
    if (!renameSuggestions) return;
    const toRename = renameSuggestions.filter(s => !s.keep && s.newName && s.newName !== s.oldName);
    if (toRename.length === 0) { setRenameMsg('没有需要重命名的文件'); return; }

    setRenameApplying(true); setRenameMsg('');
    try {
      const token = await getValidToken();
      if (!token) throw new Error('请先登录 Google 账号');

      const r = await fetch('/api/drive-rename', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: token,
          renames: toRename.map(s => ({ id: s.id, newName: s.newName })),
        }),
      });
      const result = await r.json();
      setRenameMsg(`✅ 成功重命名 ${result.succeeded} 个文件${result.failed ? `，${result.failed} 个失败` : ''}。下次生成简报时评分将正确识别。`);
      // Clear drive cache so next brief re-reads with new names
      if (result.succeeded > 0 && selectedCase) {
        onSaveCase({ ...selectedCase, driveCache: null });
      }
      setRenameSuggestions(null);
    } catch (e) {
      setRenameMsg(`❌ ${e.message}`);
    } finally {
      setRenameApplying(false);
    }
  }, [renameSuggestions, selectedCase, onSaveCase]);

  /* ── Generate brief ──────────────────────────────────────────────────── */
  const generate = useCallback(async (confirmedFolderId = null, confirmedFolderName = null, forceRefresh = false, ignoreScore = false) => {
    if (!selectedCase) return;
    setLoading(true); setError(''); setBrief(''); setDriveStatus(null); setFolderCandidates(null);

    const gmail = readSession();
    let driveContext = '';

    setStep('🚀 初始化案件 Project...');
    let pid = projectId;
    if (!pid) {
      pid = await ensureManusProject(selectedCase, selectedClient, onSaveCase);
      if (pid) { setProjectId(pid); }
    }

    if (selectedClient && sessionIsValid(gmail)) {
      setStep('📁 读取 Drive 文件夹...');
      try {
        const token = await getValidToken();
        if (token) {
          const driveData = await fetchDriveContext(token, confirmedFolderId, confirmedFolderName, ignoreScore);
          if (driveData.needsConfirmation) {
            setFolderCandidates(driveData.candidates);
            setDriveStatus({ found: false, message: driveData.message });
            setLoading(false); setStep('');
            return;
          }
          if (driveData.folderFound && driveData.processed?.length) {
            // ── Cache check: if fingerprint matches last brief, reuse cached driveContext ──
            const cache = selectedCase?.driveCache;
            if (
              !forceRefresh &&
              cache?.fingerprint &&
              cache.fingerprint === driveData.fingerprint &&
              cache.driveContext
            ) {
              driveContext = cache.driveContext;
              setDriveStatus({ found: true, folderName: driveData.folderName, fileCount: driveData.totalFiles, readCount: cache.readCount || 0, cached: true });
            } else {
              // Cache miss — build driveContext from fresh file content
              const textParts = [], binaryNames = [], lowScoreNames = [];
              // Tier-1 files (score ≥80) get 4000 chars each; score 45-79 get 2000 chars; below 45 = filename only
              const CHARS_HIGH_PRIORITY = 4000;
              const CHARS_PER_FILE = 2000;
              const TOTAL_DRIVE_CHARS = 14000;
              let driveCharsUsed = 0;
              for (const f of driveData.processed) {
                const score = f.relevanceScore || 0;
                if (score < 45) {
                  // Low relevance: payslips, bills, design files — list name only, don't waste tokens
                  lowScoreNames.push(`  [low-relevance] ${f.name}`);
                } else if (f.textContent) {
                  const limit = score >= 80 ? CHARS_HIGH_PRIORITY : CHARS_PER_FILE;
                  const snippet = f.textContent.slice(0, limit);
                  if (driveCharsUsed + snippet.length <= TOTAL_DRIVE_CHARS) {
                    textParts.push(`[File: ${f.name}${score ? ' (score:' + score + ')' : ''}]\n${snippet}`);
                    driveCharsUsed += snippet.length;
                  } else { binaryNames.push(`  [✓] ${f.name} (content over budget)`); }
                } else { binaryNames.push(`  [✓] ${f.name}`); }
              }
              const parts = [...textParts];
              if (binaryNames.length) parts.push(`Other files (filename only):\n${binaryNames.join('\n')}`);
              if (lowScoreNames.length) parts.push(`Low-relevance files skipped (payslips/bills/design — not read):\n${lowScoreNames.join('\n')}`);
              if (parts.length) {
                driveContext = `Google Drive Folder: ${driveData.folderName} (${driveData.totalFiles} files)\n\n` + parts.join('\n\n---\n\n');
              }
              // Store fingerprint + driveContext on the case so next run can skip Drive reads
              // We write this now (before the AI call) so even if AI fails, the Drive data is cached
              const updatedWithCache = {
                ...selectedCase,
                driveCache: {
                  fingerprint: driveData.fingerprint,
                  driveContext,
                  readCount: textParts.length,
                  cachedAt: new Date().toISOString(),
                },
              };
              onSaveCase(updatedWithCache);
              setDriveStatus({ found: true, folderName: driveData.folderName, fileCount: driveData.totalFiles, readCount: textParts.length, cached: false });
            }
          } else {
            setDriveStatus({ found: false, message: driveData.message || 'Client folder not found' });
          }
        }
      } catch (driveErr) {
        setDriveStatus({ found: false, message: `Drive error: ${driveErr.message}` });
      }
    }

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

    setStep('🤖 生成案件简报 (Manus AI)...');
    try {
      const prompt = buildCaseBriefPrompt(selectedClient, selectedCase, emailContext, driveContext);
      const data = await callManus({
        model: 'claude-haiku-4-5-20251001', max_tokens: 2000,
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

  /* ── Apply brief to case (with human override protection) ────────────── */
  const applyBriefText = async (briefText, pid = projectId) => {
    if (!briefText) return;
    setApplyBusy(true); setApplyMsg(''); setError('');
    try {
      setPreviousCase({ ...selectedCase });
      const data = await callManus({
        model: 'claude-haiku-4-5-20251001', max_tokens: 1200,
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

      // ── Check for conflicts with humanOverrides ──────────────────────
      const conflicts = detectConflicts(selectedCase, ex);
      if (conflicts.length > 0) {
        // Pause and ask user to resolve conflicts
        setPendingConflicts(conflicts);
        setPendingApplyData({ ex, briefText, pid });
        setApplyBusy(false);
        return; // Don't apply yet — wait for user decision
      }

      // No conflicts — apply directly
      await doApply(ex, briefText, pid, {});
    } catch (e) {
      setError(e.message);
      setApplyBusy(false);
    }
  };

  /* ── Actually apply after conflict resolution ────────────────────────── */
  const doApply = async (ex, briefText, pid, decisions) => {
    setApplyBusy(true);
    try {
      const overrides = { ...(selectedCase.humanOverrides || {}) };

      // Merge timeline (always additive, never overridden)
      const existingTimeline = selectedCase.caseTimeline || [];
      const existingKeys = new Set(existingTimeline.map(t =>
        `${(t.date || '').trim().toLowerCase()}|${(t.event || '').trim().toLowerCase()}`
      ));
      const newEntries = (ex.caseTimeline || []).filter(t => {
        if (!t.date && !t.event) return false;
        return !existingKeys.has(`${(t.date || '').trim().toLowerCase()}|${(t.event || '').trim().toLowerCase()}`);
      });

      // Merge docs — respect human overrides for docs
      const existingDocs = selectedCase.docs || {};
      const humanDocOverrides = overrides.docs?.value || {};
      const mergedDocs = { ...existingDocs };
      for (const [k, v] of Object.entries(ex.docs || {})) {
        // If human has explicitly confirmed this doc as received, never downgrade it
        if (humanDocOverrides[k] === true) {
          mergedDocs[k] = true;
        } else if (decisions.docs === 'ai') {
          mergedDocs[k] = v;
        } else if (!(k in mergedDocs)) {
          mergedDocs[k] = v;
        } else if (v === true && !humanDocOverrides[k]) {
          mergedDocs[k] = true;
        }
      }

      // Resolve each conflicted field based on user decision
      const resolveField = (field, aiValue, existingValue) => {
        if (decisions[field] === 'ai') {
          // User chose AI — clear the human override for this field
          delete overrides[field];
          return aiValue;
        }
        // User chose human (or no conflict) — keep human override
        if (overrides[field]) return overrides[field].value;
        return aiValue || existingValue;
      };

      const finalStatus    = resolveField('status',    ex.status?.trim(),    selectedCase.status);
      const finalSnapshot  = resolveField('snapshot',  ex.snapshot?.trim(),  selectedCase.snapshot);
      const finalKeyIssues = resolveField('keyIssues', ex.keyIssues?.length ? ex.keyIssues : null, selectedCase.keyIssues || []);
      const finalNextSteps = resolveField('nextSteps', ex.nextSteps?.length ? ex.nextSteps : null, selectedCase.nextSteps || []);

      const dateStr = new Date().toISOString().slice(0, 10);
      const briefNote = {
        id: 'n' + Math.random().toString(36).slice(2, 9),
        text: [
          `🤖 AI案件简报 — ${selectedCase.type || 'Case'}`,
          finalSnapshot   ? `📌 概况：${finalSnapshot}` : '',
          finalStatus     ? `📊 状态：${finalStatus}` : '',
          finalNextSteps?.length ? `📋 下步行动：\n${finalNextSteps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}` : '',
          finalKeyIssues?.length ? `⚠️ 关键问题：\n${finalKeyIssues.map(i => `  [${i.priority}] ${i.item}`).join('\n')}` : '',
          `🕐 生成时间：${dateStr}`,
        ].filter(Boolean).join('\n'),
        createdAt: new Date().toISOString(),
        type: 'ai-brief',
      };

      const updatedCase = {
        ...selectedCase,
        status:         finalStatus    || selectedCase.status,
        snapshot:       finalSnapshot  || selectedCase.snapshot,
        aiBrief:        briefText,
        aiBriefDate:    dateStr,
        caseTimeline:   [...existingTimeline, ...newEntries],
        docs:           mergedDocs,
        keyIssues:      finalKeyIssues,
        nextSteps:      finalNextSteps,
        humanOverrides: overrides,
        notes:          [briefNote, ...(Array.isArray(selectedCase.notes) ? selectedCase.notes : [])],
        ...(pid && !selectedCase.manusProjectId ? { manusProjectId: pid } : {}),
      };

      await onSaveCase(updatedCase);
      setApplyMsg('✅ 已应用到案件档案 (Manus AI)');
      setTimeout(() => setApplyMsg(''), 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setApplyBusy(false);
      setPendingConflicts(null);
      setPendingApplyData(null);
    }
  };

  /* ── Handle conflict resolution ──────────────────────────────────────── */
  const handleConflictResolve = async (decisions) => {
    if (!pendingApplyData) return;
    const { ex, briefText, pid } = pendingApplyData;
    await doApply(ex, briefText, pid, decisions);
  };

  const handleConflictCancel = () => {
    setPendingConflicts(null);
    setPendingApplyData(null);
    setApplyMsg('⚠️ 已取消 — 简报已生成但未应用到案件档案');
    setTimeout(() => setApplyMsg(''), 5000);
  };

  /* ── Research Chat send ──────────────────────────────────────────────── */
  const handleChatSend = async () => {
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    setChatInput('');
    setChatLoading(true);

    const userMsg = { role: 'user', content: q };
    setChatMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', loading: true }]);

    const caseContext = `Case: ${selectedCase?.type || 'Visa'} | Client: ${selectedClient?.name || 'Client'} | Status: ${selectedCase?.status || 'Unknown'}`;

    try {
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
        { model: 'claude-haiku-4-5-20251001', max_tokens: 1000, messages },
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
    if (driveStatus.found) {
      const cacheTag = driveStatus.cached ? ' ⚡ 已使用缓存' : '';
      return `📁 ${driveStatus.folderName} — 已读取 ${driveStatus.readCount}/${driveStatus.fileCount} 个文件${cacheTag}`;
    }
    return `📁 ${driveStatus.message}`;
  };

  /* ── Override badge helper ───────────────────────────────────────────── */
  const hasOverride = (field) => !!(selectedCase?.humanOverrides?.[field]);

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <>
      {/* Conflict Resolution Modal */}
      {pendingConflicts && (
        <ConflictModal
          conflicts={pendingConflicts}
          onResolve={handleConflictResolve}
          onCancel={handleConflictCancel}
        />
      )}

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
            {hasOverride('keyIssues') || hasOverride('nextSteps') || hasOverride('status') ? (
              <span style={{ fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>
                🔒 含手工修改
              </span>
            ) : null}
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
            {/* Override status banner */}
            {(hasOverride('keyIssues') || hasOverride('nextSteps') || hasOverride('status') || hasOverride('docs')) && (
              <div style={{ background: '#FFFBEB', border: '1.5px solid #F59E0B', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 8 }}>
                🔒 <strong>手工修改保护已启用</strong> — 重新生成时，以下字段已被锁定：
                {[
                  hasOverride('status') && '案件状态',
                  hasOverride('snapshot') && '案件概况',
                  hasOverride('keyIssues') && '关键问题',
                  hasOverride('nextSteps') && '下步行动',
                  hasOverride('docs') && '文件清单',
                ].filter(Boolean).join('、')}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => generate()} disabled={loading || applyBusy || !selectedCase}
                style={btnStyle(C.blue, loading || applyBusy || !selectedCase)}>
                {loading ? `⏳ ${step}` : applyBusy ? '⏳ 应用中...' : '✨ 生成并应用简报'}
              </button>
              {/* Deep read — ignores score filter, reads all files */}
              {!loading && !applyBusy && selectedCase && (
                <button
                  onClick={() => generate(null, null, true, true)}
                  title="忽略文件名评分，强制读取所有文件（适用于文件名不规范的情况）"
                  style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, background: '#fff', color: '#0d9488', border: '1.5px solid #0d9488', borderRadius: 8, cursor: 'pointer' }}
                >
                  🔍 深度读取
                </button>
              )}
              {/* Force refresh — clears Drive cache and re-reads all files */}
              {selectedCase?.driveCache && !loading && !applyBusy && (
                <button
                  onClick={() => generate(null, null, true)}
                  title="清除 Drive 文件缓存，重新读取（解决504超时）"
                  style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, background: '#fff', color: '#6b7280', border: '1.5px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }}
                >
                  🔄 刷新缓存
                </button>
              )}
              {/* Organise file names */}
              {!loading && !applyBusy && selectedCase && sessionIsValid(readSession()) && (
                <button
                  onClick={() => { setRenameOpen(o => !o); if (!renameOpen) { setRenameSuggestions(null); setRenameMsg(''); } }}
                  title="让 AI 分析并建议规范化文件名，然后一键批量重命名"
                  style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, background: renameOpen ? '#fef3c7' : '#fff', color: '#d97706', border: '1.5px solid #d97706', borderRadius: 8, cursor: 'pointer' }}
                >
                  ✏️ 整理文件名
                </button>
              )}
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

            {/* ── File Name Organiser Panel ─────────────────────────────── */}
            {renameOpen && (
              <div style={{ border: '1.5px solid #fde68a', borderRadius: 10, overflow: 'hidden', background: '#fffbeb' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>✏️ AI 文件名整理</span>
                  <span style={{ fontSize: 11, color: '#b45309' }}>AI 会分析 Drive 里的文件名，建议规范化命名（如 passport.pdf、ielts_result_2024.pdf），提高简报识别率</span>
                  <button onClick={handleOrganiseNames} disabled={renameLoading || renameApplying}
                    style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 12, fontWeight: 600, background: renameLoading ? '#e5e7eb' : '#d97706', color: '#fff', border: 'none', borderRadius: 7, cursor: renameLoading ? 'default' : 'pointer' }}>
                    {renameLoading ? `⏳ ${renameStep}` : '🔍 分析文件名'}
                  </button>
                </div>

                {/* Suggestions list */}
                {renameSuggestions && (
                  <div style={{ padding: '10px 14px', maxHeight: 340, overflowY: 'auto' }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
                      勾选要重命名的文件（绿色 = 建议重命名，灰色 = 已是规范命名）。确认后点"执行重命名"。
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {renameSuggestions.map((s, i) => {
                        const changed = s.newName !== s.oldName;
                        return (
                          <div key={s.id || i} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px',
                            background: s.keep ? '#f9fafb' : '#f0fdf4',
                            border: `1px solid ${s.keep ? '#e5e7eb' : '#bbf7d0'}`,
                            borderRadius: 7, opacity: s.keep && changed ? 0.5 : 1,
                          }}>
                            <input type="checkbox" checked={!s.keep} disabled={!changed}
                              onChange={() => setRenameSuggestions(prev => prev.map((x, j) => j === i ? { ...x, keep: !x.keep } : x))}
                              style={{ marginTop: 2, cursor: changed ? 'pointer' : 'default' }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, color: '#6b7280', wordBreak: 'break-all' }}>旧：{s.oldName}</div>
                              {changed && <div style={{ fontSize: 12, fontWeight: 600, color: '#059669', wordBreak: 'break-all' }}>新：{s.newName}</div>}
                              {s.reason && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{s.reason}</div>}
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 600, color: s.score >= 80 ? '#dc2626' : s.score >= 45 ? '#d97706' : '#9ca3af', flexShrink: 0 }}>
                              {s.score}分
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button onClick={handleApplyRenames} disabled={renameApplying || !renameSuggestions?.some(s => !s.keep && s.newName !== s.oldName)}
                        style={btnStyle('#059669', renameApplying || !renameSuggestions?.some(s => !s.keep && s.newName !== s.oldName))}>
                        {renameApplying ? '⏳ 重命名中...' : `✅ 执行重命名 (${renameSuggestions.filter(s => !s.keep && s.newName !== s.oldName).length} 个)`}
                      </button>
                      <button onClick={() => setRenameSuggestions(null)}
                        style={{ padding: '9px 12px', fontSize: 12, background: 'none', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 7, cursor: 'pointer' }}>
                        取消
                      </button>
                    </div>
                  </div>
                )}

                {renameMsg && (
                  <div style={{ padding: '8px 14px', fontSize: 12, color: renameMsg.startsWith('✅') ? '#059669' : '#dc2626', fontWeight: 600 }}>
                    {renameMsg}
                  </div>
                )}
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
                <div style={{ background: '#F5F3FF', padding: '10px 14px', borderBottom: '1px solid #DDD6FE', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.purple }}>💬 Manus 研究助手</span>
                  <span style={{ fontSize: 11, color: '#7c3aed', background: '#EDE9FE', padding: '2px 7px', borderRadius: 10 }}>
                    ozsky-migration-agent
                  </span>
                  <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>
                    {selectedCase?.type || 'Visa'} | {selectedClient?.name || 'Client'}
                  </span>
                </div>
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
    </>
  );
}

/* ── Export helpers for use in App.js ────────────────────────────────────── */
export { getEffectiveValue, makeOverride };
