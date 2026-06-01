const { callNcm } = require('../../lib/ncmClient');
const {
  getSession,
  parseSessionCookie,
  unsealNcmCookie,
} = require('../../lib/sessionStore');
const { normalizeRecentTracks } = require('../../lib/trackNormalizer');

function json(res, status, body) {
  res.status(status).json(body);
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parseLimit(value) {
  const rawValue = firstValue(value);

  if (!/^\d+$/.test(String(rawValue))) {
    return 6;
  }

  const parsed = parseInt(rawValue, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return 6;
  }

  return Math.min(parsed, 6);
}

module.exports = async function handler(req, res) {
  const sessionId = parseSessionCookie(req.headers && req.headers.cookie);
  const session = sessionId ? await getSession(sessionId) : null;

  if (!session || !session.sealedCookie || !session.uid) {
    json(res, 401, { ok: false, error: 'LOGIN_REQUIRED' });
    return;
  }

  try {
    const limit = parseLimit(req.query && req.query.limit);
    const ncmCookie = unsealNcmCookie(session.sealedCookie);
    const body = await callNcm('record_recent_song', { limit }, ncmCookie);
    const tracks = normalizeRecentTracks(body, limit);

    json(res, 200, { ok: true, tracks });
  } catch (error) {
    json(res, error.status || 502, { ok: false, error: 'NetEase recent tracks failed' });
  }
};
