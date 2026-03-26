# Case AI Snapshot — Design Spec

**Date:** 2026-03-26
**Project:** Nexus CRM (Ozsky Migration)

---

## Goal

Add an AI-generated operational case brief to the case detail modal, accessible from both the standalone Jobs page and the client's cases tab. The brief reads Google Drive and Gmail data for the client, generates a case-focused progress report, and applies extracted structured data back to the case record.

---

## Architecture

A new `CaseAI.jsx` component handles all case brief logic independently of the existing `SmartAI.jsx`. It is rendered at the bottom of the case detail modal (`viewJob`) in `App.js`. The modal already opens from both the Jobs page and the client's cases tab, so one integration point covers both surfaces.

**Note on code duplication:** `CaseAI.jsx` intentionally re-implements the Drive and Gmail fetch logic from `SmartAI.jsx`. A shared hook refactor is out of scope.

---

## Component: `CaseAI.jsx`

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `selectedClient` | `object\|null` | yes | Full client record. `selectedClient.name` is the Drive folder name (same field SmartAI passes to `api/drive-sync.js` as `clientName` — it is the literal folder name under `ozsky-clients/`). `selectedClient.email` used for Gmail search. If `null`, skip Drive and Gmail. |
| `selectedCase` | object | yes | The case being viewed. **`id` and `clientId` are always present** — the modal only opens for saved cases. Other fields may be absent on a freshly-created case: `type`, `status`, `priority`, `dueDate`, `snapshot`, `caseTimeline` (default `[]`), `docs` (default `{}`), `keyIssues` (default `[]`), `nextSteps` (default `[]`), `notes` (default `[]`). |
| `onSaveCase` | `async (updatedCase: object) => void` | yes | CaseAI passes a **complete merged case object** (all original fields preserved). CaseAI awaits this. On rejection, shows error in panel. This is the **only write** — no separate note write. |

> **No `gmail` prop.** CaseAI reads the OAuth session internally via `readSession()` and refreshes tokens via `getValidToken()` — exactly as SmartAI does. SmartAI in App.js receives no `gmail` prop either.

> **`onAddNote` removed from Apply flow.** The AI brief note is included directly in `updatedCase.notes` before `onSaveCase` is called, ensuring a single atomic write and no stale-closure race condition.

---

### Data Sources (fetched in parallel)

**Google Drive:**
- Folder: `ozsky-clients/<selectedClient.name>/`
- Recurse one level into subfolders (max 6), process up to 10 files total
- Text / Google Docs → text content (up to 4000 chars each)
- DOCX → extract text client-side via mammoth
- PDFs and images → Claude document blocks; **combined binary payload cap ≤ 3MB across all blocks**. Files are evaluated in order; any file that would push the running total over 3MB is skipped entirely (not truncated) and its name appended to the prompt as "(以下文件因超出大小限制未能附加，请人工查阅：`<name>`)"
- Folder not found: set Drive status "📁 未找到客户文件夹，将使用 CRM 数据生成", continue
- API error: set Drive status "📁 Drive 读取失败: `<message>`", continue with Gmail + CRM

**Gmail:**
- Search: `from:<email> OR to:<email>` if `selectedClient.email` non-empty, else `"<selectedClient.name>"`
- Up to 10 relevant emails, same summary format as SmartAI
- If `gmail` is null, session invalid, or API throws: skip silently, continue

**CRM data from `selectedCase`:**
- type, status, priority, dueDate, snapshot, caseTimeline, docs, notes, keyIssues, nextSteps

---

### Generate Call

Raw `fetch('/api/claude', { method: 'POST', ... })`, model `claude-sonnet-4-6`, `max_tokens: 4096`.

Error handling (same pattern for both Generate and Apply calls):
```js
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
```

Prompt template:
```
你是澳洲移民公司 Ozsky Perth 的 AI 助理。
根据以下资料，生成一份案件进度简报，供顾问接案或内部交接使用。
如某项信息不足，写"资料待补充"，不要虚构。

[Drive 文件内容]
[CRM 案件数据]
[Gmail 邮件摘要]

请按以下格式输出：

================================================================================
  案件进度简报  |  CASE PROGRESS BRIEF
  <ClientName> — <CaseTitle / VisaType>
  生成日期：<date> | 经办顾问：Liang Jiang | Ozsky Migration
================================================================================

━━━ 一、案件概况  CASE OVERVIEW ━━━
案件类型、当前状态、优先级、截止日期

━━━ 二、文件进度  DOCUMENT STATUS ━━━
[✓] 已收到 / [ ] 待收集

━━━ 三、当前进展  CURRENT PROGRESS ━━━
已完成 / 处理中 / 待办

━━━ 四、关键问题与风险  KEY ISSUES & RISKS ━━━
🔴 高 / 🟡 中 / 🟢 低

━━━ 五、下步行动  NEXT STEPS ━━━
编号行动项

━━━ 六、时间线  TIMELINE ━━━
YYYY-MM-DD | 事件 — 状态（Completed / In Progress / Pending）

================================================================================
  本简报由 AI 辅助整理，仅供内部参考，不构成法律意见。
================================================================================
```

---

### UI Layout

Collapsible panel **"🤖 AI 案件简报"** at the bottom of the case detail modal:

```
┌─────────────────────────────────────────────┐
│ 🤖 AI 案件简报                           [▼] │
├─────────────────────────────────────────────┤
│ [✨ 生成案件简报]  [⬆️ 应用到案件] (after gen) │
│ 📁 Drive: <status line>                     │
│ ┌─────────────────────────────────────────┐ │
│ │ <generated brief — scrollable textarea> │ │
│ └─────────────────────────────────────────┘ │
│ ✅ 已应用到案件档案  (4s fade, after apply)  │
│ ❌ <error message if any>                   │
└─────────────────────────────────────────────┘
```

Drive status line states:
- Loading: `"📁 读取文件夹中..."`
- Success: `"📁 <folderName> — 已读取 <readCount>/<totalFiles> 个文件"`
- Not found: `"📁 未找到客户文件夹，将使用 CRM 数据生成"`
- Error: `"📁 Drive 读取失败: <error message>"`

---

## Apply to Case — Extraction & Merge

### Extraction (second raw `fetch('/api/claude', ...)` call, same error pattern)

```
从以下案件简报提取信息，返回纯 JSON（无 markdown，无注释）。
只填写找到的字段，找不到的用空字符串或空数组。

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

简报文本：\n<brief>
```

Use same balanced-bracket JSON extractor as SmartAI `handleApply`.

### Merge rules

**`caseTimeline` entry shape:** `{ date: string, event: string, status: string }`

| Field | Rule |
|-------|------|
| `status` | Overwrite if extracted value is non-empty string |
| `snapshot` | Overwrite if extracted value is non-empty string |
| `caseTimeline` | Append extracted entries; skip duplicates where both `date.trim().toLowerCase()` AND `event.trim().toLowerCase()` match an existing entry |
| `docs` | Merge into existing `selectedCase.docs`: add new keys freely; **never overwrite `true` with `false`** (received docs stay received); never delete existing keys |
| `keyIssues` | Replace `selectedCase.keyIssues` entirely — intentional |
| `nextSteps` | Replace `selectedCase.nextSteps` entirely — intentional |

### Building `updatedCase` — single write, note included

CaseAI builds one complete object and calls `onSaveCase` once. No separate note write:

```js
const briefNote = {
  id: uid(),
  text: `[AI 案件简报 ${dateStr}]\n${brief.slice(0, 1500)}`,
  createdAt: new Date().toISOString(),
  type: 'note',
};

const updatedCase = {
  ...selectedCase,                          // preserve id, clientId, title, assignedTo, createdAt, etc.
  status:       extracted.status       || selectedCase.status,
  snapshot:     extracted.snapshot     || selectedCase.snapshot,
  caseTimeline: mergedTimeline,
  docs:         mergedDocs,
  keyIssues:    extracted.keyIssues?.length  ? extracted.keyIssues  : (selectedCase.keyIssues  || []),
  nextSteps:    extracted.nextSteps?.length  ? extracted.nextSteps  : (selectedCase.nextSteps  || []),
  notes:        [briefNote, ...normalizeNotes(selectedCase.notes || [])],
};

await onSaveCase(updatedCase);  // single write — no race condition
```

---

## App.js Integration

**Import:**
```js
import CaseAI from './CaseAI';
```

**`handleSaveCase` is defined inside the `Jobs` function** (~line 3228) — this is required because `setViewJob` is local state inside `Jobs`. It cannot live at the App root level.

```js
// Inside function Jobs({ jobs, clients, setJobs, ... }) — where setViewJob is in scope
const handleSaveCase = async (updatedCase) => {
  setJobs(prev => prev.map(j => j.id === updatedCase.id ? updatedCase : j));
  setViewJob(updatedCase);
  try {
    await sbUpdate('jobs', updatedCase.id, { data: updatedCase });
  } catch (e) {
    window.dispatchEvent(new CustomEvent('ozsky-db-error', {
      detail: `Case save failed: ${e.message}`
    }));
  }
};
```

**Render** (inside the `{viewJob && (() => { ... })()}` block, ~lines 3497–4168, immediately before the closing `</div>` of the modal body):

```jsx
<CaseAI
  selectedClient={clients.find(c => c.id === viewJob.clientId) || null}
  selectedCase={viewJob}
  onSaveCase={handleSaveCase}
/>
```

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/CaseAI.jsx` | Create | New component — all case brief logic |
| `src/App.js` | Modify | Import CaseAI; add `handleSaveCase`; render `<CaseAI>` in the `viewJob` modal block |

---

## Out of Scope

- Modifying `SmartAI.jsx`
- Shared Drive/Gmail hook refactor
- Confirmation dialog before overwriting `keyIssues`/`nextSteps`
- Adding CaseAI outside the case detail modal
