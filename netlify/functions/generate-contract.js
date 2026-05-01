// netlify/functions/generate-contract.js
// Netlify Functions adapter for DOCX contract generation

const handler = require('../../api/generate-contract.js');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let bodyParsed = {};
  try { bodyParsed = JSON.parse(event.body || '{}'); } catch {}

  let statusCode = 200;
  let responseHeaders = { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  let responseBody = '';
  let isBase64 = false;

  const chunks = [];

  const res = {
    status(code) { statusCode = code; return res; },
    json(data) {
      responseHeaders['Content-Type'] = 'application/json';
      responseBody = JSON.stringify(data);
      return res;
    },
    send(data) {
      responseBody = typeof data === 'string' ? data : JSON.stringify(data);
      return res;
    },
    setHeader(key, val) { responseHeaders[key] = val; return res; },
    end() { return res; },
    // Handle binary buffer responses (DOCX)
    write(chunk) { chunks.push(chunk); return res; },
  };

  // Override res to capture binary buffer
  const origHandler = handler;

  // Wrap the handler to capture the buffer response
  const req = {
    method: event.httpMethod,
    headers: event.headers || {},
    query: event.queryStringParameters || {},
    body: bodyParsed,
  };

  // Patch res to handle binary
  let binaryBuffer = null;
  const patchedRes = {
    ...res,
    status(code) { statusCode = code; return patchedRes; },
    setHeader(key, val) {
      responseHeaders[key] = val;
      return patchedRes;
    },
    send(data) {
      if (Buffer.isBuffer(data)) {
        binaryBuffer = data;
      } else {
        responseBody = typeof data === 'string' ? data : JSON.stringify(data);
      }
      return patchedRes;
    },
    json(data) {
      responseHeaders['Content-Type'] = 'application/json';
      responseBody = JSON.stringify(data);
      return patchedRes;
    },
    end() { return patchedRes; },
  };

  await origHandler(req, patchedRes);

  if (binaryBuffer) {
    return {
      statusCode,
      headers: responseHeaders,
      body: binaryBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  }

  return { statusCode, headers: responseHeaders, body: responseBody };
};
