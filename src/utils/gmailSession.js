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
