const { callNcm } = require('../../lib/ncmClient');
const {
  getSession,
  parseSessionCookie,
  unsealNcmCookie,
} = require('../../lib/sessionStore');
const { normalizePlaylists } = require('../../lib/trackNormalizer');

function json(res, status, body) {
  res.status(status).json(body);
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parseBoundedInt(value, fallback, max) {
  const rawValue = firstValue(value);

  if (!/^\d+$/.test(String(rawValue))) {
    return fallback;
  }

  const parsed = parseInt(rawValue, 10);

  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

module.exports = async function handler(req, res) {
  const sessionId = parseSessionCookie(req.headers && req.headers.cookie);
  const session = sessionId ? await getSession(sessionId) : null;

  if (!session || !session.sealedCookie || !session.uid) {
    json(res, 401, { ok: false, error: 'LOGIN_REQUIRED' });
    return;
  }

  try {
    const limit = parseBoundedInt(req.query && req.query.limit, 50, 100);
    const offset = parseBoundedInt(req.query && req.query.offset, 0, 1000);
    const ncmCookie = unsealNcmCookie(session.sealedCookie);
    const body = await callNcm('user_playlist', { uid: session.uid, limit, offset }, ncmCookie);
    const playlists = normalizePlaylists(body, limit);

    json(res, 200, { ok: true, playlists });
  } catch (error) {
    json(res, error.status || 502, { ok: false, error: 'NetEase playlists failed' });
  }
};
