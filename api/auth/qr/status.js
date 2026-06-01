const { callNcm } = require('../../../lib/ncmClient');
const {
  createSessionId,
  createSessionCookie,
  saveSession,
  sealNcmCookie,
} = require('../../../lib/sessionStore');

function json(res, status, body) {
  res.status(status).json(body);
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function getUser(accountResult) {
  const profile = accountResult && accountResult.profile ? accountResult.profile : {};
  const account = accountResult && accountResult.account ? accountResult.account : {};
  return {
    uid: profile.userId || account.id || null,
    nickname: profile.nickname || '',
    avatarUrl: profile.avatarUrl || '',
  };
}

module.exports = async function handler(req, res) {
  const key = firstValue(req.query && req.query.key);

  if (!key) {
    json(res, 400, { ok: false, error: 'Missing QR key' });
    return;
  }

  try {
    const timestamp = Date.now();
    const check = await callNcm('login_qr_check', { key, noCookie: true, timestamp });
    const code = check && check.code;
    const message = (check && (check.message || check.msg)) || '';

    if (code !== 803) {
      json(res, 200, { ok: true, code, message });
      return;
    }

    const ncmCookie = check.cookie;
    if (!ncmCookie) {
      json(res, 502, { ok: false, error: 'NetEase login cookie missing' });
      return;
    }

    const sessionId = createSessionId();
    const accountResult = await callNcm('user_account', {}, ncmCookie);
    const user = getUser(accountResult);

    await saveSession(sessionId, {
      uid: user.uid,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      sealedCookie: sealNcmCookie(ncmCookie),
      createdAt: Date.now(),
    });

    res.setHeader('Set-Cookie', createSessionCookie(sessionId));
    json(res, 200, { loggedIn: true, user });
  } catch (error) {
    json(res, error.status || 502, { ok: false, error: 'NetEase QR status failed' });
  }
};
