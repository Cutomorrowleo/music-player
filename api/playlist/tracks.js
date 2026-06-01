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
  const id = firstValue(req.query && req.query.id);

  if (!id) {
    json(res, 400, { ok: false, error: 'MISSING_ID' });
    return;
  }

  const sessionId = parseSessionCookie(req.headers && req.headers.cookie);
  const session = sessionId ? await getSession(sessionId) : null;

  if (!session || !session.sealedCookie || !session.uid) {
    json(res, 401, { ok: false, error: 'LOGIN_REQUIRED' });
    return;
  }

  try {
    const limit = parseBoundedInt(req.query && req.query.limit, 80, 200);
    const offset = parseBoundedInt(req.query && req.query.offset, 0, 10000);
    const ncmCookie = unsealNcmCookie(session.sealedCookie);
    const body = await callNcm('playlist_track_all', { id, limit, offset }, ncmCookie);
    const tracks = normalizeRecentTracks(body, limit);

    json(res, 200, { ok: true, tracks });
  } catch (error) {
    json(res, error.status || 502, { ok: false, error: 'NetEase playlist tracks failed' });
  }
};
