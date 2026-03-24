# Gmail Login + Monday.com UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace password login with Gmail OAuth, add in-app role promotion, and restyle the app with Monday.com's color system.

**Architecture:** Single large React file (`src/App.js`) plus one API route (`api/gmail-auth.js`). Auth flow: Google OAuth → server token exchange → fragment redirect → App fragment useEffect sets auth state. UI changes are CSS-in-JS edits and component-level color token replacements.

**Tech Stack:** React (Create React App), Vercel serverless functions, Supabase REST API, Google OAuth2

---

## Pre-flight: Create Supabase `user_roles` Table

Before any code changes, run this SQL in the Supabase dashboard (SQL editor):

```sql
CREATE TABLE IF NOT EXISTS user_roles (
  email TEXT PRIMARY KEY,
  role  TEXT NOT NULL CHECK (role IN ('manager', 'staff'))
);
```

No code change needed for this step.

---

## Task 1: Add Empty-Email Guard to `api/gmail-auth.js`

**Files:**
- Modify: `api/gmail-auth.js` (lines 56–75)

- [ ] **Step 1: Add empty-email guard after userInfo fetch block**

Find the block ending at line 66:
```js
      } catch { /* non-critical */ }
```

Add this check immediately after it (before building the fragment):
```js
      if (!userEmail) {
        return res.redirect('/?gmail_error=Authentication+failed');
      }
```

The result should look like:
```js
      } catch { /* non-critical */ }

      if (!userEmail) {
        return res.redirect('/?gmail_error=Authentication+failed');
      }

      // Redirect back to app with tokens in URL fragment (never in query string)
      const fragment = new URLSearchParams({
```

- [ ] **Step 2: Commit**

```bash
git add api/gmail-auth.js
git commit -m "fix: redirect with error when userInfo email fetch fails"
```

---

## Task 2: Replace `LoginScreen` Component

**Files:**
- Modify: `src/App.js` — `LoginScreen` function (lines 5313–5388)

- [ ] **Step 1: Replace the entire `LoginScreen` function**

Delete the existing `LoginScreen` function (lines 5313–5388) and replace with:

```jsx
function LoginScreen({ errorMessage }) {
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const e = p.get('gmail_error');
    if (e) {
      // Clean the query string so it doesn't persist on refresh
      window.history.replaceState(null, '', window.location.pathname);
    }
    return e ? decodeURIComponent(e) : null;
  });

  const handleGmailAuth = async () => {
    setLoading(true);
    setLocalError(null);
    try {
      const res = await fetch('/api/gmail-auth?action=url');
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setLoading(false);
      setLocalError('Failed to connect. Please try again.');
    }
  };

  const displayError = errorMessage || localError;

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1f1f3d 0%,#2d2d5e 50%,#1f1f3d 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes loginFade { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .login-card { animation: loginFade 0.4s cubic-bezier(.16,1,.3,1) both; }
        .google-btn:hover:not(:disabled) { border-color: #c0c0c0 !important; box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important; }
      `}</style>
      <div className="login-card" style={{ width:'100%', maxWidth:400, background:'#fff', borderRadius:20, padding:'40px 36px', boxShadow:'0 32px 80px rgba(0,0,0,0.35)', fontFamily:"'Inter',sans-serif" }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <img src={LOGO_B64} alt="Ozsky International" style={{ width:140, height:'auto', borderRadius:8 }} />
        </div>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontSize:22, fontWeight:800, color:'#111827', marginBottom:5 }}>Welcome</div>
          <div style={{ fontSize:13.5, color:'#6b7280' }}>Sign in with your Ozsky Google account</div>
        </div>
        <button
          className="google-btn"
          onClick={handleGmailAuth}
          disabled={loading}
          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'12px 16px', background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:10, cursor: loading ? 'wait' : 'pointer', fontSize:14, fontWeight:600, color:'#374151', transition:'all 0.15s', marginBottom:16, boxSizing:'border-box' }}
        >
          {!loading && (
            <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink:0 }}>
              <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
              <path fill="#34A853" d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 6.4 6.3 14.7z"/>
              <path fill="#FBBC05" d="M24 46c5.9 0 10.9-2 14.5-5.4l-6.7-5.5C29.9 36.9 27.1 38 24 38c-6 0-11.1-4-12.9-9.5l-7 5.4C7.6 41.6 15.2 46 24 46z"/>
              <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.9 2.8-2.8 5.1-5.3 6.6l6.7 5.5C41.4 37.3 45 31.2 45 24c0-1.3-.2-2.7-.5-4z"/>
            </svg>
          )}
          <span>{loading ? 'Redirecting…' : 'Continue with Google'}</span>
        </button>
        {displayError && (
          <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'9px 12px', fontSize:12, color:'#dc2626', display:'flex', alignItems:'flex-start', gap:6, marginBottom:8 }}>
            <span style={{ flexShrink:0 }}>⛔</span> {displayError}
          </div>
        )}
        <div style={{ textAlign:'center', marginTop:20, fontSize:11.5, color:'#d1d5db' }}>
          Ozsky International · Internal CRM
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.js
git commit -m "feat: replace password LoginScreen with Gmail OAuth button"
```

---

## Task 3: Update `App` Component — Auth Logic

**Files:**
- Modify: `src/App.js` — constants block (~line 5309), `App` function state (~line 5425), fragment useEffect (~line 5438), auth gate (~line 5503)

- [ ] **Step 1: Replace password constants with ALLOWED_USERS whitelist and add sbUpsert**

Find and delete these two lines (~line 5309):
```js
const STAFF_PASSWORD   = 'ozsky2024';  // regular staff
const MANAGER_PASSWORD = '731hay';     // managers only — unlocks Reports
```

Replace with:
```js
// ─── ALLOWED USERS & ROLES ────────────────────────────────────────────────────
const ALLOWED_USERS = {
  'l.jiang@ozs.com.au':         'manager',
  'm.mao@ozs.com.au':           'manager',
  'perthcq@ozs.com.au':         'staff',
  'perth_assistant@ozs.com.au': 'staff',
  'admin2.perth@ozs.com.au':    'staff',
  'perthozsky@gmail.com':       'staff',
  'ozskyperth@gmail.com':       'staff',
  'perth@ozs.com.au':           'staff',
};

// Upsert helper for tables with non-id primary keys (e.g. user_roles.email)
const sbUpsert = async (table, data) => {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(data),
  });
  return res.ok ? res.json().catch(() => null) : null;
};
```

- [ ] **Step 2: Add `authError` state to App component**

In the `App` function state block (~line 5425), find:
```js
  const [authed, setAuthed]             = useState(() => sessionStorage.getItem('ozsky_auth') === '1');
  const [isManager, setIsManager]       = useState(() => sessionStorage.getItem('ozsky_role') === 'manager');
```

Add `authError` state after them:
```js
  const [authError, setAuthError]       = useState(null);
```

- [ ] **Step 3: Replace the fragment useEffect (~line 5438)**

Find and replace the entire fragment useEffect:
```js
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

Replace with:
```js
  useEffect(() => {
    if (!window.location.hash) return;
    const p = new URLSearchParams(window.location.hash.slice(1));
    const token = p.get('gmail_access_token');
    if (!token) return;

    // Clear fragment immediately
    window.history.replaceState(null, '', window.location.pathname);

    const email = p.get('gmail_user_email') || '';
    const hardcodedRole = ALLOWED_USERS[email];

    if (!hardcodedRole) {
      setAuthError('Your account is not authorised. Contact your manager.');
      return;
    }

    // Store Gmail tokens so SmartAI works immediately after login
    writeGmailSession(
      token,
      p.get('gmail_refresh_token') || '',
      parseInt(p.get('gmail_expires_in') || '3600', 10),
      email,
    );

    // Resolve role: Supabase override takes priority over hardcoded default
    (async () => {
      let role = hardcodedRole;
      try {
        const rows = await sbFetch('user_roles?select=role&email=eq.' + encodeURIComponent(email));
        role = rows?.[0]?.role || hardcodedRole;
      } catch { /* use hardcoded default */ }

      sessionStorage.setItem('ozsky_auth', '1');
      sessionStorage.setItem('ozsky_role', role);
      sessionStorage.setItem('ozsky_email', email);
      setAuthed(true);
      setIsManager(role === 'manager');
    })();
  }, []);
```

- [ ] **Step 4: Update the auth gate and LoginScreen render (~line 5503)**

Find:
```js
  if (!authed) {
    return <LoginScreen onLogin={(role) => {
      sessionStorage.setItem('ozsky_auth', '1');
      sessionStorage.setItem('ozsky_role', role);
      setAuthed(true);
      setIsManager(role === 'manager');
```

Replace the entire `if (!authed)` block (until its closing `}`) with:
```js
  if (!authed) {
    return <LoginScreen errorMessage={authError} />;
  }
```

- [ ] **Step 5: Remove `pendingClientId` state and all downstream references**

First, grep to confirm all locations:
```bash
grep -n "pendingClientId\|ozsky_pending_client_id" src/App.js src/SmartAI.jsx
```
Expected: App.js lines ~2869, ~2883, ~2884, ~2889, ~5429, ~5450, ~5452, ~5623 and SmartAI.jsx line ~141.

**In `src/App.js`:**

1. Delete `pendingClientId` state (~line 5429):
```js
  const [pendingClientId, setPendingClientId] = useState(null);
```

2. Update Clients render (~line 5623) — remove `pendingClientId` and `onPendingClientHandled` props:
```jsx
// BEFORE:
{view === 'clients'   && <Clients   clients={clients} jobs={jobs} setClients={setClients} setJobs={setJobs} team={team} pendingClientId={pendingClientId} onPendingClientHandled={() => setPendingClientId(null)} />}
// AFTER:
{view === 'clients'   && <Clients   clients={clients} jobs={jobs} setClients={setClients} setJobs={setJobs} team={team} />}
```

3. Clean up `Clients` component function signature (~line 2869) — remove both params:
```js
// BEFORE:
function Clients({ clients, jobs, setClients, setJobs, team, pendingClientId, onPendingClientHandled }) {
// AFTER:
function Clients({ clients, jobs, setClients, setJobs, team }) {
```

4. Delete the `useEffect` in `Clients` that uses `pendingClientId` (~lines 2882–2890):
```js
  useEffect(() => {
    if (!pendingClientId) return;
    const target = clients.find(c => String(c.id) === pendingClientId);
    ...
  }, [pendingClientId]); // eslint-disable-line
```

**In `src/SmartAI.jsx`:**

5. Delete the `handleConnect` function (~lines 139–150):
```js
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
```

6. Remove the "Connect Gmail" button from SmartAI JSX (~line 207):
```jsx
// DELETE this line:
          <button onClick={handleConnect} style={btnStyle(C.blue)}>🔐 连接 Google 账号</button>
```

- [ ] **Step 6: Commit**

```bash
git add src/App.js
git commit -m "feat: Gmail OAuth as primary login — whitelist, role resolution, auth state"
```

---

## Task 4: Add Access Management to `Team` Component

**Files:**
- Modify: `src/App.js` — `Team` function (starts ~line 3979)

- [ ] **Step 1: Add `userRoles` state and load on mount**

Inside the `Team` function, after the existing state declarations (~line 3985), add:

```js
  const [userRoles, setUserRoles] = useState({});
  const currentUserEmail = sessionStorage.getItem('ozsky_email') || '';

  useEffect(() => {
    sbFetch('user_roles?select=email,role')
      .then(rows => {
        if (!rows) return;
        const map = {};
        rows.forEach(r => { map[r.email] = r.role; });
        setUserRoles(map);
      })
      .catch(() => {});
  }, []);

  const toggleRole = async (email) => {
    const current = userRoles[email] || ALLOWED_USERS[email] || 'staff';
    const next = current === 'manager' ? 'staff' : 'manager';
    setUserRoles(prev => ({ ...prev, [email]: next }));
    await sbUpsert('user_roles', { email, role: next });
  };
```

- [ ] **Step 2: Add Access Management section at the bottom of the Team return JSX**

Find the closing `</div>` of the Team component's return (just before the final `}`). Add this section before the last closing `</div>`:

```jsx
      {/* ── Access Management ── */}
      <div style={{ marginTop:32 }}>
        <div style={{ marginBottom:16 }}>
          <h2 style={{ fontSize:18, fontWeight:700, color:'#323338', marginBottom:4 }}>System Access</h2>
          <p style={{ fontSize:13, color:'#676879' }}>Manage CRM login roles. Changes take effect on next login.</p>
        </div>
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e9eaf3', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#f9fafb', borderBottom:'1px solid #e9eaf3' }}>
                <th style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#676879' }}>Email</th>
                <th style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#676879' }}>Role</th>
                <th style={{ padding:'10px 16px', textAlign:'right', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#676879' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(ALLOWED_USERS).map((email, i) => {
                const role = userRoles[email] || ALLOWED_USERS[email];
                const isSelf = email === currentUserEmail;
                return (
                  <tr key={email} style={{ borderBottom: i < Object.keys(ALLOWED_USERS).length - 1 ? '1px solid #f3f4f8' : 'none' }}>
                    <td style={{ padding:'12px 16px', fontSize:13, color:'#323338' }}>{email}</td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{
                        display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:99,
                        fontSize:11.5, fontWeight:600,
                        background: role === 'manager' ? '#ffd6ee' : '#f3f4f6',
                        color: role === 'manager' ? '#c11569' : '#676879',
                      }}>
                        {role === 'manager' ? '★ Manager' : 'Staff'}
                      </span>
                    </td>
                    <td style={{ padding:'12px 16px', textAlign:'right' }}>
                      <button
                        onClick={() => toggleRole(email)}
                        disabled={isSelf}
                        title={isSelf ? "Can't change your own role" : `Make ${role === 'manager' ? 'staff' : 'manager'}`}
                        style={{
                          padding:'5px 12px', borderRadius:7, fontSize:12, fontWeight:600, cursor: isSelf ? 'not-allowed' : 'pointer',
                          background: isSelf ? '#f3f4f6' : role === 'manager' ? '#fef2f2' : '#f0fdf4',
                          border: isSelf ? '1px solid #e5e7eb' : role === 'manager' ? '1px solid #fecaca' : '1px solid #bbf7d0',
                          color: isSelf ? '#9ca3af' : role === 'manager' ? '#dc2626' : '#166534',
                          opacity: isSelf ? 0.5 : 1,
                        }}
                      >
                        {role === 'manager' ? 'Demote' : 'Promote'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize:11, color:'#9ca3af', marginTop:8 }}>You cannot change your own role.</p>
      </div>
```

- [ ] **Step 3: Commit**

```bash
git add src/App.js
git commit -m "feat: add Access Management section to Team — role promotion via Supabase"
```

---

## Task 5: Monday.com UI Redesign

**Files:**
- Modify: `src/App.js` — CSS-in-JS block (~lines 160–360), `STATUS_STYLES` (~line 416), `Card` component (~line 612), Dashboard statCards (~line 830)

### 5a — CSS-in-JS Block Updates

- [ ] **Step 1: Update sidebar background**

Find:
```css
  .oz-sidebar {
    width: 236px; min-height: 100vh; background: #1c1f3a;
```
Change `#1c1f3a` → `#1f1f3d`

- [ ] **Step 2: Update active nav item colors**

Find:
```css
  .oz-nav-item.active {
    background: linear-gradient(120deg, rgba(99,102,241,0.28), rgba(167,139,250,0.18));
    color: #c4b5fd; font-weight: 600;
    box-shadow: inset 3px 0 0 #818cf8;
  }
```
Replace with:
```css
  .oz-nav-item.active {
    background: rgba(255,21,138,0.15);
    color: #ff8bc8; font-weight: 600;
    box-shadow: inset 3px 0 0 #ff158a;
  }
```

- [ ] **Step 3: Update active nav badge colors**

Find:
```css
  .oz-nav-item.active .oz-nav-badge { background: rgba(129,140,248,0.3); color: #c4b5fd; }
```
Replace with:
```css
  .oz-nav-item.active .oz-nav-badge { background: rgba(255,21,138,0.25); color: #ff8bc8; }
```

- [ ] **Step 4: Update primary button**

Find:
```css
  .oz-btn-primary {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff; box-shadow: 0 2px 10px rgba(99,102,241,0.35);
  }
  .oz-btn-primary:hover { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(99,102,241,0.45); }
```
Replace with:
```css
  .oz-btn-primary {
    background: linear-gradient(135deg, #ff158a, #ff5fae);
    color: #fff; box-shadow: 0 2px 10px rgba(255,21,138,0.35);
  }
  .oz-btn-primary:hover { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(255,21,138,0.45); }
```

- [ ] **Step 5: Update input focus colors**

Find:
```css
  .oz-input:focus { border-color: #6366f1; background: #fff; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
```
Replace with:
```css
  .oz-input:focus { border-color: #ff158a; background: #fff; box-shadow: 0 0 0 3px rgba(255,21,138,0.12); }
```

- [ ] **Step 6: Update KPI text colors**

Find:
```css
  .oz-kpi-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #4b5563; margin-bottom: 8px; }
  .oz-kpi-val   { font-size: 30px; font-weight: 800; color: #111827; line-height: 1; }
  .oz-kpi-sub   { font-size: 12px; color: #4b5563; margin-top: 5px; }
```
Replace with:
```css
  .oz-kpi-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #676879; margin-bottom: 8px; }
  .oz-kpi-val   { font-size: 30px; font-weight: 800; color: #323338; line-height: 1; }
  .oz-kpi-sub   { font-size: 12px; color: #676879; margin-top: 5px; }
```

- [ ] **Step 7: Update page title/sub colors**

Find:
```css
  .oz-page-title { font-size: 22px; font-weight: 800; color: #111827; }
  .oz-page-sub   { font-size: 13px; color: #4b5563; margin-top: 3px; }
```
Replace with:
```css
  .oz-page-title { font-size: 22px; font-weight: 800; color: #323338; }
  .oz-page-sub   { font-size: 13px; color: #676879; margin-top: 3px; }
```

- [ ] **Step 8: Update mobile nav colors**

Find:
```css
  .oz-mob-nav {
    display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 60;
    background: #1c1f3a; border-top: 1px solid #2d3157;
```
Change `#1c1f3a` → `#1f1f3d` and `#2d3157` → `#2d2d5e`

Find:
```css
  .oz-mob-btn:hover, .oz-mob-btn.active { color: #c4b5fd; background: rgba(129,140,248,0.2); }
```
Replace with:
```css
  .oz-mob-btn:hover, .oz-mob-btn.active { color: #ff8bc8; background: rgba(255,21,138,0.2); }
```

- [ ] **Step 9: Add main content background**

Find the `.oz-main-content` media query rule:
```css
    .oz-main-content { padding: 18px 14px 80px !important; }
```

Add a new rule BEFORE the `@media` block (around line 319 area, after `.oz-page-sub`):
```css
  /* ── MAIN CONTENT BG ────────────────────────────────── */
  .oz-main-content { background: #f6f7fb; }
```

- [ ] **Step 10: Commit CSS block changes**

```bash
git add src/App.js
git commit -m "style: update CSS-in-JS theme tokens to Monday.com color system"
```

### 5b — STATUS_STYLES Update

- [ ] **Step 11: Replace STATUS_STYLES constant**

Find the entire `STATUS_STYLES` object (~line 416) and replace with:
```js
const STATUS_STYLES = {
  'New':           { bg: '#ffd6ee', text: '#c11569', dot: '#c11569' },
  'In Progress':   { bg: '#ddf0ff', text: '#0073ea', dot: '#0073ea' },
  'Awaiting Docs': { bg: '#fff3c9', text: '#7a5800', dot: '#7a5800' },
  'Under Review':  { bg: '#fff3c9', text: '#7a5800', dot: '#7a5800' },
  'State Nomination': { bg: '#ddf0ff', text: '#0073ea', dot: '#0073ea' },
  'Completed':     { bg: '#c2f0db', text: '#0a6640', dot: '#0a6640' },
  'Awaiting Decision': { bg: '#f3f4f6', text: '#676879', dot: '#676879' },
  'S56 Request (Further Information)': { bg: '#ffd6d6', text: '#c11548', dot: '#c11548' },
  'On Hold':       { bg: '#f3f4f6', text: '#676879', dot: '#676879' },
  'Active':        { bg: '#c2f0db', text: '#0a6640', dot: '#0a6640' },
  'Pending':       { bg: '#fff3c9', text: '#7a5800', dot: '#7a5800' },
  'Inactive':      { bg: '#f3f4f6', text: '#676879', dot: '#676879' },
  'Urgent':        { bg: '#ffd6d6', text: '#c11548', dot: '#c11548' },
};
```

- [ ] **Step 12: Commit**

```bash
git add src/App.js
git commit -m "style: update STATUS_STYLES to Monday.com light palette"
```

### 5c — Card Component + Dashboard Stat Cards

- [ ] **Step 13: Update `Card` component**

Find the `Card` function (~line 612):
```jsx
function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ background:'#ffffff', border:'1.5px solid #d1d5db', borderRadius:12, padding:20, ...style, cursor: onClick ? 'pointer' : 'default', transition:'border-color 0.2s, transform 0.15s' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.borderColor='#38bdf830', e.currentTarget.style.transform='translateY(-1px)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.borderColor='#e5e7eb', e.currentTarget.style.transform='translateY(0)')}>
      {children}
    </div>
  );
}
```

Replace with:
```jsx
function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ background:'#ffffff', border:'1px solid #e9eaf3', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', ...style, cursor: onClick ? 'pointer' : 'default', transition:'all 0.2s' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.10)', e.currentTarget.style.transform='translateY(-1px)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)', e.currentTarget.style.transform='translateY(0)')}>
      {children}
    </div>
  );
}
```

- [ ] **Step 14: Update Dashboard statCards colors and add top border**

Find the `statCards` array (~line 830):
```js
  const statCards = [
    { label:'Active Clients',   value:active,     icon:'👥', color:'#6366f1', sub:`of ${clients.length} total`,   onClick:()=>onGoTo('clients') },
    { label:'Jobs In Progress', value:inProgress, icon:'⚡', color:'#f59e0b', sub:`${jobs.length} total cases`,     onClick:()=>{ setJobsStatusFilter('In Progress'); onGoTo('jobs'); } },
    { label:'Urgent Cases',      value:urgent,     icon:'🔴', color:'#f87171', sub:'need immediate attention',       onClick:()=>{ setJobsStatusFilter('Urgent'); onGoTo('jobs'); } },
    { label:'Awaiting Decision', value:awaitingDecision, icon:'⏳', color:'#94a3b8', sub:'lodged · pending outcome', onClick:()=>{ setJobsStatusFilter('Awaiting Decision'); onGoTo('jobs'); } },
  ];
```

Replace with:
```js
  const statCards = [
    { label:'Active Clients',    value:active,           icon:'👥', color:'#ff158a', sub:`of ${clients.length} total`,   onClick:()=>onGoTo('clients') },
    { label:'Jobs In Progress',  value:inProgress,       icon:'⚡', color:'#579bfc', sub:`${jobs.length} total cases`,   onClick:()=>{ setJobsStatusFilter('In Progress'); onGoTo('jobs'); } },
    { label:'Urgent Cases',      value:urgent,           icon:'🔴', color:'#e2445c', sub:'need immediate attention',     onClick:()=>{ setJobsStatusFilter('Urgent'); onGoTo('jobs'); } },
    { label:'Awaiting Decision', value:awaitingDecision, icon:'⏳', color:'#676879', sub:'lodged · pending outcome',     onClick:()=>{ setJobsStatusFilter('Awaiting Decision'); onGoTo('jobs'); } },
  ];
```

Find the Card render for stat cards (~line 849):
```jsx
        <Card key={s.label} onClick={s.onClick} style={{ position:'relative', overflow:'hidden' }}>
```
Replace with:
```jsx
        <Card key={s.label} onClick={s.onClick} style={{ position:'relative', overflow:'hidden', borderTop:`4px solid ${s.color}` }}>
```

- [ ] **Step 15: Commit**

```bash
git add src/App.js
git commit -m "style: update Card component and Dashboard stat cards with Monday.com accents"
```

### 5d — Inline Primary Button & Accent Color Updates

- [ ] **Step 16: Replace inline primary button gradients (22 occurrences)**

First verify locations:
```bash
grep -n "linear-gradient(135deg,#6366f1,#8b5cf6)" src/App.js | wc -l
# Expected: 22 lines (lines 712, 1026, 2060, 2331, 2488, 2717, 2808, 2980, 3237, 3372, 3602, 3761, 4389, 4541, 4622, 4709, 4829, 4886, 4990, 5173, 5245 and one conditional at 2488)
```

Use replace_all to replace:
- `background:'linear-gradient(135deg,#6366f1,#8b5cf6)'` → `background:'linear-gradient(135deg,#ff158a,#ff5fae)'`

Also fix the one with spaces (CSS-in-JS block line 245 was already done in Step 4, skip).

Also fix the one with conditional at line 2488 which reads:
```js
background: wchatSaved ? '#f3f4f6' : 'linear-gradient(135deg,#6366f1,#8b5cf6)'
```
→
```js
background: wchatSaved ? '#f3f4f6' : 'linear-gradient(135deg,#ff158a,#ff5fae)'
```
And line 2717 conditional:
```js
background: importing ? '#e5e7eb' : 'linear-gradient(135deg,#6366f1,#8b5cf6)'
```
→
```js
background: importing ? '#e5e7eb' : 'linear-gradient(135deg,#ff158a,#ff5fae)'
```
(These conditionals are covered by the replace_all above — just confirming they are included.)

- [ ] **Step 17: Replace inline accent colors (8 targeted occurrences)**

These are specific patterns to change. Do NOT use replace_all for `#6366f1` globally — team member colors and chart colors must stay indigo.

**a) "View all →" link buttons (~lines 870, 892, 923, 954) — 4 occurrences:**
```bash
grep -n "color:'#6366f1', fontSize:13, cursor:'pointer'" src/App.js
# Expected: 4 lines
```
Use replace_all:
`color:'#6366f1', fontSize:13, cursor:'pointer'` → `color:'#ff158a', fontSize:13, cursor:'pointer'`

**b) Tab underline active state (~line 1869) — 1 occurrence:**
```bash
grep -n "borderBottom: tab===t.id" src/App.js
```
Find:
```js
color: tab===t.id ? '#6366f1' : '#6b7280', ... borderBottom: tab===t.id ? '2px solid #6366f1' : '2px solid transparent'
```
Replace (the entire style attribute on that button):
```js
color: tab===t.id ? '#ff158a' : '#6b7280', ... borderBottom: tab===t.id ? '2px solid #ff158a' : '2px solid transparent'
```

**c) Timeline activity left border (~line 1974) — 1 occurrence:**
```bash
grep -n "borderLeft.*4px solid.*#6366f1" src/App.js
```
Replace: `borderLeft:\`4px solid ${isUnsuc?'#ef4444':'#6366f1'}\`` → `borderLeft:\`4px solid ${isUnsuc?'#ef4444':'#ff158a'}\``

**d) Clickable client name in table (~line 3027) — 1 occurrence:**
```bash
grep -n "color:'#6366f1', fontSize:14, cursor:'pointer'" src/App.js
```
Replace: `color:'#6366f1', fontSize:14, cursor:'pointer'` → `color:'#ff158a', fontSize:14, cursor:'pointer'`

**e) Clickable job title in board view (~line 3638) — 1 occurrence:**
```bash
grep -n "color:'#6366f1', cursor:'pointer', textDecoration" src/App.js
```
Replace the color value in that style: `color:'#6366f1'` → `color:'#ff158a'`

- [ ] **Step 18: Update login gradient background**

The login screen gradient is now in the new `LoginScreen` component (already updated in Task 2). No additional change needed here.

- [ ] **Step 19: Commit**

```bash
git add src/App.js
git commit -m "style: replace inline indigo accent colors with Monday.com pink"
```

---

## Task 6: Final Verification & Push

- [ ] **Step 1: Run the app locally and verify**

```bash
npm start
```

Manual checks:
- [ ] Login page shows Google button (not password)
- [ ] Clicking "Continue with Google" redirects to Google consent
- [ ] After Google auth, app opens on Dashboard (not login screen)
- [ ] Gmail in SmartAI works without re-authenticating
- [ ] Non-whitelisted Gmail account sees "not authorised" error
- [ ] Team section shows "System Access" table with promote/demote buttons
- [ ] Promoting a user saves to Supabase (check Supabase dashboard)
- [ ] Sidebar active item glows Monday pink (not purple)
- [ ] Primary buttons are pink gradient
- [ ] Status badges use Monday.com light palette
- [ ] Dashboard stat cards have colored top borders
- [ ] Main content area has `#f6f7fb` background

- [ ] **Step 2: Push**

```bash
git push origin main
```
