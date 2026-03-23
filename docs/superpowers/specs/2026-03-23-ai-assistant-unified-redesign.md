# Nexus CRM — AI Assistant Unified Redesign
**Date:** 2026-03-23
**Author:** Liang Jiang / Ozsky Migration
**Status:** Ready for user review

---

## Background & Problem Statement

The current AI Assistant tab in the client modal has three disconnected sub-tabs (Gmail Sync, OCR/Document Recognition, Snapshot) with several known issues:

1. **Document reading is poor** — OCR uses a fixed-field extraction schema; misses nationality, passport numbers, and complex immigration data that a holistic AI read would catch
2. **No "Apply to Profile" in AI tab** — Import Doc tab has this; AI assistant does not
3. **Gmail token is per-component** — stored in React state, lost whenever the client modal closes/opens (i.e. when switching clients), forcing reconnection each time
4. **Email notes are not chronological** — no way to bulk-save emails as a structured timeline note
5. **Snapshot is shallow** — only 4 sections; reference snapshots (DUO_Liping, YANG_Jiaxiang) have 7 rich sections including visa history tables, document checklists, timelines, and risk flags
6. **No unified flow** — gathering sources and generating snapshot are disconnected actions

---

## Goals

- Replace the 3-tab AI panel with a single unified vertical workflow
- Fix document reading by replacing fixed-field OCR with full AI comprehension
- Make Gmail authentication session-scoped (not per-client), with 60-min timeout
- Enable bulk email → chronological notes (individual + timeline)
- Generate comprehensive 7-section bilingual snapshots matching the DUO_Liping/YANG_Jiaxiang template
- Add Apply to Profile to snapshot output (same depth as Import Doc tab)
- Deliver a complete manual test plan for the full application

---

## Design

### 1. Overall Architecture — Unified AI Panel

Replace `SmartAI.jsx`'s 3-tab layout with a single vertical workflow:

```
┌─────────────────────────────────────┐
│  🤖 AI 智能助手                      │
│  [Client: DUO Liping]               │
├─────────────────────────────────────┤
│  STEP 1 — SOURCES                   │
│  📧 Gmail  [connected ●]  [Search]  │
│     └── email list (collapsible)    │
│  📄 Documents  [+ Upload file]      │
│     └── uploaded docs list          │
├─────────────────────────────────────┤
│  STEP 2 — [✨ Generate Snapshot]    │
├─────────────────────────────────────┤
│  STEP 3 — SNAPSHOT OUTPUT           │
│     7-section bilingual text        │
│  [Apply to Profile] [Save .txt]     │
│  [Save as Note] [Copy]              │
└─────────────────────────────────────┘
```

**Key principles:**
- No tabs within the AI panel — one linear flow
- Sources (emails + docs) feed directly into snapshot generation
- Apply to Profile lives on the snapshot output
- Gmail connection state is always visible at the top of the Sources section

---

### 2. Gmail Session Management

**Problem:** Token stored in React component state → lost on modal close.

**Solution:** Store Gmail credentials in `sessionStorage` under a fixed key `ozsky_gmail_session`:

```json
{
  "accessToken": "ya29...",
  "refreshToken": "1//...",
  "expiresAt": 1742000000000
}
```

**Behaviour:**
- On successful OAuth callback, write all three fields to `sessionStorage`
- On each Gmail API call, check `expiresAt`. If within 5 minutes of expiry, auto-refresh via `POST /api/gmail-auth` with `action=refresh` before proceeding
- Timeout: 60 minutes from last successful auth (reset on reconnect, not on each use)
- Token survives: client modal open/close, switching between clients, page navigation within the app
- Token is lost: page refresh, browser tab close, explicit "Disconnect" button

**OAuth callback change:** `gmail-auth.js` redirect currently passes token in URL fragment. Add `gmail_refresh_token` and `gmail_expires_in` to the fragment (already done). Frontend reads all three and writes to `sessionStorage`. `prompt: 'consent'` must remain in the auth URL to ensure Google always returns a `refresh_token`.

**60-minute timeout clarification:** The CRM session timeout matches Google's OAuth access token TTL (≈60 min from `expires_in`). Auto-refresh via the existing `/api/gmail-auth` refresh endpoint transparently extends this — there is no separate CRM-level cutoff. The user only needs to reconnect manually if they close the browser tab, clear sessionStorage, or if auto-refresh fails. This is the "one connect per session" behaviour the user expects.

**Post-OAuth navigation:** Before redirecting to Google OAuth, store the active client ID in `sessionStorage` under `ozsky_pending_client_id`. After the OAuth callback writes the token, the app reads this key and re-opens the correct client modal automatically. The key is cleared after use.

---

### 3. Email Search & Notes

**Search behaviour:**
- Default query pre-filled: `from:{client.email} OR to:{client.email}` when client has an email
- Falls back to `subject:"{client.name}"` if no email
- User can edit query freely; "Reset to client" button restores default
- Result count configurable (default 30, max 100)

**Per-email note format:**
```
[Gmail 2026-03-15] 主题: Re: 870担保申请
发件人: yidan@gmail.com
摘要: Yidan confirmed sponsorship documents uploaded to ImmiAccount.
建议行动: Follow up on processing timeline with DHA.
紧急程度: 中
```

**"Save all as timeline" note format:**
```
[Gmail 邮件时间线 — DUO Liping — 2026-03-23]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 2025-10-28 | 870担保申请递交确认 — Yidan submitted sponsorship...
• 2026-01-15 | 签证处理状态更新 — DHA acknowledged valid application...
• 2026-03-04 | 870担保获批通知 — Sponsorship approved, BCC confirmed...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
共 3 封相关邮件 | 由 AI 辅助整理
```

Both actions call the existing `onAddNote` prop — no new backend needed.

**Note format canon:** The new per-email and timeline formats replace the existing `handleSaveNote` format. The key changes are: the header bracket format changes from `[Gmail 邮件 …]` to `[Gmail YYYY-MM-DD]`, the `紧急程度` field is added, and the note uses full-width colons (：) consistently throughout.

**Timeline size limit:** Cap at 50 emails per timeline note. If the search returned more, append: `（仅显示最近 50 封，共 X 封相关邮件）`.

---

### 4. Document Reading — Full AI Comprehension

**Replace** the fixed-field OCR extraction with a holistic AI read.

**Frontend changes (SmartAI.jsx):**
- Remove document type selector (no longer needed — Claude identifies type automatically)
- Upload one file at a time (PDF, image, docx, txt) — same file input UX
- After upload, show a full extracted data card with all found fields grouped by category

**File type handling — frontend and backend:**

The Claude API requires different content block types for different file formats:
- **Images (jpg, png, gif, webp):** base64 `image` content block (existing approach — keep as-is)
- **PDF:** base64 `document` content block with `media_type: "application/pdf"`
- **DOCX:** frontend uses `mammoth` (already a dependency in the project) to extract plain text before upload; sends as a `text` content block
- **TXT:** read as plain text via `FileReader.readAsText()`; send as a `text` content block

The frontend determines the content block type from `file.type` / file extension and sends `{ fileBase64, mimeType, fileName, textContent }` to the backend. The backend uses `textContent` for docx/txt (bypassing the base64/image path) and base64 for image/PDF.

**Backend rewrite (`/api/parse-document.js`) — this is a full rewrite, not a patch:**
The current implementation must be replaced entirely because:
- It requires `documentType` in the request body and returns 400 if absent — remove this guard
- It has a hard MIME-type allow-list (`['image/jpeg','image/png','image/gif','image/webp','application/pdf']`) — remove this allow-list
- It hardcodes `type: 'image'` for all content blocks including PDFs — wrong for PDFs and text
- Its confidence metric is fill-rate based (fields present / total fields) — meaningless for open-ended extraction; replace with Claude's own confidence assessment in the response JSON

**New backend logic:**
- If `textContent` is present in the request body: send Claude a `text` content block (ignore fileBase64)
- If `mimeType` is `application/pdf`: send Claude a `document` content block with base64 data
- If `mimeType` starts with `image/`: send Claude an `image` content block with base64 data (existing approach)
- Remove `documentType` from the required fields
- Replace the per-document-type prompt schema with a single comprehensive prompt:

```
You are an Australian immigration document expert. Read this document fully and extract ALL relevant information. Return JSON with any of these fields that are present:

Personal: fullName, nameChinese, sex, dob, birthplace, nationality, passportNo, passportExpiry, chinaId, email, phone, auAddress, maritalStatus

Visa: visaType, visaSubclass, applicationId, trnNumber, grantDate, expiryDate, conditions[], visaAuthNo

Sponsor: sponsorName, sponsorDob, sponsorNationality, sponsorPassportNo, sponsorRelationship, sponsorAddress, sponsorOccupation

Education: institution, courseCode, courseName, coeNumber, coeStart, coeEnd, tuitionFee, studentId

Financial: annualIncome, bankBalance, bankBsb, bankAccount, companyName, companyAcn, pensionIncome

Case: bccNumber, applicationFee, receiptNumber, afpNumber, policyNumber, documents[]

Timeline events: [{date, event}]

Only include fields where you found actual values. Do not guess.
```

**Extracted fields displayed in preview card** — same grouping as above, filtered to non-null values only.

**Error handling:** If mammoth fails to extract text from a DOCX (e.g. password-protected, corrupt file), the frontend shows a red error message and does not attempt an API call. Same pattern as the current `OcrPanel` error display.

**Uploaded docs list:** Each processed doc shows filename + doc type identified + key field summary (e.g. "Passport — DUO Liping — EJ2927083"). Stays in the session sources list for snapshot generation.

---

### 5. Snapshot Generation — 7-Section Format

**Inputs to snapshot prompt:**
1. All CRM profile fields (same as current `buildSnapshotPrompt`)
2. All Gmail email summaries fetched this session (same as current)
3. All documents processed this session (new — full extracted JSON per doc)

**Output format — 7 sections matching reference templates:**

```
================================================================================
  客户快照  |  CLIENT SNAPSHOT
  [Name] — [Visa Type]
  生成日期：[date] | 经办代理：Liang Jiang | Ozsky Migration
================================================================================

一、基本信息 PERSONAL DETAILS
    (applicant + sponsor if present)

二、签证申请历史 VISA APPLICATION HISTORY
    (table: 序号 | 签证类型 | 申请ID | 获批日期 | 有效期/说明)

三、当前签证状态 CURRENT VISA STATUS
    (table: 签证类型 | 状态 | 备注)

四、关键文件清单 KEY DOCUMENTS ON FILE
    (checklist: [✓] / [ ] per document)

五、案件备注 CASE NOTES
    (numbered observations, cross-references, inconsistencies)

六、⚠️ 关键风险与待办事项 KEY ISSUES & ACTION ITEMS
    (🔴 高 / 🟡 中 / 🟢 低 priority items)

七、时间线 TIMELINE
    (chronological: YYYY-MM-DD | event)

================================================================================
  本快照由 AI 辅助整理，仅供移民代理内部参考，不构成法律意见。
================================================================================
```

**Token budget:** `max_tokens: 4096` (up from current 2000) to accommodate full 7-section output with tables and timelines. Prompt instructs Claude to prioritise sections 一, 二, 三, 六 if output must be trimmed.

---

### 6. Apply to Profile

Reuse the Import Doc tab's apply logic, adapted for snapshot data.

**Flow:**
1. User clicks "Apply to Profile" on snapshot output
2. AI call (`/api/claude`) parses the snapshot text into structured JSON — same extraction prompt as Import Doc paste import
3. Show preview grid (same as Import Doc "Apply to Record" UI)
4. "Confirm Apply" merges into client record per the rules below

**Merge strategy — scalar fields** (`name`, `email`, `phone`, `nationality`, `profile.dob`, `profile.passportNo`, `profile.passportExpiry`, `profile.auAddress`, `profile.nameZh`):
- "Populated" = non-null, non-empty string
- Skip if already populated (no clobber), unless user has toggled "Overwrite existing"

**Merge strategy — array fields** (`profile.visaHistory[]`, `profile.skillsAssessments[]`, `profile.caseTimeline[]`, `profile.keyIssues[]`):
- "Populated" = array has at least one entry where any meaningful field (e.g. `visaType`, `occupation`, `event`, `item`) is non-empty
- If the existing array is empty or contains only skeleton objects (all fields null/empty): replace with extracted array
- If existing array has real entries: append new entries, deduplicating by a key field (`visaHistory` by `applicationNo`; `skillsAssessments` by `appId`; `caseTimeline` by `date+event`; `keyIssues` by `item`)
- "Overwrite existing" toggle replaces the entire array

**Merge strategy — nested objects** (`profile.sponsor`, `profile.serviceAgreement`):
- Shallow merge: only overwrite sub-fields that are currently null/empty
- "Overwrite existing" toggle replaces the entire object

**Updated `onImportClient` handler in `App.js`** (replaces lines 2866–2883):
The handler receives a full import data object and applies the above merge strategy. It calls `onSaveProfile` with the fully merged client record.

**Array merge pseudocode (implement as a named utility `mergeArrayField`):**
```js
function mergeArrayField(existing, incoming, keyFn) {
  // "populated" = has at least one entry with a non-empty key field
  const hasRealEntries = arr => arr.some(item => keyFn(item));
  if (!hasRealEntries(existing)) return incoming;          // replace skeleton
  const existingKeys = new Set(existing.map(keyFn).filter(Boolean));
  const toAppend = incoming.filter(item => !existingKeys.has(keyFn(item)));
  return [...existing, ...toAppend];                       // append new only
}

// Usage:
visaHistory:        mergeArrayField(old, new, v => v.applicationNo)
skillsAssessments:  mergeArrayField(old, new, s => s.appId)
caseTimeline:       mergeArrayField(old, new, t => `${t.date}|${t.event}`)
keyIssues:          mergeArrayField(old, new, i => i.item)
```

**Refresh race condition:** To prevent two concurrent Gmail API calls both triggering a token refresh (which would invalidate the first refresh token), the SmartAI component shall maintain a module-level `refreshPromise` variable. When a refresh is needed, if `refreshPromise` is already set, await it instead of firing a new request. Clear `refreshPromise` when the refresh resolves or rejects.

---

### 7. Test Plan

A comprehensive manual test plan covering the full application, saved to `docs/test-plan/NEXUS-CRM-Test-Plan.md`.

**Sections:**
1. Authentication & Session (login, roles, sign out)
2. Dashboard (stats, recent activity, deadlines)
3. Clients — CRUD, search, filters, hover snapshot
4. Cases — create, assign, progress, notes, document checklist
5. Notes — add, display, timestamps, Ctrl+Enter save
6. Import Doc tab — docx/txt upload, paste text, apply to record, all field mappings
7. AI Assistant tab (unified flow):
   - a. Gmail connect & session persistence (60 min, client switch, page refresh)
   - b. Email search, per-email note save
   - c. Save all as timeline note
   - d. Document upload & AI comprehension (passport, visa, CoE, bank, police check)
   - e. Snapshot generation (CRM only, CRM+emails, CRM+docs, all three)
   - f. Apply to Profile — minimum 3 test cases:
        - TC-A: Client with empty passport fields → all fields populate after apply
        - TC-B: Client with `passportNo` already set, overwrite toggle OFF → field preserved
        - TC-C: Client with existing `visaHistory` entries → new entries appended, no duplicates created
8. WeChat chat import
9. Leads — create, convert to client
10. Invoices, Calendar, Reports
11. Language toggle EN/ZH (key labels)
12. Contract generation

Each test case uses the format:
```
ID: TC-XXX
Title: Short description
Precondition: What must be true before the test
Steps: 1. ... 2. ... 3. ...
Expected Result: What should happen
Pass/Fail: [ ]
```

The test plan file is a standalone deliverable written as actual test cases (not just headings). Minimum 60 test cases covering the sections above.

---

## Files to Change

| File | Change |
|------|--------|
| `src/SmartAI.jsx` | **Full rewrite from scratch** — unified panel replacing 3-tab layout; all changes described in this spec are new implementation, none exist yet in the current file |
| `api/parse-document.js` | **Full rewrite** — remove `documentType` guard, MIME allow-list, fixed-field schema, and fill-rate confidence metric; replace with comprehensive holistic extraction (see Section 4) |
| `api/gmail-auth.js` | Ensure refresh token and expires_in are in redirect fragment |
| `src/App.js` | Minor: update `onImportClient` handler to accept all new fields from Apply to Profile |
| `docs/test-plan/NEXUS-CRM-Test-Plan.md` | New file |

---

## Out of Scope

- Backend document storage (documents are not persisted — session only)
- Multi-file simultaneous upload
- Automated tests / CI pipeline
- Push notifications or email sending
- Changes to Import Doc tab (already works well)
