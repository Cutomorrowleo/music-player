const { getSession, parseSessionCookie } = require('../../lib/sessionStore');

function json(res, status, body) {
  res.status(status).json(body);
}

module.exports = async function handler(req, res) {
  const sessionId = parseSessionCookie(req.headers && req.headers.cookie);
  const session = sessionId ? await getSession(sessionId) : null;

  if (!session) {
    json(res, 200, { loggedIn: false });
    return;
  }

  json(res, 200, {
    loggedIn: true,
    user: {
      uid: session.uid,
      nickname: session.nickname,
      avatarUrl: session.avatarUrl,
    },
  });
};
