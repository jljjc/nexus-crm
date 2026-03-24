# Spec: Gmail Login + Monday.com UI Redesign

**Date:** 2026-03-24
**Status:** Draft

---

## Feature 1: Gmail as Primary Authentication

### Problem
The current flow requires users to (1) enter a password to log in, then (2) separately authenticate Gmail inside SmartAI. After Gmail OAuth completes, the server redirects to `/#fragment` — causing a full page reload that loses the user's in-app context. Users land on the login screen or at the root, not where they were.

### Solution
Replace the password login entirely with Google OAuth. Gmail tokens are captured at login time, so no separate "connect Gmail" step is needed in SmartAI.

### Allowed Users (whitelist)
```
l.jiang@ozs.com.au         → manager (default)
m.mao@ozs.com.au           → manager (default)
perthcq@ozs.com.au         → staff
perth_assistant@ozs.com.au → staff
admin2.perth@ozs.com.au    → staff
perthozsky@gmail.com       → staff
ozskyperth@gmail.com       → staff
perth@ozs.com.au           → staff
```

### Role Resolution (priority order)
1. Check Supabase `user_roles` table for email override → use that role if found
2. Fall back to hardcoded default (manager/staff as above)

**Note:** Use `sbFetch` directly with a filtered path for the role lookup — `sbSelect` has no filter argument:
```js
const rows = await sbFetch('user_roles?select=role&email=eq.' + encodeURIComponent(email))
const role = rows?.[0]?.role || hardcodedDefault   // empty array → fall back to hardcoded default
```
If the response array is empty or `role` is falsy, fall back to the hardcoded default. Do not treat absence as an error.

### Auth Flow

1. **Login screen** renders with "Continue with Google" button.
   - On mount, `LoginScreen` reads `window.location.search` for `?gmail_error=` (set by the server on OAuth failure) and displays it if present.

2. User clicks button → frontend calls `/api/gmail-auth?action=url` → redirects browser to Google consent.

3. Google redirects to `/api/gmail-auth?code=...`. Server exchanges code for tokens, fetches `userInfo.email`.
   - If `userInfo` call fails → `userEmail` is `''`. Server must treat this as an OAuth failure and redirect to `/?gmail_error=Authentication+failed` rather than passing an empty email in the fragment.
   - On any server-side error → redirect to `/?gmail_error=<message>` (existing behaviour).

4. Server redirects to `/#gmail_access_token=...&gmail_refresh_token=...&gmail_expires_in=...&gmail_user_email=<email>`.

5. **App's existing fragment `useEffect`** (line ~5438 in `App.js`) must be extended to handle login:
   - Read `gmail_user_email` from fragment.
   - Check it against the hardcoded whitelist.
   - If not in whitelist → set `authError` state in `App` (e.g. `"Your account is not authorised. Contact your manager."`) and clear the fragment. Do NOT set `authed`. `LoginScreen` will still render (because `authed` is still `false`) and receives `errorMessage` prop.
   - If in whitelist → call `sbFetch` to check `user_roles` for a role override. Resolve final role.
   - Call `writeGmailSession(token, refreshToken, expiresIn, email)` to store Gmail tokens.
   - Set `sessionStorage.setItem('ozsky_auth', '1')` and `sessionStorage.setItem('ozsky_role', role)`.
   - Call `setAuthed(true)` and `setIsManager(role === 'manager')`. This causes the app to render the main view (Dashboard).
   - Clear the fragment: `window.history.replaceState(null, '', window.location.pathname)`.

### LoginScreen Interface
`LoginScreen` receives two props:
```jsx
<LoginScreen
  onGmailAuth={() => { /* fetch OAuth URL and redirect */ }}
  errorMessage={authError}   // string | null — displayed if set
/>
```
- If `errorMessage` is set, show it below the Google button (replace any prior password-error area).
- `LoginScreen` also reads `window.location.search` on mount for `?gmail_error=` and shows it with the same error UI.

### Post-login Landing
Always navigate to Dashboard. No prior context is restored.

### In-app Role Promotion
- Managers see a "Role" toggle next to each team member in Team Management.
- Toggling writes to Supabase `user_roles` table using `sbFetch` directly with an upsert:
  ```js
  sbFetch('user_roles', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ email, role })
  })
  ```
  (`sbUpdate` cannot be used here because it filters by `id=eq.` but `user_roles` uses `email` as primary key.)
- Change takes effect on that user's next login.

### Supabase Table
```sql
CREATE TABLE user_roles (
  email TEXT PRIMARY KEY,
  role  TEXT NOT NULL CHECK (role IN ('manager', 'staff'))
);
```

### Files Affected
- `src/App.js`
  - `LoginScreen` component: replace password form with Google button + `errorMessage` prop
  - `App` component: extend fragment `useEffect` with whitelist check, role fetch, auth state setters; add `authError` state; pass `errorMessage` and `onGmailAuth` to `LoginScreen`
- `api/gmail-auth.js`
  - Add empty-email guard **between lines 66 and 69** (after userInfo fetch, before building fragment): if `userEmail === ''`, redirect to `/?gmail_error=Authentication+failed` instead of passing blank email in fragment:
    ```js
    if (!userEmail) {
      return res.redirect('/?gmail_error=Authentication+failed');
    }
    ```

---

## Feature 2: Monday.com UI Redesign

### Approach
Restyle existing CSS classes in `src/App.js`. No structural or layout changes. All existing component logic preserved.

### Color System

| Token | Before | After |
|-------|--------|-------|
| Sidebar bg | `#1c1f3a` | `#1f1f3d` |
| Active nav left border | `#818cf8` (indigo) | `#ff158a` (Monday pink) |
| Active nav bg | `rgba(99,102,241,0.28)` | `rgba(255,21,138,0.18)` |
| Active nav text | `#c4b5fd` | `#ff8bc8` |
| Primary button bg | `linear-gradient(135deg,#6366f1,#8b5cf6)` | `linear-gradient(135deg,#ff158a,#ff5fae)` |
| Primary button shadow | `rgba(99,102,241,0.35)` | `rgba(255,21,138,0.35)` |
| Input focus border | `#6366f1` | `#ff158a` |
| Input focus ring | `rgba(99,102,241,0.12)` | `rgba(255,21,138,0.12)` |
| Main bg | `#ffffff` | `#f6f7fb` |
| Text primary | `#111827` | `#323338` |
| Text secondary | `#4b5563` | `#676879` |
| Mobile nav active bg | `rgba(129,140,248,0.2)` | `rgba(255,21,138,0.2)` |
| Mobile nav active text | `#c4b5fd` | `#ff8bc8` |

### KPI Cards
Replace `border: 1px solid #e9eaf3` with `border-top: 4px solid <accent>; border: none`. Increase shadow slightly. Accent colors per KPI card (in order): pink `#ff158a`, blue `#579bfc`, green `#00c875`, orange `#ff642e`, yellow `#ffcb00`.

### Status Badges
Replace current palette with Monday.com vivid pills:

| Status | Background | Text |
|--------|-----------|------|
| Active / In Progress | `#ddf0ff` | `#0073ea` |
| Approved / Complete | `#c2f0db` | `#0a6640` |
| Pending / Waiting | `#fff3c9` | `#7a5800` |
| Cancelled / Rejected | `#ffd6d6` | `#c11548` |
| New / Lead | `#ffd6ee` | `#c11569` |

### Files Affected
- `src/App.js` — CSS-in-JS block (lines ~160–360): update `.oz-sidebar`, `.oz-nav-item.active`, `.oz-btn-primary`, `.oz-input:focus`, `.oz-kpi`, `.oz-mob-btn.active`; inline `background` on main content wrapper; badge color values throughout file
