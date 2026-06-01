const crypto = require('crypto');

const SESSION_COOKIE = 'ncm_session';
const LOCAL_DEV_SECRET = 'local-dev-session-secret';
const SESSION_KEY_PREFIX = 'ncm_session:';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const sessions = new Map();

function createSessionId() {
  return `sess_${crypto.randomBytes(24).toString('base64url')}`;
}

function createSessionCookie(sessionId, maxAgeSeconds = 60 * 60 * 24 * 7) {
  return `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function createClearCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function parseSessionCookie(cookieHeader) {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split('=');
    if (rawName === SESSION_COOKIE) {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return null;
}

function getEncryptionKey() {
  const secret = process.env.SESSION_SECRET || LOCAL_DEV_SECRET;
  return crypto.createHash('sha256').update(secret).digest();
}

function sealNcmCookie(ncmCookie) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(ncmCookie), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

function unsealNcmCookie(sealedCookie) {
  const [version, ivValue, tagValue, encryptedValue] = String(sealedCookie).split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Invalid sealed cookie');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function hasUpstashConfig() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function sessionKey(sessionId) {
  return `${SESSION_KEY_PREFIX}${sessionId}`;
}

async function callUpstash(command) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  const body = await response.json();
  if (!response.ok || body.error) {
    const error = new Error(body.error || 'Upstash Redis request failed');
    error.status = response.status;
    throw error;
  }

  return body.result;
}

async function saveSession(sessionId, data) {
  const session = {
    ...data,
    updatedAt: Date.now(),
  };

  if (hasUpstashConfig()) {
    await callUpstash([
      'SET',
      sessionKey(sessionId),
      JSON.stringify(session),
      'EX',
      SESSION_TTL_SECONDS,
    ]);
    return session;
  }

  sessions.set(sessionId, session);
  return session;
}

async function getSession(sessionId) {
  if (hasUpstashConfig()) {
    const value = await callUpstash(['GET', sessionKey(sessionId)]);
    return value ? JSON.parse(value) : null;
  }

  return sessions.get(sessionId) || null;
}

async function deleteSession(sessionId) {
  if (hasUpstashConfig()) {
    const deleted = await callUpstash(['DEL', sessionKey(sessionId)]);
    return Number(deleted) > 0;
  }

  return sessions.delete(sessionId);
}

module.exports = {
  SESSION_COOKIE,
  createSessionId,
  createSessionCookie,
  createClearCookie,
  parseSessionCookie,
  sealNcmCookie,
  unsealNcmCookie,
  saveSession,
  getSession,
  deleteSession,
};
