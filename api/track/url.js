const { callNcm } = require('../../lib/ncmClient');
const {
  getSession,
  parseSessionCookie,
  unsealNcmCookie,
} = require('../../lib/sessionStore');

function json(res, status, body) {
  res.status(status).json(body);
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

module.exports = async function handler(req, res) {
  const id = firstValue(req.query && req.query.id);

  if (!id) {
    json(res, 400, { ok: false, error: 'MISSING_ID' });
    return;
  }

  try {
    const sessionId = parseSessionCookie(req.headers && req.headers.cookie);
    const session = sessionId ? await getSession(sessionId) : null;
    const ncmCookie = session && session.sealedCookie
      ? unsealNcmCookie(session.sealedCookie)
      : '';

    const body = await callNcm('song_url_v1', {
      id,
      level: firstValue(req.query && req.query.level) || 'exhigh',
      realIP: firstValue(req.query && req.query.realIP) || '116.25.146.177',
    }, ncmCookie);
    const item = body && Array.isArray(body.data) ? body.data[0] : null;

    if (!item || !item.url) {
      json(res, 403, {
        ok: false,
        error: 'NO_PLAY_PERMISSION',
        code: item && item.code,
        message: '当前账号无权播放该音质或歌曲',
      });
      return;
    }

    json(res, 200, { ok: true, data: [item] });
  } catch (error) {
    json(res, error.status || 502, { ok: false, error: 'NetEase track URL failed' });
  }
};
