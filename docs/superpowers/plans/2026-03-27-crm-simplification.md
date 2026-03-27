# CRM Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the client detail modal to 4 tabs (Profile, Cases, Notes, AI & Email), strip the profile view and edit form to 6 essential fields, and remove the WeChat and Import Doc tabs.

**Architecture:** All changes are in `src/App.js` only. `ClientDetailModal` has its tabs array, profile view block, and three tab render blocks modified. The `Clients` edit modal form is also simplified. No new files, no API changes, no database migration needed.

**Tech Stack:** React 18, inline JSX styles, Supabase (data already stored as JSON — no schema change needed)

---

## File Structure

| File | Change |
|------|--------|
| `src/App.js` | 4 targeted edits: tabs array, profile tab view, AI tab merge, edit form simplification |

---

### Task 1: Simplify the tabs array

**Files:**
- Modify: `src/App.js:1876-1884`

The `ClientDetailModal` `tabs` array at line 1876 defines which tabs appear. Remove `wechat`, `email`, `import` entries. Rename `ai` label.

- [ ] **Step 1: Open `src/App.js` and find the `tabs` array at ~line 1876**

Current code (lines 1876–1884):
```js
const tabs = [
  { id:'profile',  label:'👤 Profile' },
  { id:'jobs',     label:`📋 Cases (${clientJobs.length})` },
  { id:'notes',    label:`📝 ${t('Notes')||'Notes'} (${regularNoteCount})` },
  { id:'wechat',   label:`💬 ${t('WeChat')||'聊天导入'}` },
  { id:'email',    label:`📧 Email${gmailNoteCount ? ` (${gmailNoteCount})` : ''}` },
  { id:'import',   label:`📥 ${t('Import Doc')||'Import Doc'}` },
  { id:'ai',       label:`🤖 AI 助手` },
];
```

- [ ] **Step 2: Replace with 4-tab array**

```js
const tabs = [
  { id:'profile',  label:'👤 Profile' },
  { id:'jobs',     label:`📋 Cases (${clientJobs.length})` },
  { id:'notes',    label:`📝 ${t('Notes')||'Notes'} (${regularNoteCount})` },
  { id:'ai',       label:`🤖 AI & Email${gmailNoteCount ? ` (${gmailNoteCount})` : ''}` },
];
```

Note: The gmail note count badge moves to the AI & Email tab since that is now where email content lives.

- [ ] **Step 3: Verify the app builds without errors**

```bash
cd /Users/liang/Downloads/nexus-crm
npm run build 2>&1 | tail -20
```

Expected: no errors (unused tab IDs in `useState` default are fine — the default is `'profile'` which still exists).

- [ ] **Step 4: Commit**

```bash
git add src/App.js
git commit -m "refactor: reduce ClientDetailModal to 4 tabs (profile/cases/notes/ai)"
```

---

### Task 2: Simplify the Profile tab view

**Files:**
- Modify: `src/App.js:1923-2084`

The Profile tab (`{tab === 'profile' && (...)}` block, lines 1896–2086) has a snapshot header card (lines 1900–1921) that we **keep**, followed by multiple `<S>` section components (lines 1923–2084) that we **replace** with a single 6-field grid.

- [ ] **Step 1: Find the boundary**

Line 1921 closes the snapshot header card `</div>` (the dark gradient banner). Line 1922 is a blank line. Line 1923 starts `{/* ── 一、PERSONAL INFORMATION */}`.

The content to replace ends at the `)}` on line 2084 — this is the closing of the outermost conditional section block, immediately before `</div>` on line 2085 (which closes the outer profile tab `<div style={{ paddingRight:2 }}>`) and `)}` on line 2086 (which closes `{tab === 'profile' && ...}`). Do **not** delete line 2085 or 2086.

To confirm you have the right end: the last thing before line 2085 should be a `)}` with no indented content after it. If unsure, search for the comment `{/* ── JOBS TAB */}` at line 2088 — everything between line 1923 and line 2084 (inclusive) is what gets replaced.

- [ ] **Step 2: Delete lines 1923–2084 and replace with 6-field grid**

Remove everything from `{/* ── 一、PERSONAL INFORMATION */}` (line 1923) through and including line 2084 (the `)}` before `</div>` on 2085).

Insert this in place of the removed lines (between line 1922 blank line and `</div>` on what was 2085):

```jsx
          {/* ── 6-field summary grid ── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginTop:16 }}>
            <Field label="Full Name"     value={client.name} />
            <Field label="Sex"           value={p.sex} />
            <Field label="Date of Birth" value={p.dob} />
            <Field label="Nationality"   value={client.nationality} />
            <Field label="Mobile"        value={client.phone} />
            <Field label="Email"         value={client.email} />
          </div>
```

Where `p = client.profile || {}` — this is already assigned earlier in `ClientDetailModal` (search for `const p = client.profile` near the top of the component to confirm the variable name).

- [ ] **Step 3: Verify build and manual check**

```bash
npm run build 2>&1 | tail -20
```

Then open the app in the browser, open any client, check the Profile tab shows only the 6 fields below the dark banner. No scrollable wall of form fields.

- [ ] **Step 4: Commit**

```bash
git add src/App.js
git commit -m "refactor: strip profile tab view to 6 essential fields"
```

---

### Task 3: Merge Email tab into AI tab; remove WeChat and Import tab blocks

**Files:**
- Modify: `src/App.js:2419-2940`

Three blocks to remove, one block to modify:

| Block | Lines | Action |
|-------|-------|--------|
| WeChat tab | 2419–2551 | Delete entirely |
| Email tab | 2554–2722 | Move inner content into AI tab, then delete |
| Import tab | 2725–2905 | Delete entirely |
| AI tab | 2908–2940 | Wrap existing SmartAI content; prepend email content above it |

The email tab's inner content (lines 2555–2721, everything inside the outer `<div style={{ maxHeight:'65vh'...}}>`) uses only component-level state variables: `email`, `setEmail`, `emailParsing`, `setEmailParsing`, `emailResult`, `setEmailResult`, `emailSaved`, `setEmailSaved`, `parseEmail` — all defined at component scope in `ClientDetailModal` (lines 1086–1380). Moving the JSX is safe.

- [ ] **Step 1: Copy the email tab inner content to a scratch note**

The content to move is everything between (but not including) the outer scroll wrapper divs:
- Start: line 2556 `{/* ── Gmail saved email notes ── */}`
- End: line 2720 `)}` (last line before `</div>` on 2721 and `)}` on 2722)

- [ ] **Step 2: Replace the AI tab block (lines 2908–2940)**

Current AI tab (lines 2908–2940):
```jsx
      {tab === 'ai' && (
        <div style={{ maxHeight:'70vh', overflowY:'auto', paddingRight:2 }}>
          <SmartAI
            selectedClient={client}
            selectedCase={clientJobs[0] || null}
            onImportClient={(data, overwrite = false) => {
              const merged = mergeClientData(client, data, overwrite);
              onSaveProfile(merged);
            }}
            onImportCase={(data) => {
              ...
            }}
            onAddNote={(text) => {
              onSaveProfile({ ...client, notes: [makeNote(text), ...normalizeNotes(client.notes)] });
            }}
          />
        </div>
      )}
```

Replace with the structure below. **Keep the existing outer `<div style={{ maxHeight:'70vh', overflowY:'auto', paddingRight:2 }}>` scroll container** — the email content and SmartAI both live inside it. (The spec document showed `<>` as a shorthand placeholder; the correct structure keeps the scroll div to avoid layout breakage.)

Final structure of the AI tab:
```jsx
      {tab === 'ai' && (
        <div style={{ maxHeight:'70vh', overflowY:'auto', paddingRight:2 }}>
          {/* ── EMAIL SECTION (moved from email tab — outer scroll div dropped) ── */}
          <div style={{ marginBottom:16, paddingBottom:16, borderBottom:'1.5px solid #e2e8f0' }}>
            {/* PASTE THE EMAIL TAB INNER CONTENT HERE:
                Copy lines 2556–2720 verbatim (everything inside the old email tab's
                <div style={{ maxHeight:'65vh', overflowY:'auto', paddingRight:4 }}>
                but NOT the outer div itself — drop that wrapper to avoid nested scrollbars) */}
          </div>

          {/* ── SMARTAI SECTION (unchanged) ── */}
          <SmartAI
            selectedClient={client}
            selectedCase={clientJobs[0] || null}
            onImportClient={(data, overwrite = false) => {
              const merged = mergeClientData(client, data, overwrite);
              onSaveProfile(merged);
            }}
            onImportCase={(data) => {
              // ... keep existing onImportCase body unchanged
            }}
            onAddNote={(text) => {
              onSaveProfile({ ...client, notes: [makeNote(text), ...normalizeNotes(client.notes)] });
            }}
          />
        </div>
      )}
```

- [ ] **Step 3: Delete the WeChat tab block (lines 2419–2551)**

Delete from `{tab === 'wechat' && (` through its closing `)}` (line 2551).

- [ ] **Step 4: Delete the email tab block (lines 2554–2722)**

Delete from `{tab === 'email' && (` through its closing `)}` (line 2722). The inner content has already been moved into the AI tab.

- [ ] **Step 5: Delete the Import tab block (lines 2725–2905)**

Delete from `{tab === 'import' && (` through its closing `)}` (line 2905).

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors. Check for any reference to `parseEmail`, `emailResult`, `ocName`, `wchat` — those variables are still defined in `ClientDetailModal` state even though their tabs are removed; that is fine (unused state causes no errors in React).

- [ ] **Step 7: Manual check in browser**

Open a client → confirm:
- 4 tabs show: Profile, Cases, Notes, 🤖 AI & Email
- WeChat tab is gone
- Import Doc tab is gone
- AI & Email tab shows the email paste/analyse section at top, SmartAI snapshot section below, separated by a line

- [ ] **Step 8: Commit**

```bash
git add src/App.js
git commit -m "refactor: merge Email into AI tab; remove WeChat and Import Doc tabs"
```

---

### Task 4: Simplify the client edit form

**Files:**
- Modify: `src/App.js:3142-3234`

The `{modal && (...)}` edit form block (~line 3140) currently has:
- Lines 3142–3157: basic fields grid (Name, Email, Phone, Nationality, Type, Status)
- Lines 3158–3174: "Profile Details" section (12 fields including passport, address, consultant, etc.)
- Lines 3177–3188: "Sponsor Details" section (6 fields)
- Lines 3190–3211: "Visa History" table with add/remove rows
- Lines 3213–3234: "Case Timeline" table with add/remove rows
- Lines 3236–3238: Notes panel (keep)
- Lines 3239–3244: Buttons row — 📄 生成合同, Cancel, Save Client (keep)

**Delete lines 3142–3234 entirely** (the four sections above — basic grid + Profile Details + Sponsor Details + Visa History + Case Timeline), then **insert** the two simplified sections below in their place. Lines 3236 onward (Notes panel + buttons) are untouched.

- [ ] **Step 1: Replace the form body (lines 3142–3234)**

```jsx
          {/* ── Personal Info ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <FormField label="Full Name" required>
              <input style={inputStyle} value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="John Smith" />
            </FormField>
            <FormField label="Sex">
              <select style={selectStyle} value={form.profile?.sex||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),sex:e.target.value}}))}>
                <option value="">—</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </FormField>
            <FormField label="Date of Birth">
              <input style={inputStyle} value={form.profile?.dob||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),dob:e.target.value}}))} placeholder="YYYY-MM-DD" />
            </FormField>
            <FormField label="Nationality">
              <input style={inputStyle} value={form.nationality||''} onChange={e=>setForm(f=>({...f,nationality:e.target.value}))} placeholder="e.g. Chinese" />
            </FormField>
            <FormField label="Mobile">
              <input style={inputStyle} value={form.phone||''} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="04xx xxx xxx" />
            </FormField>
            <FormField label="Email">
              <input style={inputStyle} value={form.email||''} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="john@email.com" />
            </FormField>
          </div>
          {/* ── Operational ── */}
          <div style={{ borderTop:'1.5px solid #e2e8f0', marginTop:16, paddingTop:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <FormField label="Client Type">
              <select style={selectStyle} value={form.type||'Student'} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                {CLIENT_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Status">
              <select style={selectStyle} value={form.status||'Active'} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                {CLIENT_STATUSES.map(s=><option key={s}>{s}</option>)}
              </select>
            </FormField>
          </div>
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Manual check in browser**

Go to Clients page → click Edit on any client. Confirm:
- Form shows: Full Name, Sex (dropdown), Date of Birth, Nationality, Mobile, Email in a 2-column grid
- Below a divider: Client Type, Status
- Notes panel still present
- 📄 生成合同, Cancel, Save Client buttons still present
- Sponsor Details, Visa History, Case Timeline sections are gone

Open an existing client with data in those removed fields → edit → save → reopen. Confirm the hidden fields (passport, visa history, etc.) are not wiped — they should still be in the Supabase record.

- [ ] **Step 4: Test new client creation**

Add Client → fill in name + sex + nationality → Save. Open the new client's Profile tab. Confirm name and nationality show correctly. Sex should show as `—` if left blank or the selected value if set.

- [ ] **Step 5: Commit**

```bash
git add src/App.js
git commit -m "refactor: simplify client edit form to 6 personal fields + type/status"
```

---

### Task 5: Push

- [ ] **Step 1: Final build check**

```bash
npm run build 2>&1 | tail -5
```

Expected: compiled successfully.

- [ ] **Step 2: Push**

```bash
git push
```
