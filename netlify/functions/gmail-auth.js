// netlify/functions/gmail-auth.js
// Netlify Functions adapter for Gmail OAuth2

exports.handler = async (event, context) => {
  const method = event.httpMethod;
  const query = event.queryStringParameters || {};
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}

  // ── GET: Generate the Google OAuth URL ──
  if (method === 'GET' && query.action === 'url') {
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
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }),
    };
  }

  // ── GET: Callback from Google with ?code=... ──
  if (method === 'GET' && query.code) {
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: query.code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });
      const tokens = await tokenRes.json();
      if (tokens.error) {
        return {
          statusCode: 302,
          headers: { Location: `/?gmail_error=${encodeURIComponent(tokens.error_description)}` },
          body: '',
        };
      }
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
        return {
          statusCode: 302,
          headers: { Location: '/?gmail_error=Authentication+failed' },
          body: '',
        };
      }
      const fragment = new URLSearchParams({
        gmail_access_token:  tokens.access_token,
        gmail_refresh_token: tokens.refresh_token || '',
        gmail_expires_in:    tokens.expires_in || 3600,
        gmail_user_email:    userEmail,
      });
      return {
        statusCode: 302,
        headers: { Location: `/#${fragment}` },
        body: '',
      };
    } catch (err) {
      return {
        statusCode: 302,
        headers: { Location: `/?gmail_error=${encodeURIComponent(err.message)}` },
        body: '',
      };
    }
  }

  // ── POST: Refresh an expired access token ──
  if (method === 'POST' && body.action === 'refresh') {
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token:  body.refresh_token,
          client_id:      process.env.GOOGLE_CLIENT_ID,
          client_secret:  process.env.GOOGLE_CLIENT_SECRET,
          grant_type:     'refresh_token',
        }),
      });
      const data = await tokenRes.json();
      return {
        statusCode: tokenRes.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
