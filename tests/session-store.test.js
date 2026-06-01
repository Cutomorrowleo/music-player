const assert = require('assert');
const {
  createSessionCookie,
  saveSession,
  getSession,
  deleteSession,
  parseSessionCookie,
  sealNcmCookie,
  unsealNcmCookie,
} = require('../lib/sessionStore');

(async () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const cookie = createSessionCookie('sess_abc123');
    assert(cookie.includes('ncm_session=sess_abc123'), 'session cookie should contain opaque id');
    assert(cookie.includes('HttpOnly'), 'session cookie must be HttpOnly');
    assert(cookie.includes('Secure'), 'session cookie must be Secure');
    assert(cookie.includes('SameSite=Lax'), 'session cookie must use SameSite=Lax');
    assert(cookie.includes('Max-Age=604800'), 'session cookie must include default Max-Age');

    const shortCookie = createSessionCookie('sess_short', 60);
    assert(shortCookie.includes('Max-Age=60'), 'session cookie should use provided Max-Age');

    assert.strictEqual(
      parseSessionCookie('theme=dark; ncm_session=sess_abc123; other=x'),
      'sess_abc123',
      'should parse ncm_session from cookie header'
    );

    process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef';
    const sealed = sealNcmCookie('MUSIC_U=secret; __csrf=token');
    assert.notStrictEqual(sealed, 'MUSIC_U=secret; __csrf=token', 'sealed value should not expose raw cookie');
    assert.strictEqual(unsealNcmCookie(sealed), 'MUSIC_U=secret; __csrf=token', 'sealed cookie should decrypt');

    const savedPromise = saveSession('sess_abc123', { sealedCookie: 'sealed-value', userId: 123 });
    assert.strictEqual(typeof savedPromise.then, 'function', 'saveSession should be async');
    const saved = await savedPromise;
    assert.strictEqual(saved.sealedCookie, 'sealed-value', 'saved session should preserve sealedCookie');
    assert.strictEqual(saved.userId, 123, 'saved session should preserve data fields');
    assert.strictEqual(typeof saved.updatedAt, 'number', 'saved session should include updatedAt timestamp');

    const storedPromise = getSession('sess_abc123');
    assert.strictEqual(typeof storedPromise.then, 'function', 'getSession should be async');
    const stored = await storedPromise;
    assert.deepStrictEqual(stored, saved, 'getSession should return saved session data');

    const deletedPromise = deleteSession('sess_abc123');
    assert.strictEqual(typeof deletedPromise.then, 'function', 'deleteSession should be async');
    assert.strictEqual(await deletedPromise, true, 'deleteSession should delete existing session');
    assert.strictEqual(await getSession('sess_abc123'), null, 'getSession should return null after delete');

    const localSaved = await saveSession('sess_local', { sealedCookie: 'local-sealed', uid: 456 });
    assert.strictEqual(localSaved.sealedCookie, 'local-sealed', 'local fallback should preserve sealedCookie');
    assert.strictEqual((await getSession('sess_local')).uid, 456, 'local fallback should read saved session');
    assert.strictEqual(await deleteSession('sess_local'), true, 'local fallback should delete saved session');
    assert.strictEqual(await getSession('sess_local'), null, 'local fallback should not return deleted session');

    const calls = [];
    const remoteValues = new Map();
    process.env.UPSTASH_REDIS_REST_URL = 'https://example-upstash.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    global.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, body, authorization: options.headers.Authorization });
      const [command, key, value] = body;
      if (command === 'SET') {
        remoteValues.set(key, value);
        return { ok: true, json: async () => ({ result: 'OK' }) };
      }
      if (command === 'GET') {
        return { ok: true, json: async () => ({ result: remoteValues.get(key) || null }) };
      }
      if (command === 'DEL') {
        const deleted = remoteValues.delete(key) ? 1 : 0;
        return { ok: true, json: async () => ({ result: deleted }) };
      }
      throw new Error(`Unexpected command ${command}`);
    };

    const upstashSaved = await saveSession('sess_remote', { sealedCookie: 'remote-sealed', uid: 789 });
    assert.strictEqual(upstashSaved.sealedCookie, 'remote-sealed', 'Upstash save should return session data');
    assert.strictEqual(calls[0].url, 'https://example-upstash.test', 'Upstash should call REST URL');
    assert.deepStrictEqual(
      calls[0].body.slice(0, 3),
      ['SET', 'ncm_session:sess_remote', JSON.stringify(upstashSaved)],
      'Upstash save should SET JSON session key'
    );
    assert.deepStrictEqual(calls[0].body.slice(3), ['EX', 60 * 60 * 24 * 7], 'Upstash save should set 7 day TTL');
    assert.strictEqual(calls[0].authorization, 'Bearer test-token', 'Upstash should use bearer token');

    const upstashStored = await getSession('sess_remote');
    assert.deepStrictEqual(upstashStored, upstashSaved, 'Upstash get should parse stored JSON');
    assert.strictEqual(await deleteSession('sess_remote'), true, 'Upstash delete should return true for deleted session');
  } finally {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }

  console.log('session store checks passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
