// netlify/functions/manus-project.js
// Netlify Functions adapter — wraps the Vercel-style handler

const originalModule = require('../../api/manus-project.js');

// Adapter: converts Netlify event/context to Vercel-style req/res
exports.handler = async (event, context) => {
  let bodyParsed = {};
  try { bodyParsed = JSON.parse(event.body || '{}'); } catch {}

  const req = {
    method: event.httpMethod,
    headers: event.headers || {},
    query: event.queryStringParameters || {},
    body: bodyParsed,
  };

  let statusCode = 200;
  let responseHeaders = { 'Content-Type': 'application/json' };
  let responseBody = '';
  let redirectLocation = null;

  const res = {
    status(code) { statusCode = code; return res; },
    json(data) { responseBody = JSON.stringify(data); return res; },
    send(data) { responseBody = typeof data === 'string' ? data : JSON.stringify(data); return res; },
    redirect(location) { redirectLocation = location; statusCode = 302; return res; },
    setHeader(key, val) { responseHeaders[key] = val; return res; },
    end() { return res; },
  };

  const handler = originalModule.default || originalModule;
  await handler(req, res);

  if (redirectLocation) {
    return { statusCode, headers: { ...responseHeaders, Location: redirectLocation }, body: '' };
  }
  return { statusCode, headers: responseHeaders, body: responseBody };
};
