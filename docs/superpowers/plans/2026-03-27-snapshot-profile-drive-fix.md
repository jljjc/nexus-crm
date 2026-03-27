# Snapshot Profile Save & Drive Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the misleading Drive "folder not found" error for empty client folders, auto-save AI-generated snapshots to `client.profile`, and display the saved snapshot on the Profile tab.

**Architecture:** Three targeted edits across two files. `SmartAI.jsx` gets the Drive fix (split two-branch condition into three) and a new `onSaveSnapshot` optional prop on `SnapshotSection`. `App.js` gets: (1) `generateSnapshot` saves to profile before downloading; (2) `onSaveSnapshot` passed to `<SmartAI>`; (3) snapshot display block in the profile tab.

**Tech Stack:** React 18, inline JSX styles, Supabase (data stored as JSON — no schema change needed)

---

## File Structure

| File | Change |
|------|--------|
| `src/SmartAI.jsx` | 2 edits: Drive three-branch fix (lines 677–770); `onSaveSnapshot` prop on `SnapshotSection` and `SmartAI` |
| `src/App.js` | 3 edits: `generateSnapshot` saves to profile (lines 1302–1314); `<SmartAI>` gets `onSaveSnapshot` prop (lines 1892–1920); snapshot display in profile tab (after line 1385) |

---

### Task 1: Fix Drive false "not found" for empty client folders

**Files:**
- Modify: `src/SmartAI.jsx:677-771`

**Context:** `SnapshotSection.generate()` calls `/api/drive-sync`. Currently, the condition at line 677 is:
```js
if (driveData.folderFound && driveData.processed?.length) {
  // ... process files ...
  setDriveStatus({ found: true, ... });
} else {
  setDriveStatus({ found: false, message: driveData.message });
}
```
When `folderFound` is `true` but `processed` is empty (new client, empty folder), this falls into `else` with `driveData.message = undefined`, showing the misleading fallback "ozsky-clients 文件夹中未找到该客户文件夹".

The fix: three explicit branches.

- [ ] **Step 1: Read the current Drive condition in `src/SmartAI.jsx`**

Read lines 675–780 to confirm the exact code. The target is the `if (r.ok)` block starting at line 675.

- [ ] **Step 2: Replace the two-branch condition with three branches**

Find this block (lines 677–771):
```js
            if (driveData.folderFound && driveData.processed?.length) {
              const textParts = [];
              ...
              setDriveStatus({ found: true, folderName: driveData.folderName, fileCount: driveData.totalFiles, readCount: textParts.length + pdfBlocks.length, fileDebug });
            } else {
              setDriveStatus({ found: false, message: driveData.message });
            }
```

Replace it with:
```js
            if (!driveData.folderFound) {
              // Case 1: folder genuinely not found
              setDriveStatus({ found: false, message: driveData.message });
            } else if (!driveData.processed?.length) {
              // Case 2: folder found but empty or all files skipped
              setDriveStatus({ found: true, folderName: driveData.folderName, fileCount: driveData.totalFiles || 0, readCount: 0, fileDebug: [] });
            } else {
              // Case 3: folder found with readable files — existing path unchanged
              const textParts = [];
              ...
              setDriveStatus({ found: true, folderName: driveData.folderName, fileCount: driveData.totalFiles, readCount: textParts.length + pdfBlocks.length, fileDebug });
            }
```

**Important:** The inner file-processing loop (the entire `const textParts = []; const binaryNames = []; ...` block) moves into Case 3 unchanged. Do NOT modify any code inside that block.

- [ ] **Step 3: Verify build**

```bash
cd /Users/liang/Downloads/nexus-crm
npm run build 2>&1 | grep -E "Compiled|error|Error" | head -5
```

Expected: `Compiled successfully.`

- [ ] **Step 4: Commit**

```bash
git add src/SmartAI.jsx
git commit -m "fix: show correct Drive status when client folder exists but is empty"
```

---

### Task 2: Add `onSaveSnapshot` prop to SmartAI

**Files:**
- Modify: `src/SmartAI.jsx:646-649` (SnapshotSection props)
- Modify: `src/SmartAI.jsx:852` (call site after setSnapshot)
- Modify: `src/SmartAI.jsx:1029` (SmartAI export props)
- Modify: `src/SmartAI.jsx:1086-1092` (SnapshotSection usage)

**Context:** `SnapshotSection` is defined at line 646. The exported `SmartAI` component (line 1029) renders `<SnapshotSection>` at line 1086. We need to thread an optional `onSaveSnapshot(text)` prop from `SmartAI` → `SnapshotSection` → called after `setSnapshot`.

- [ ] **Step 1: Add `onSaveSnapshot` to `SnapshotSection` props destructuring**

Current (line 646–649):
```js
function SnapshotSection({
  selectedClient, selectedCase, gmail, emails, sessionDocs,
  snapshot, setSnapshot, onAddNote, onImportClient,
}) {
```

Replace with:
```js
function SnapshotSection({
  selectedClient, selectedCase, gmail, emails, sessionDocs,
  snapshot, setSnapshot, onAddNote, onImportClient, onSaveSnapshot,
}) {
```

- [ ] **Step 2: Call `onSaveSnapshot` after `setSnapshot` on line 852**

Current (line 852):
```js
      setSnapshot(data.content?.[0]?.text || '');
```

Replace with:
```js
      const snapshotResult = data.content?.[0]?.text || '';
      setSnapshot(snapshotResult);
      onSaveSnapshot?.(snapshotResult);
```

Note: `onSaveSnapshot?.()` uses optional chaining — safe when prop is absent.

- [ ] **Step 3: Add `onSaveSnapshot` to `SmartAI` export props**

Current (line 1029):
```js
export default function SmartAI({ selectedClient, selectedCase, onImportClient, onImportCase, onAddNote }) {
```

Replace with:
```js
export default function SmartAI({ selectedClient, selectedCase, onImportClient, onImportCase, onAddNote, onSaveSnapshot }) {
```

- [ ] **Step 4: Pass `onSaveSnapshot` to `<SnapshotSection>`**

Current (lines 1086–1092):
```jsx
            <SnapshotSection
              selectedClient={selectedClient} selectedCase={selectedCase}
              gmail={gmail} emails={emails} sessionDocs={sessionDocs}
              snapshot={snapshot} setSnapshot={setSnapshot}
              onAddNote={onAddNote}
              onImportClient={handleImportClient}
            />
```

Replace with:
```jsx
            <SnapshotSection
              selectedClient={selectedClient} selectedCase={selectedCase}
              gmail={gmail} emails={emails} sessionDocs={sessionDocs}
              snapshot={snapshot} setSnapshot={setSnapshot}
              onAddNote={onAddNote}
              onImportClient={handleImportClient}
              onSaveSnapshot={onSaveSnapshot}
            />
```

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | grep -E "Compiled|error|Error" | head -5
```

Expected: `Compiled successfully.`

- [ ] **Step 6: Commit**

```bash
git add src/SmartAI.jsx
git commit -m "feat: add onSaveSnapshot prop to SmartAI/SnapshotSection"
```

---

### Task 3: Save snapshot to profile from `generateSnapshot` (App.js)

**Files:**
- Modify: `src/App.js:1302-1314`

**Context:** `generateSnapshot` in `ClientDetailModal` (line 1186) generates `snapshotText` and downloads it as `.txt`. We need to also save it to `client.profile.snapshot` and `client.profile.snapshotDate` via `onSaveProfile` before downloading.

`p` is already defined as `const p = client.profile || {}` earlier in `ClientDetailModal`. `onSaveProfile` is a prop of `ClientDetailModal`.

- [ ] **Step 1: Read lines 1300–1320 of `src/App.js` to confirm exact current code**

Confirm the block looks like:
```js
      const snapshotText = (d.content || []).map(c => c?.text || '').join('').trim();
      if (!snapshotText) throw new Error('AI 返回内容为空');

      // Download as .txt
      const safeName = ...
```

- [ ] **Step 2: Insert profile save between validation and download**

Find:
```js
      const snapshotText = (d.content || []).map(c => c?.text || '').join('').trim();
      if (!snapshotText) throw new Error('AI 返回内容为空');

      // Download as .txt
      const safeName = (client.name || 'client').replace(/[^a-zA-Z0-9\u4e00-\u9fa5_\- ]/g, '').trim();
      const dateStr  = new Date().toISOString().slice(0, 10);
```

Replace with:
```js
      const snapshotText = (d.content || []).map(c => c?.text || '').join('').trim();
      if (!snapshotText) throw new Error('AI 返回内容为空');

      // Save snapshot to client profile
      const dateStr = new Date().toISOString().slice(0, 10);
      await onSaveProfile({ ...client, profile: { ...(client.profile || {}), snapshot: snapshotText, snapshotDate: dateStr } });

      // Download as .txt
      const safeName = (client.name || 'client').replace(/[^a-zA-Z0-9\u4e00-\u9fa5_\- ]/g, '').trim();
```

Note: `dateStr` is moved up (was `const dateStr = new Date().toISOString().slice(0, 10)` inside the download block — now shared). Remove the duplicate declaration from the download block.

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | grep -E "Compiled|error|Error" | head -5
```

Expected: `Compiled successfully.`

- [ ] **Step 4: Commit**

```bash
git add src/App.js
git commit -m "feat: auto-save snapshot to client profile from generateSnapshot"
```

---

### Task 4: Pass `onSaveSnapshot` from App.js to SmartAI

**Files:**
- Modify: `src/App.js:1892-1920`

**Context:** The `<SmartAI>` element is rendered inside the `{tab === 'ai' && (...)}` block at line 1892 of `ClientDetailModal`. We need to add the `onSaveSnapshot` prop so it saves to `client.profile` when the SmartAI snapshot button is used.

`p` (`client.profile || {}`) and `onSaveProfile` are both in scope in `ClientDetailModal`.

- [ ] **Step 1: Read lines 1892–1920 of `src/App.js` to confirm current `<SmartAI>` element**

Confirm it ends with `onAddNote={...}` followed by `/>`.

- [ ] **Step 2: Add `onSaveSnapshot` prop to `<SmartAI>`**

Find the closing of the SmartAI element:
```jsx
            onAddNote={(text) => {
              onSaveProfile({ ...client, notes: [makeNote(text), ...normalizeNotes(client.notes)] });
            }}
          />
```

Replace with:
```jsx
            onAddNote={(text) => {
              onSaveProfile({ ...client, notes: [makeNote(text), ...normalizeNotes(client.notes)] });
            }}
            onSaveSnapshot={(text) => {
              const date = new Date().toISOString().slice(0, 10);
              onSaveProfile({ ...client, profile: { ...(client.profile || {}), snapshot: text, snapshotDate: date } });
            }}
          />
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | grep -E "Compiled|error|Error" | head -5
```

Expected: `Compiled successfully.`

- [ ] **Step 4: Commit**

```bash
git add src/App.js
git commit -m "feat: pass onSaveSnapshot from App.js to SmartAI"
```

---

### Task 5: Display saved snapshot on Profile tab

**Files:**
- Modify: `src/App.js:1385-1387`

**Context:** The profile tab block in `ClientDetailModal` ends at line 1387 (`</div>` closes the `paddingRight:2` container, `)}` closes the `{tab === 'profile' && ...}` conditional). The 6-field grid closes at line 1385. We add the snapshot display between the grid and the closing `</div>`.

`p = client.profile || {}` is already defined. The snapshot text is at `p.snapshot`, the date at `p.snapshotDate`.

- [ ] **Step 1: Read lines 1377–1390 of `src/App.js` to confirm current profile tab ending**

Confirm the structure:
```jsx
          {/* ── 6-field summary grid ── */}
          <div style={{ display:'grid', ... }}>
            ...6 Field components...
          </div>
        </div>    ← closes paddingRight:2 container
      )}          ← closes {tab === 'profile' && ...}
```

- [ ] **Step 2: Insert snapshot display between the grid and the closing `</div>`**

Find:
```jsx
            <Field label={t('Email')||'Email'}              value={client.email} />
          </div>
        </div>
      )}
```

Replace with:
```jsx
            <Field label={t('Email')||'Email'}              value={client.email} />
          </div>

          {/* ── Saved snapshot ── */}
          {p.snapshot && (
            <div style={{ marginTop:20, borderTop:'1.5px solid #e2e8f0', paddingTop:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:700, color:'#6366f1', textTransform:'uppercase', letterSpacing:'0.07em' }}>
                  客户快照
                </span>
                {p.snapshotDate && (
                  <span style={{ fontSize:11, color:'#9ca3af' }}>更新于 {p.snapshotDate}</span>
                )}
              </div>
              <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:12,
                fontSize:12, color:'#374151', lineHeight:1.75, whiteSpace:'pre-wrap',
                maxHeight:400, overflowY:'auto',
                fontFamily:"'JetBrains Mono','Courier New',monospace" }}>
                {p.snapshot}
              </div>
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | grep -E "Compiled|error|Error" | head -5
```

Expected: `Compiled successfully.`

- [ ] **Step 4: Commit**

```bash
git add src/App.js
git commit -m "feat: display saved snapshot on profile tab"
```

---

### Task 6: Push

- [ ] **Step 1: Final build check**

```bash
npm run build 2>&1 | grep -E "Compiled|error|Error" | head -5
```

Expected: `Compiled successfully.`

- [ ] **Step 2: Push**

```bash
git push
```
