// netlify/functions/webhook-messages.js
// Netlify Functions adapter — wraps the Vercel-style handler
const originalModule = require('../../api/webhook-messages.js');

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
  const res = {
    status(code) { statusCode = code; return res; },
    json(data) { responseBody = JSON.stringify(data); return res; },
    send(data) { responseBody = typeof data === 'string' ? data : JSON.stringify(data); return res; },
    setHeader(key, val) { responseHeaders[key] = val; return res; },
    end() { return res; },
  };
  const handler = originalModule.default || originalModule;
  await handler(req, res);
  return { statusCode, headers: responseHeaders, body: responseBody };
};
