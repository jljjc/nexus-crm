# CRM Simplification — Design Spec

**Date:** 2026-03-27
**Project:** Nexus CRM (Ozsky Migration)

---

## Goal

Simplify the client detail modal so consultants can focus on case management, client snapshot, and notes. Remove unused tabs, strip the client profile form to 6 essential fields, and merge the Email and AI tabs into one.

---

## Scope

### In scope

| Area | Change |
|------|--------|
| Client data model | Add `sex` field (string: "Male" / "Female" / "Other") |
| Profile tab | Replace full form with 6-field card: name, sex, dob, nationality, mobile, email |
| WeChat tab | Remove entirely |
| Import Doc tab | Remove entirely |
| Email tab | Merge into AI 助手 tab; rename combined tab "🤖 AI & Email" |

### Out of scope

- All 8 main pages (Dashboard, Clients, Cases, Calendar, Team, Leads, Invoices, Reports)
- Client list — `type` and `status` fields remain for list filtering
- Cases tab inside ClientDetailModal — unchanged
- Notes tab inside ClientDetailModal — unchanged
- Case detail modal — unchanged
- SmartAI snapshot generation logic — unchanged
- Database — existing client data is preserved; hidden fields are not deleted

---

## Architecture

All changes are in `src/App.js` only. `SmartAI.jsx` is not modified.

`ClientDetailModal` currently has 7 tabs rendered via a `tab` state string. The changes are:
1. Remove the `'wechat'` and `'importdoc'` tab buttons and their render blocks
2. Replace the `'profile'` tab render block with a minimal 6-field form
3. Rename the `'ai'` tab to `'ai'` (internal state unchanged) but change its label to "🤖 AI & Email" and move the Email tab's JSX content into it, above the existing SmartAI content
4. Remove the `'email'` tab button and its render block

---

## Component: ClientDetailModal — Profile Tab

### Fields shown

| Field | Input type | Data key | Notes |
|-------|-----------|----------|-------|
| Full Name | text | `client.name` | Top-level field (already exists) |
| Sex | select | `client.sex` | **New field** — options: Male, Female, Other |
| Date of Birth | date | `client.profile.dob` | Already exists in profile object |
| Nationality | text | `client.nationality` | Top-level field (already exists) |
| Mobile | text | `client.phone` | Top-level field, label changed to "Mobile" |
| Email | text (or email) | `client.email` | Top-level field (already exists) |

### Save behaviour

On save, merge all 6 fields into the existing client object (spread existing, overwrite these 6). Call `onSaveProfile(updatedClient)`. This is identical to the current save pattern — no new API calls needed.

The hidden fields (`passportNo`, `passportExpiry`, `auAddress`, `visaHistory`, `sponsor`, `skillsAssessments`, `employmentHistory`, `addressHistory`, `keyIssues`, `nextSteps`, `caseTimeline`, `documents`, `chinaId`, `eaFileNo`, `nameZh`, `maritalStatus`, `visaTarget`, `consultant`, `totalFee`, `contractDate`) remain untouched on save because the spread preserves them.

---

## Component: ClientDetailModal — Tab Structure

### Before (7 tabs)

`profile` | `cases` | `notes` | `wechat` | `email` | `importdoc` | `ai`

### After (4 tabs)

`profile` | `cases` | `notes` | `ai`

Tab label for `ai`: **"🤖 AI & Email"**

---

## Component: ClientDetailModal — AI & Email Tab

The merged tab renders two sections in order:

1. **Email section** (currently in the `email` tab) — Gmail inbox fetch, email list, save-as-note button. No logic changes.
2. **SmartAI section** (currently in the `ai` tab) — snapshot generation. No logic changes.

A thin divider (`<hr>` or `borderTop`) separates the two sections for visual clarity.

---

## Client List — Unchanged

The `Clients` page list view continues to show `name`, `type`, `status`, `email`, `phone`. Filter by `type` and `status` remains. These are operational fields distinct from the profile form.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/App.js` | Modify | Remove WeChat + Import Doc tabs; simplify Profile tab to 6 fields; merge Email content into AI tab; rename AI tab label; add `sex` to save/load |

---

## Out of Scope

- `src/SmartAI.jsx` — no changes
- `api/` — no changes
- Supabase schema — `sex` is stored inside the JSON `data` column (same as all other client fields); no migration needed
