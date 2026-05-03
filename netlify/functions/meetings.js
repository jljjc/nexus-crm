// netlify/functions/meetings.js — adapter
const originalModule = require('../../api/meetings.js');
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
  const responseHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  let responseBody = '';
  const res = {
    status(code) { statusCode = code; return res; },
    json(data) { responseBody = JSON.stringify(data); return res; },
    send(data) { responseBody = typeof data === 'string' ? data : JSON.stringify(data); return res; },
    setHeader(k, v) { responseHeaders[k] = v; return res; },
    end() { return res; },
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...responseHeaders, 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,x-api-key' }, body: '' };
  }
  const handler = originalModule.default || originalModule;
  await handler(req, res);
  return { statusCode, headers: responseHeaders, body: responseBody };
};
