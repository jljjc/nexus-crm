# AI Assistant Unified Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SmartAI.jsx's 3-tab layout with a single unified Sources → Generate → Snapshot workflow, fix document reading (holistic AI comprehension), make Gmail session-scoped, add 7-section bilingual snapshots, and deliver a full manual test plan.

**Architecture:** Two new pure utility modules (`gmailSession.js`, `mergeProfile.js`) are created first and tested in isolation. The backend `parse-document.js` is fully rewritten for holistic AI comprehension. The frontend `SmartAI.jsx` is fully rewritten as a unified panel using those utilities. `App.js` receives a targeted update to use the shared merge utility and handle post-OAuth client restore.

**Tech Stack:** React 18 (CRA), Jest + @testing-library/react, Anthropic Claude API, Gmail OAuth2, mammoth.js (DOCX text extraction), Vercel serverless functions

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/utils/gmailSession.js` | Read/write Gmail token in sessionStorage; auto-refresh with race guard |
| Create | `src/utils/gmailSession.test.js` | Unit tests for session utilities |
| Create | `src/utils/mergeProfile.js` | `mergeArrayField`, `mergeScalar`, `mergeObjectField`, `mergeClientData` |
| Create | `src/utils/mergeProfile.test.js` | Unit tests for merge utilities |
| Rewrite | `api/parse-document.js` | Holistic AI document comprehension (no fixed schema, no type guard) |
| Modify | `api/gmail-auth.js` | Add `gmail_user_email` to OAuth redirect fragment |
| Modify | `src/App.js` | Post-OAuth hash reader; pending client restore; use `mergeClientData` in `applyImport` and `onImportClient` |
| Rewrite | `src/SmartAI.jsx` | Unified panel: GmailSection + DocumentSection + SnapshotSection |
| Create | `docs/test-plan/NEXUS-CRM-Test-Plan.md` | Full manual test plan (60+ test cases) |

---

## Task 1: Gmail Session Utility

**Files:**
- Create: `src/utils/gmailSession.js`
- Create: `src/utils/gmailSession.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/utils/gmailSession.test.js
import {
  readSession, writeSession, clearSession,
  sessionIsValid, sessionNeedsRefresh,
} from './gmailSession';

const MOCK_TOKEN = { accessToken:'tok', refreshToken:'ref', expiresAt: Date.now()+3600000, userEmail:'a@b.com' };

beforeEach(() => sessionStorage.clear());

test('readSession returns null when nothing stored', () => {
  expect(readSession()).toBeNull();
});

test('writeSession stores and readSession returns it', () => {
  const s = writeSession('tok', 'ref', 3600, 'a@b.com');
  expect(s.accessToken).toBe('tok');
  expect(readSession().accessToken).toBe('tok');
  expect(readSession().userEmail).toBe('a@b.com');
});

test('clearSession removes storage', () => {
  writeSession('tok','ref',3600,'');
  clearSession();
  expect(readSession()).toBeNull();
});

test('sessionIsValid returns false when no session', () => {
  expect(sessionIsValid(null)).toBe(false);
});

test('sessionIsValid returns true for fresh session', () => {
  expect(sessionIsValid(MOCK_TOKEN)).toBe(true);
});

test('sessionIsValid returns false for expired session', () => {
  expect(sessionIsValid({ ...MOCK_TOKEN, expiresAt: Date.now() - 1 })).toBe(false);
});

test('sessionNeedsRefresh false when far from expiry', () => {
  expect(sessionNeedsRefresh(MOCK_TOKEN)).toBe(false);
});

test('sessionNeedsRefresh true when within 5 min of expiry', () => {
  const soon = { ...MOCK_TOKEN, expiresAt: Date.now() + 2 * 60 * 1000 };
  expect(sessionNeedsRefresh(soon)).toBe(true);
});
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```bash
cd /Users/liang/Downloads/nexus-crm
npx react-scripts test --watchAll=false --testPathPattern=gmailSession
```

- [ ] **Step 3: Implement gmailSession.js**

```js
// src/utils/gmailSession.js
const KEY = 'ozsky_gmail_session';
const BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

let _refreshPromise = null; // race condition guard

export function readSession() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); }
  catch { return null; }
}

export function writeSession(accessToken, refreshToken, expiresIn, userEmail = '') {
  const session = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + Number(expiresIn) * 1000,
    userEmail,
  };
  sessionStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  sessionStorage.removeItem(KEY);
  _refreshPromise = null;
}

export function sessionIsValid(session) {
  return !!(session?.accessToken && Date.now() < session.expiresAt);
}

export function sessionNeedsRefresh(session) {
  return !!(session?.refreshToken && Date.now() >= session.expiresAt - BUFFER_MS);
}

// Returns a valid access token, auto-refreshing if needed.
// Multiple concurrent callers share one in-flight refresh request.
export async function getValidToken() {
  const session = readSession();
  if (!session?.accessToken) return null;
  if (!sessionNeedsRefresh(session)) return session.accessToken;
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const r = await fetch('/api/gmail-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh', refresh_token: session.refreshToken }),
      });
      if (!r.ok) throw new Error('Token refresh failed');
      const data = await r.json();
      const updated = writeSession(data.access_token, session.refreshToken,
        data.expires_in || 3600, session.userEmail);
      return updated.accessToken;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx react-scripts test --watchAll=false --testPathPattern=gmailSession
```

- [ ] **Step 5: Commit**

```bash
git add src/utils/gmailSession.js src/utils/gmailSession.test.js
git commit -m "feat: add gmail session storage utility with auto-refresh and race guard"
```

---

## Task 2: Profile Merge Utility

**Files:**
- Create: `src/utils/mergeProfile.js`
- Create: `src/utils/mergeProfile.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/utils/mergeProfile.test.js
import { mergeScalar, mergeArrayField, mergeObjectField, mergeClientData } from './mergeProfile';

// ── mergeScalar ──────────────────────────────────────────────────────────────
test('mergeScalar: keeps existing non-empty value', () => {
  expect(mergeScalar('existing', 'incoming')).toBe('existing');
});
test('mergeScalar: uses incoming when existing is null', () => {
  expect(mergeScalar(null, 'incoming')).toBe('incoming');
});
test('mergeScalar: uses incoming when existing is empty string', () => {
  expect(mergeScalar('', 'incoming')).toBe('incoming');
});

// ── mergeArrayField ──────────────────────────────────────────────────────────
const keyFn = v => v.applicationNo;

test('mergeArrayField: replaces skeleton array (no real entries)', () => {
  const existing = [{ applicationNo: '', visaType: '' }];
  const incoming = [{ applicationNo: 'A1', visaType: '500' }];
  const result = mergeArrayField(existing, incoming, keyFn);
  expect(result).toEqual(incoming);
});

test('mergeArrayField: appends new entries without duplicates', () => {
  const existing = [{ applicationNo: 'A1', visaType: '500' }];
  const incoming = [
    { applicationNo: 'A1', visaType: '500' }, // duplicate
    { applicationNo: 'A2', visaType: '189' }, // new
  ];
  const result = mergeArrayField(existing, incoming, keyFn);
  expect(result).toHaveLength(2);
  expect(result[1].applicationNo).toBe('A2');
});

test('mergeArrayField: returns incoming when existing is empty array', () => {
  expect(mergeArrayField([], [{ applicationNo: 'A1' }], keyFn))
    .toEqual([{ applicationNo: 'A1' }]);
});

// ── mergeObjectField ─────────────────────────────────────────────────────────
test('mergeObjectField: fills null sub-fields', () => {
  const result = mergeObjectField(
    { name: 'Alice', passportNo: null },
    { name: 'Bob', passportNo: 'P123' },
  );
  expect(result.name).toBe('Alice');     // kept
  expect(result.passportNo).toBe('P123'); // filled
});

// ── mergeClientData ──────────────────────────────────────────────────────────
test('mergeClientData: does not overwrite populated scalar', () => {
  const client = { name: 'Alice', nationality: 'Chinese', profile: {} };
  const imp = { name: 'Bob', nationality: 'Australian', profile: {} };
  const result = mergeClientData(client, imp);
  expect(result.name).toBe('Alice');
  expect(result.nationality).toBe('Chinese');
});

test('mergeClientData: overwrites when overwrite=true', () => {
  const client = { name: 'Alice', profile: {} };
  const imp = { name: 'Bob', profile: {} };
  const result = mergeClientData(client, imp, true);
  expect(result.name).toBe('Bob');
});

test('mergeClientData: appends to visaHistory without duplicates', () => {
  const client = {
    name: 'Alice', profile: {
      visaHistory: [{ applicationNo: 'A1', visaType: '500' }],
    },
  };
  const imp = {
    profile: {
      visaHistory: [
        { applicationNo: 'A1', visaType: '500' },
        { applicationNo: 'A2', visaType: '600' },
      ],
    },
  };
  const result = mergeClientData(client, imp);
  expect(result.profile.visaHistory).toHaveLength(2);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx react-scripts test --watchAll=false --testPathPattern=mergeProfile
```

- [ ] **Step 3: Implement mergeProfile.js**

```js
// src/utils/mergeProfile.js

export function mergeScalar(existing, incoming) {
  if (existing === null || existing === undefined || existing === '') return incoming ?? existing;
  return existing;
}

export function mergeArrayField(existing, incoming, keyFn) {
  if (!Array.isArray(incoming) || incoming.length === 0) return existing ?? [];
  const hasReal = arr => Array.isArray(arr) && arr.some(item => !!keyFn(item));
  if (!hasReal(existing)) return incoming;
  const existingKeys = new Set((existing ?? []).map(keyFn).filter(Boolean));
  const toAppend = incoming.filter(item => !existingKeys.has(keyFn(item)));
  return [...existing, ...toAppend];
}

export function mergeObjectField(existing, incoming) {
  const result = { ...(existing || {}) };
  for (const [k, v] of Object.entries(incoming || {})) {
    if (result[k] === null || result[k] === undefined || result[k] === '') {
      result[k] = v;
    }
  }
  return result;
}

export function mergeClientData(client = {}, importData = {}, overwrite = false) {
  const ep = client.profile || {};
  const np = importData.profile || {};
  const s  = (ex, inc) => overwrite && inc ? inc : mergeScalar(ex, inc);
  const a  = (ex, inc, kf) => overwrite ? (inc || []) : mergeArrayField(ex, inc, kf);
  const o  = (ex, inc) => overwrite ? (inc || {}) : mergeObjectField(ex, inc);

  return {
    ...client,
    name:        s(client.name,        importData.name),
    email:       s(client.email,       importData.email),
    phone:       s(client.phone,       importData.phone),
    nationality: s(client.nationality, importData.nationality),
    type:        s(client.type,        importData.type),
    profile: {
      ...ep,
      sex:            s(ep.sex,            np.sex),
      dob:            s(ep.dob,            np.dob),
      birthplace:     s(ep.birthplace,     np.birthplace),
      passportNo:     s(ep.passportNo,     np.passportNo),
      passportExpiry: s(ep.passportExpiry, np.passportExpiry),
      auAddress:      s(ep.auAddress,      np.auAddress),
      maritalStatus:  s(ep.maritalStatus,  np.maritalStatus),
      chinaId:        s(ep.chinaId,        np.chinaId),
      nameZh:         s(ep.nameZh,         np.nameZh || importData.nameChinese),
      qq:             s(ep.qq,             np.qq),
      eaFileNo:       s(ep.eaFileNo,       np.eaFileNo),
      consultant:     s(ep.consultant,     np.consultant),
      visaTarget:     s(ep.visaTarget,     np.visaTarget),
      currentStatus:  s(ep.currentStatus,  np.currentStatus),
      visaHistory:       a(ep.visaHistory,       np.visaHistory,       v => v.applicationNo || v.appNo),
      skillsAssessments: a(ep.skillsAssessments, np.skillsAssessments, s => s.appId),
      caseTimeline:      a(ep.caseTimeline,       np.caseTimeline,      t => `${t.date}|${t.event}`),
      keyIssues:         a(ep.keyIssues,          np.keyIssues,         i => i.item),
      addressHistory:    a(ep.addressHistory,     np.addressHistory,    x => `${x.from}|${x.address}`),
      employmentHistory: a(ep.employmentHistory,  np.employmentHistory, x => `${x.from}|${x.company}`),
      documents:         a(ep.documents,          np.documents,         d => d.name),
      nextSteps:         a(ep.nextSteps || [],     np.nextSteps || [],   x => x),
      sponsor:          o(ep.sponsor,          np.sponsor),
      character:        o(ep.character,        np.character),
      marriage:         o(ep.marriage,         np.marriage),
      serviceAgreement: o(ep.serviceAgreement, np.serviceAgreement),
    },
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx react-scripts test --watchAll=false --testPathPattern=mergeProfile
```

- [ ] **Step 5: Commit**

```bash
git add src/utils/mergeProfile.js src/utils/mergeProfile.test.js
git commit -m "feat: add profile merge utility with no-clobber scalar and dedup array merge"
```

---

## Task 3: Backend — Rewrite parse-document.js

**Files:**
- Rewrite: `api/parse-document.js`

- [ ] **Step 1: Replace the entire file**

```js
// api/parse-document.js
// Holistic AI document comprehension — replaces fixed-field OCR extraction.
// Accepts: images (jpg/png/gif/webp), PDFs, or pre-extracted text (docx/txt).
//
// Request body: { fileBase64?, mimeType?, fileName, textContent? }
//   - textContent: plain text extracted by mammoth (docx) or FileReader (txt)
//   - fileBase64 + mimeType: for images and PDFs
//
// Response: { extracted: {...}, documentType: string, rawText?: string }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { fileBase64, mimeType, fileName = '', textContent } = req.body || {};
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  if (!fileBase64 && !textContent) return res.status(400).json({ error: 'No file data provided' });

  // Build content blocks based on file type
  let contentBlocks;
  if (textContent) {
    contentBlocks = [{ type: 'text', text: `File: ${fileName}\n\n${textContent}` }];
  } else if (mimeType === 'application/pdf') {
    contentBlocks = [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }];
  } else if (mimeType?.startsWith('image/')) {
    contentBlocks = [{ type: 'image', source: { type: 'base64', media_type: mimeType, data: fileBase64 } }];
  } else {
    return res.status(400).json({ error: `Unsupported file type: ${mimeType}` });
  }

  const extractionPrompt = `You are an Australian immigration document expert. Read this document fully and extract ALL relevant information you can find. Identify the document type automatically.

Return a single JSON object. Include ONLY fields where you found actual values — omit fields with no data. Do not guess.

Possible fields (use only what's present):
{
  "documentType": "passport|visa|coe|bank|police_check|noa|invitation|identity|other",
  "fullName": "", "nameChinese": "", "sex": "", "dob": "YYYY-MM-DD",
  "birthplace": "", "nationality": "", "passportNo": "", "passportExpiry": "YYYY-MM-DD",
  "chinaId": "", "email": "", "phone": "", "auAddress": "", "maritalStatus": "",
  "visaType": "", "visaSubclass": "", "applicationId": "", "trnNumber": "",
  "grantDate": "YYYY-MM-DD", "expiryDate": "YYYY-MM-DD", "conditions": [],
  "visaAuthNo": "", "noOfEntries": "",
  "sponsorName": "", "sponsorDob": "YYYY-MM-DD", "sponsorNationality": "",
  "sponsorPassportNo": "", "sponsorRelationship": "", "sponsorAddress": "",
  "sponsorOccupation": "",
  "institution": "", "courseCode": "", "courseName": "", "coeNumber": "",
  "coeStart": "YYYY-MM-DD", "coeEnd": "YYYY-MM-DD", "tuitionFee": "", "studentId": "",
  "annualIncome": "", "bankBalance": "", "bankBsb": "", "bankAccount": "",
  "companyName": "", "companyAcn": "", "pensionIncome": "",
  "bccNumber": "", "applicationFee": "", "receiptNumber": "",
  "afpNumber": "", "policyNumber": "",
  "occupation": "", "anzscoCode": "", "assessingBody": "", "assessmentOutcome": "",
  "timeline": [{"date": "YYYY-MM-DD", "event": ""}]
}

Return only the JSON object, no markdown, no explanation.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [...contentBlocks, { type: 'text', text: extractionPrompt }],
        }],
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'AI error' });

    const rawText = data.content?.[0]?.text || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Could not parse AI response', rawText: rawText.slice(0,300) });

    try {
      const extracted = JSON.parse(jsonMatch[0]);
      return res.json({
        extracted,
        documentType: extracted.documentType || 'unknown',
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
      });
    } catch {
      return res.status(500).json({ error: 'Invalid JSON from AI', rawText: rawText.slice(0,300) });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
```

- [ ] **Step 2: Verify the file was saved correctly**

```bash
head -5 /Users/liang/Downloads/nexus-crm/api/parse-document.js
# Expected: // api/parse-document.js
# Expected: // Holistic AI document comprehension
```

- [ ] **Step 3: Commit**

```bash
git add api/parse-document.js
git commit -m "feat: rewrite parse-document.js with holistic AI comprehension (removes fixed-field OCR)"
```

---

## Task 4: Backend — Add User Email to Gmail OAuth Fragment

**Files:**
- Modify: `api/gmail-auth.js` (lines 36–65 — the callback handler)

- [ ] **Step 1: Add userinfo fetch after token exchange**

Find the block that builds the redirect fragment (around line 57) and replace it:

```js
// After: const tokens = await tokenRes.json();
// After: if (tokens.error) { ... }

// Fetch user email (best effort — not critical)
let userEmail = '';
try {
  const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (infoRes.ok) {
    const info = await infoRes.json();
    userEmail = info.email || '';
  }
} catch { /* non-critical */ }

const fragment = new URLSearchParams({
  gmail_access_token:  tokens.access_token,
  gmail_refresh_token: tokens.refresh_token || '',
  gmail_expires_in:    tokens.expires_in || 3600,
  gmail_user_email:    userEmail,
});
return res.redirect(`/#${fragment}`);
```

- [ ] **Step 2: Verify only the fragment block changed**

```bash
git diff api/gmail-auth.js
```

- [ ] **Step 3: Commit**

```bash
git add api/gmail-auth.js
git commit -m "feat: add user email to gmail oauth redirect fragment"
```

---

## Task 5: App.js — Post-OAuth Hash Reader + Pending Client Restore

**Files:**
- Modify: `src/App.js`

The OAuth redirect returns the user to `/#gmail_access_token=...` at the app root, which is not inside any client modal. We need to:
1. Read the hash at the root level and write the Gmail session
2. If `ozsky_pending_client_id` is set, open that client modal with the AI tab

- [ ] **Step 1: Add import for gmailSession utilities**

At the top of `src/App.js`, after the existing imports, add:

```js
import { writeSession as writeGmailSession } from './utils/gmailSession';
```

- [ ] **Step 2: Add post-OAuth hash handler in the root App component**

Find the root App component (around line 5475 where `const [authed, setAuthed]` is). Add a new state and useEffect:

```js
// Near the top of the root App component, with other useState calls:
const [pendingClientId, setPendingClientId] = useState(null);

// New useEffect — runs once on mount to handle post-OAuth redirect:
useEffect(() => {
  if (!window.location.hash) return;
  const p = new URLSearchParams(window.location.hash.slice(1));
  const token = p.get('gmail_access_token');
  if (!token) return;
  writeGmailSession(
    token,
    p.get('gmail_refresh_token') || '',
    parseInt(p.get('gmail_expires_in') || '3600', 10),
    p.get('gmail_user_email') || '',
  );
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  const pendingId = sessionStorage.getItem('ozsky_pending_client_id');
  if (pendingId) {
    sessionStorage.removeItem('ozsky_pending_client_id');
    setPendingClientId(pendingId);
  }
}, []);
```

- [ ] **Step 3: Pass pendingClientId down to the Clients page**

Find where the `Clients` component is rendered (search for `<Clients` in App.js). Add the prop:

```jsx
<Clients
  clients={clients}
  jobs={jobs}
  setClients={setClients}
  setJobs={setJobs}      {/* ← keep this — do NOT remove */}
  team={team}
  pendingClientId={pendingClientId}
  onPendingClientHandled={() => setPendingClientId(null)}
/>
```

- [ ] **Step 4: Handle pendingClientId in the Clients component**

Find the `function Clients({` declaration (around line 2927) and add the new props + a useEffect:

```js
// Add to destructured props:
function Clients({ clients, jobs, setClients, setJobs, team, pendingClientId, onPendingClientHandled }) {
```

```js
// Add useEffect inside Clients, after existing state declarations:
useEffect(() => {
  if (!pendingClientId) return;
  const target = clients.find(c => String(c.id) === pendingClientId); // String() because sessionStorage always returns strings
  if (target) {
    setViewClient(target);
    // viewClient modal will open at its default tab; SmartAI reads Gmail session automatically
  }
  onPendingClientHandled?.();
}, [pendingClientId]); // eslint-disable-line
```

- [ ] **Step 5: Verify App still renders**

```bash
cd /Users/liang/Downloads/nexus-crm && npm start
# Open http://localhost:3000 — app should load, no console errors
```

- [ ] **Step 6: Commit**

```bash
git add src/App.js
git commit -m "feat: handle post-oauth gmail redirect and restore client modal"
```

---

## Task 6: App.js — Update applyImport and onImportClient to Use mergeClientData

**Files:**
- Modify: `src/App.js`

Both the Import Doc tab's `applyImport` function and the AI Assistant tab's `onImportClient` handler currently have separate merge logic. Replace both with the shared `mergeClientData` utility.

- [ ] **Step 1: Add mergeClientData import to App.js**

Add to the imports at the top of App.js:

```js
import { mergeClientData } from './utils/mergeProfile';
```

- [ ] **Step 2: Replace the applyImport function body**

Find `const applyImport = async () => {` (around line 1804). Replace the function body's merge logic with:

```js
const applyImport = async () => {
  if (!importPreview) return;
  const merged = mergeClientData(client, importPreview, false);
  await onSaveProfile(merged);
  setImportPreview(null);
  setApplyMsg('✅ Client record updated!');
  setTimeout(() => setApplyMsg(''), 3000);
  // Note: do NOT add setTab() here — not in original and not in spec
};
```

> Note: `mergeClientData` handles all array and object merge logic, replacing the manual `keep()` helper. Verify that `onSaveProfile` and `setImportPreview` and `setTab` are all in scope here — they should be based on the existing function context.

- [ ] **Step 3: Replace the onImportClient handler in the AI tab**

Find the `onImportClient={(data) => {` handler (around line 2866). Replace its body:

```js
onImportClient={(data) => {
  const merged = mergeClientData(client, data, false);
  onSaveProfile(merged);
}}
```

- [ ] **Step 4: Run existing test suite to check for regressions**

```bash
npx react-scripts test --watchAll=false
```

- [ ] **Step 5: Commit**

```bash
git add src/App.js
git commit -m "refactor: use mergeClientData utility in applyImport and onImportClient handlers"
```

---

## Task 7: SmartAI.jsx — Gmail Section

**Files:**
- Rewrite: `src/SmartAI.jsx` (begin full rewrite — this task covers the Gmail section)

Start the file from scratch. Add the boilerplate, constants, and `GmailSection` component only.

- [ ] **Step 1: Create new SmartAI.jsx with Gmail section**

Replace the entire file content with:

```jsx
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
```

- [ ] **Step 2: Verify the app still runs**

```bash
npm start
# Open client modal → AI tab → Gmail section should show Connect button or connected state
```

- [ ] **Step 3: Commit**

```bash
git add src/SmartAI.jsx
git commit -m "feat: SmartAI rewrite — gmail section with session-storage token and timeline notes"
```

---

## Task 8: SmartAI.jsx — Document Section

**Files:**
- Modify: `src/SmartAI.jsx` (add `DocumentSection` component and wire into root)

- [ ] **Step 1: Add DocumentSection component before the root SmartAI export**

Insert this component before `export default function SmartAI`:

```jsx
/* ════════════════════════════════════════════════════════════════════════════
   Document Section
════════════════════════════════════════════════════════════════════════════ */
function DocumentSection({ selectedClient, sessionDocs, setSessionDocs, onImportClient }) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null); // { imageUrl? } for display only
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setPreview(null);

    // Image preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => setPreview({ imageUrl: ev.target.result });
      reader.readAsDataURL(file);
    }

    setLoading(true);
    try {
      let body;

      if (file.name.toLowerCase().endsWith('.docx')) {
        // Extract text via mammoth (browser-side DOCX parsing)
        const arrayBuffer = await file.arrayBuffer();
        const { value: textContent } = await mammoth.extractRawText({ arrayBuffer });
        if (!textContent?.trim()) throw new Error('DOCX 文本提取失败（文件可能受密码保护或已损坏）');
        body = { fileName: file.name, textContent, mimeType: 'text/plain' };

      } else if (file.name.toLowerCase().endsWith('.txt')) {
        const textContent = await file.text();
        body = { fileName: file.name, textContent, mimeType: 'text/plain' };

      } else {
        // Image or PDF: send as base64
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
          {/* Upload zone */}
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

          {/* Processed docs list */}
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
```

- [ ] **Step 2: Add sessionDocs state and wire DocumentSection into the root SmartAI**

Update the root `SmartAI` export:

```jsx
export default function SmartAI({ selectedClient, selectedCase, onImportClient, onImportCase, onAddNote }) {
  const [gmail, setGmail] = useState(readSession);
  const [emails, setEmails] = useState([]);
  const [sessionDocs, setSessionDocs] = useState([]);  // ← add this

  // NOTE: No hash-reading useEffect here — App.js (Task 5) owns the OAuth callback.

  const updateGmail = useCallback((session) => {
    if (!session) clearSession();
    setGmail(session);
  }, []);

  return (
    <div style={{ fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif" }}>
      {/* Header */}
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
        <DocumentSection
          selectedClient={selectedClient}
          sessionDocs={sessionDocs} setSessionDocs={setSessionDocs}
          onImportClient={onImportClient}
        />
        {/* Snapshot section coming in Task 9 */}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Test document upload manually**

```bash
npm start
# Open client modal → AI tab → try uploading a passport image
# Expected: loading spinner, then doc card showing name/passport number
# Try uploading a .txt snapshot file — should extract all fields
```

- [ ] **Step 4: Commit**

```bash
git add src/SmartAI.jsx
git commit -m "feat: SmartAI — document section with holistic AI extraction (images/pdf/docx/txt)"
```

---

## Task 9: SmartAI.jsx — Snapshot Section + Apply to Profile

**Files:**
- Modify: `src/SmartAI.jsx` (add `SnapshotSection` + `ApplyPreviewModal`, complete the root component)

- [ ] **Step 1: Add snapshot prompt builder function**

Add before `SnapshotSection`:

```js
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
```

- [ ] **Step 2: Add SnapshotSection component**

```jsx
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
                return [`[邮件${i+1}] ${e.date?.slice(0,16)} | ${e.subject}`,
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
      {/* Generate button */}
      <button onClick={generate} disabled={loading || !selectedClient}
        style={{ ...btnStyle(C.blue, loading || !selectedClient), padding: '11px 20px', fontSize: 14 }}>
        {loading ? `⏳ ${step}` : '✨ 生成客户快照'}
      </button>

      {error && <div style={errorStyle}>{error}</div>}

      {/* Snapshot output */}
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

          {/* Apply preview */}
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
```

- [ ] **Step 3: Wire SnapshotSection into root SmartAI + add sessionIsValid import**

Update the root SmartAI component to include `SnapshotSection` and add `sessionIsValid` to the import from `./utils/gmailSession`:

```jsx
// Update import at top:
import { readSession, writeSession, clearSession, sessionIsValid, getValidToken } from './utils/gmailSession';

// Update root export to include snapshot section and forward overwrite to onImportClient:
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
```

- [ ] **Step 4: Update App.js onImportClient to accept overwrite param**

Find the `onImportClient` handler in App.js (the one updated in Task 6) and update it:

```js
onImportClient={(data, overwrite = false) => {
  const merged = mergeClientData(client, data, overwrite);
  onSaveProfile(merged);
}}
// Keep the existing onImportCase prop unchanged — the new SmartAI accepts it
// but currently passes it through unused. It remains available for future use.
```

- [ ] **Step 5: Manual end-to-end test**

```bash
npm start
# 1. Open a client with existing profile data
# 2. Go to AI tab → Generate Snapshot → should see 7-section bilingual output
# 3. Click "应用到档案" → should see preview grid with extracted fields
# 4. Confirm → profile fields should update
# 5. Re-generate → existing fields should NOT be overwritten (unless toggle checked)
```

- [ ] **Step 6: Commit**

```bash
git add src/SmartAI.jsx src/App.js
git commit -m "feat: SmartAI — snapshot section with 7-section format and apply-to-profile"
```

---

## Task 10: Write Manual Test Plan

**Files:**
- Create: `docs/test-plan/NEXUS-CRM-Test-Plan.md`

- [ ] **Step 1: Create test-plan directory and write the document**

```bash
mkdir -p /Users/liang/Downloads/nexus-crm/docs/test-plan
```

Write `docs/test-plan/NEXUS-CRM-Test-Plan.md` with the full test plan. The file must contain at minimum 60 test cases in the format:

```
ID: TC-001
Title: Login with valid staff credentials
Precondition: App running at localhost:3000, not logged in
Steps:
  1. Enter password "staff123" (or whatever the dev password is)
  2. Select "Staff" role
  3. Click Login
Expected Result: Dashboard loads, nav shows Staff options, no Manager-only features visible
Pass/Fail: [ ]
```

Cover all 12 sections from the spec: Auth, Dashboard, Clients, Cases, Notes, Import Doc, AI Assistant (Gmail/Docs/Snapshot/Apply), WeChat, Leads, Invoices/Calendar/Reports, Language toggle, Contract generation.

For the AI Assistant section, ensure these specific cases are included:

```
ID: TC-041
Title: Gmail token survives client switch
Precondition: Gmail connected, viewing Client A AI tab
Steps:
  1. Note Gmail shows "已连接"
  2. Close Client A modal
  3. Open Client B modal → go to AI tab
Expected Result: Gmail still shows "已连接" without requiring reconnection
Pass/Fail: [ ]

ID: TC-042
Title: Gmail token does NOT survive page refresh
Precondition: Gmail connected
Steps:
  1. Note Gmail shows "已连接"
  2. Refresh the browser (F5)
  3. Open any client modal → AI tab
Expected Result: Gmail shows "连接 Google 账号" button — token cleared
Pass/Fail: [ ]

ID: TC-051
Title: Apply to Profile — no-clobber on populated field
Precondition: Client has passportNo = "EJ2927083"
Steps:
  1. Generate snapshot for the client
  2. Click "应用到档案"
  3. Confirm Apply (overwrite toggle OFF)
Expected Result: Client's passportNo remains "EJ2927083" — not overwritten
Pass/Fail: [ ]

ID: TC-052
Title: Apply to Profile — overwrites when toggle ON
Precondition: Client has passportNo = "OLD123", snapshot contains passportNo = "NEW456"
Steps:
  1. Generate snapshot
  2. Click "应用到档案"
  3. Toggle ON "覆盖已有字段"
  4. Confirm Apply
Expected Result: Client's passportNo changes to "NEW456"
Pass/Fail: [ ]

ID: TC-053
Title: Apply to Profile — appends to existing visaHistory
Precondition: Client has 1 visaHistory entry (applicationNo = "A1")
Steps:
  1. Generate snapshot containing 2 entries: A1 and A2
  2. Apply to Profile (overwrite OFF)
Expected Result: visaHistory has 2 entries — A1 kept, A2 appended, no duplicate A1
Pass/Fail: [ ]
```

- [ ] **Step 2: Commit**

```bash
git add docs/test-plan/NEXUS-CRM-Test-Plan.md
git commit -m "docs: add comprehensive manual test plan (60+ test cases)"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
npx react-scripts test --watchAll=false
# Expected: all utility tests PASS, no regressions in App.test.js
```

- [ ] **Manual smoke test checklist**
  - [ ] Gmail: connect → search → save per-email note → save timeline note
  - [ ] Gmail: close client modal, open different client → still connected
  - [ ] Gmail: refresh browser → disconnected
  - [ ] Document: upload passport image → fields extracted → Apply button works
  - [ ] Document: upload .docx snapshot → all fields extracted
  - [ ] Document: upload .txt snapshot → all fields extracted
  - [ ] Snapshot: generate with no Gmail/docs → 7-section output appears
  - [ ] Snapshot: generate with Gmail connected → email context included
  - [ ] Snapshot: Apply to Profile → preview grid → confirm → profile updated
  - [ ] Snapshot: Apply to Profile → no-clobber → existing fields preserved
  - [ ] Import Doc tab: still works correctly (regression check)

- [ ] **Final commit**

```bash
git add -A
git status  # verify no unintended files
git commit -m "feat: complete AI assistant unified redesign — session gmail, holistic OCR, 7-section snapshot, apply-to-profile"
```
