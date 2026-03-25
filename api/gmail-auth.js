// api/gmail-auth.js
// Handles Gmail OAuth2 token exchange
//
// Setup in Google Cloud Console:
//   1. Go to console.cloud.google.com → Create project "Ozsky CRM"
//   2. Enable Gmail API
//   3. OAuth consent screen → External → Add your email as test user
//   4. Credentials → Create OAuth 2.0 Client ID → Web Application
//      Authorised redirect URI: https://nexus-crm-omega.vercel.app/api/gmail-auth
//   5. Copy Client ID and Client Secret to Vercel env vars
//
// Vercel environment variables needed:
//   GOOGLE_CLIENT_ID=...
//   GOOGLE_CLIENT_SECRET=...
//   GOOGLE_REDIRECT_URI=https://nexus-crm-omega.vercel.app/api/gmail-auth

export default async function handler(req, res) {
  // ── GET: Generate the Google OAuth URL (called from frontend) ──
  if (req.method === 'GET' && req.query.action === 'url') {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });
    return res.json({
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    });
  }

  // ── GET: Callback from Google with ?code=... ──
  if (req.method === 'GET' && req.query.code) {
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: req.query.code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });
      const tokens = await tokenRes.json();

      if (tokens.error) {
        return res.redirect(`/?gmail_error=${encodeURIComponent(tokens.error_description)}`);
      }

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

      if (!userEmail) {
        return res.redirect('/?gmail_error=Authentication+failed');
      }

      // Redirect back to app with tokens in URL fragment (never in query string)
      const fragment = new URLSearchParams({
        gmail_access_token:  tokens.access_token,
        gmail_refresh_token: tokens.refresh_token || '',
        gmail_expires_in:    tokens.expires_in || 3600,
        gmail_user_email:    userEmail,
      });
      return res.redirect(`/#${fragment}`);
    } catch (err) {
      return res.redirect(`/?gmail_error=${encodeURIComponent(err.message)}`);
    }
  }

  // ── POST: Refresh an expired access token ──
  if (req.method === 'POST' && req.body?.action === 'refresh') {
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token:  req.body.refresh_token,
          client_id:      process.env.GOOGLE_CLIENT_ID,
          client_secret:  process.env.GOOGLE_CLIENT_SECRET,
          grant_type:     'refresh_token',
        }),
      });
      const data = await tokenRes.json();
      return res.status(tokenRes.status).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
