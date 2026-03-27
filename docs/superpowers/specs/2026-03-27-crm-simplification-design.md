# CRM Simplification — Design Spec

**Date:** 2026-03-27
**Project:** Nexus CRM (Ozsky Migration)

---

## Goal

Simplify the client profile and detail modal so consultants can focus on case management, client snapshot, and notes. Remove unused tabs, strip the client profile to 6 essential fields in both the view and edit form, and merge the Email and AI tabs into one.

---

## Scope

### In scope

| Area | Change |
|------|--------|
| Client profile view (Profile tab in `ClientDetailModal`) | Replace all field sections below the snapshot header card with a single 2-column 3-row grid of 6 `Field` components |
| Client edit form (`Clients` page modal) | Simplify to 8 editable fields: Name, Sex, DOB, Nationality, Mobile, Email (6 personal) + Type, Status (2 operational). Remove Profile Details, Sponsor Details, Visa History, Case Timeline sections. |
| `sex` field in edit form | Add `sex` select input to edit form. Data stored at `client.profile.sex` (already read in profile view). |
| WeChat tab | Remove from `ClientDetailModal` |
| Import Doc tab | Remove from `ClientDetailModal` |
| Email tab | Remove as separate tab; move its entire JSX block into the AI tab, above SmartAI |
| AI tab label | Change from `"🤖 AI 助手"` to `"🤖 AI & Email"` |

### Out of scope

- All 8 main pages
- Client list — `type` and `status` remain for list filtering
- Cases tab, Notes tab — unchanged
- Case detail modal — unchanged
- SmartAI logic — unchanged
- Database — no migration; all fields preserved via spread on save

---

## Architecture

All changes in `src/App.js` only. `SmartAI.jsx` not modified.

Two components change:
1. **`ClientDetailModal`** — tabs, profile view, AI tab content, removal of 3 tab blocks
2. **`Clients` edit modal** (`{modal && (...)}` block ~line 3140) — simplified edit form

---

## 1. ClientDetailModal — Tab Array

**File:** `src/App.js` ~line 1876, `const tabs = [...]`

**Before:** `profile | jobs | notes | wechat | email | import | ai`

**After:** `profile | jobs | notes | ai`

```js
const tabs = [
  { id:'profile', label:'👤 Profile' },
  { id:'jobs',    label:`📋 Cases (${clientJobs.length})` },
  { id:'notes',   label:`📝 ${t('Notes')||'Notes'} (${regularNoteCount})` },
  { id:'ai',      label:'🤖 AI & Email' },
];
```

Default tab is `'profile'` — `useState('profile')` stays unchanged. No risk of stale tab state since `'email'`, `'wechat'`, `'import'` are only ever set by clicking their (now-removed) tab buttons.

---

## 2. ClientDetailModal — Profile Tab View

**File:** `src/App.js`, block `{tab === 'profile' && (...)}`

**Keep:** the snapshot header card (dark gradient banner with avatar, client name, status badge, "✏️ Edit Profile" button, "📥 生成快照" button). This is the entire `<div style={{ display:'flex', justifyContent:'space-between'...background:'linear-gradient(135deg,#1c1f3a,#2d3563)'... }}>` block.

**Remove entirely:** everything below the snapshot header card — all `<S>` section components (PERSONAL INFORMATION, SERVICE AGREEMENT, VISA HISTORY, SKILLS ASSESSMENT, EMPLOYMENT HISTORY, ADDRESS HISTORY, CASE TIMELINE / CURRENT STATUS, SPONSOR DETAILS, KEY ISSUES / OPTIONS, etc.).

**Replace with** a single `<div>` immediately after the snapshot header card:

```jsx
<div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginTop:16 }}>
  <Field label="Full Name"    value={client.name} />
  <Field label="Sex"          value={p.sex} />
  <Field label="Date of Birth" value={p.dob} />
  <Field label="Nationality"  value={client.nationality} />
  <Field label="Mobile"       value={client.phone} />
  <Field label="Email"        value={client.email} />
</div>
```

Where `p = client.profile || {}` (already defined in the component). Fields with no value render `—` via the existing `Field` component. Grid is `repeat(2, 1fr)`, 3 rows:

| Col 1 | Col 2 |
|-------|-------|
| Full Name | Sex |
| Date of Birth | Nationality |
| Mobile | Email |

---

## 3. ClientDetailModal — AI & Email Tab

**File:** `src/App.js`, block `{tab === 'ai' && (...)}`

Move the email section into the AI tab. State variables `email`, `setEmail`, `emailParsing`, `setEmailParsing`, `emailResult`, `setEmailResult`, `emailSaved`, `setEmailSaved`, and `parseEmail` are all already defined at component level in `ClientDetailModal` (lines 1086–1380) — no state changes needed.

**Exact move:** Take the inner content of the `{tab === 'email' && (...)}` block — **drop the outer scroll wrapper** `<div style={{ maxHeight:'65vh', overflowY:'auto', paddingRight:4 }}>` — and place all inner JSX at the top of `{tab === 'ai' && (...)}` wrapped in a divider section:

```jsx
{tab === 'ai' && (
  <>
    {/* ── EMAIL SECTION (moved from email tab) ── */}
    <div style={{ marginBottom:16, paddingBottom:16, borderBottom:'1.5px solid #e2e8f0' }}>
      {/* inner content of old email tab verbatim — no outer scroll div */}
    </div>

    {/* ── SMARTAI SECTION (unchanged) ── */}
    {/* existing AI tab JSX here */}
  </>
)}
```

The outer scroll div is dropped deliberately — the AI tab already has its own scroll context and nesting two `overflowY:'auto'` containers causes double-scrollbar UX issues.

**Remove entirely:** `{tab === 'email' && (...)}`, `{tab === 'wechat' && (...)}`, `{tab === 'import' && (...)}` blocks.

---

## 4. Clients Edit Modal — Simplified Form

**File:** `src/App.js`, block `{modal && (...)}` ~line 3140

**Keep the modal wrapper and title** (`Add New Client` / `Edit Client – ${form.name}`).

**Replace the form body** with two sections:

### Section 1 — Personal Info (2-column grid)

```jsx
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
```

### Section 2 — Operational (2-column grid, separated by a border-top)

```jsx
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

**Keep unchanged:** the save/cancel/delete buttons at the bottom, the contract generation button if present.

### Hidden fields safety

`openEdit` initialises form as `{ ...c, notes: normalizeNotes(c.notes) }` — this spreads all client fields including `profile`, `profile.sponsor`, `profile.serviceAgreement`, `profile.visaHistory`, etc. into form state. These are never rendered in the simplified form but remain in state. When `save()` calls `sbUpdate('clients', form.id, { data: form })`, the full `form` object (including all hidden fields) is written back to Supabase. No data loss.

For new clients (`modal === 'add'`), `form.profile` starts as `undefined`. The `sex` field setter uses `{ ...(f.profile||{}) }` guard, so a new client with only `sex` set will have `form.profile = { sex: 'Male' }`. This is correct.

---

## Data Model

`sex` is stored at `client.profile.sex` (string). Already present in the read path (`p.sex` in profile view, line 1927). This spec adds the write path (edit form). Default for existing clients: `''` (empty string), rendered as `—` in view, shown as blank `—` option in select.

---

## Files Changed

| File | Action |
|------|--------|
| `src/App.js` | Modify only — 6 targeted edits as described above |

---

## Out of Scope

- `src/SmartAI.jsx` — no changes
- `api/` — no changes
- Supabase schema — no migration needed
