const {
  createClearCookie,
  deleteSession,
  parseSessionCookie,
} = require('../../lib/sessionStore');

function json(res, status, body) {
  res.status(status).json(body);
}

function methodNotAllowed(res) {
  res.setHeader('Allow', 'POST');
  json(res, 405, { ok: false, error: 'Method not allowed' });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    methodNotAllowed(res);
    return;
  }

  const sessionId = parseSessionCookie(req.headers && req.headers.cookie);
  if (sessionId) {
    await deleteSession(sessionId);
  }

  res.setHeader('Set-Cookie', createClearCookie());
  json(res, 200, { ok: true });
};
