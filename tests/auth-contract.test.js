const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  createSessionCookie,
  deleteSession,
  getSession,
  saveSession,
} = require('../lib/sessionStore');

const files = [
  'api/auth/qr/start.js',
  'api/auth/qr/status.js',
  'api/auth/me.js',
  'api/auth/logout.js',
  'api/me/recent-tracks.js',
  'api/track/url.js',
  'api/track/lyric.js',
];

for (const file of files) {
  const full = path.join(__dirname, '..', file);
  assert(fs.existsSync(full), `${file} should exist`);
  const source = fs.readFileSync(full, 'utf8');
  assert(/module\.exports\s*=\s*async function handler/.test(source), `${file} should export Vercel handler`);
}

const startSource = fs.readFileSync(path.join(__dirname, '..', 'api/auth/qr/start.js'), 'utf8');
assert(/req\.method\s*!==\s*'POST'/.test(startSource), 'QR start should be POST only');
assert(/callNcm\('login_qr_key'/.test(startSource), 'QR start should request NetEase QR key');
assert(/callNcm\('login_qr_create'/.test(startSource), 'QR start should create QR image');

const statusSource = fs.readFileSync(path.join(__dirname, '..', 'api/auth/qr/status.js'), 'utf8');
assert(/callNcm\('login_qr_check'/.test(statusSource), 'QR status should check NetEase QR key');
assert(/noCookie:\s*true/.test(statusSource), 'QR status should avoid proxying NetEase cookies to client');
assert(/const\s+ncmCookie\s*=\s*check\.cookie/.test(statusSource), 'QR status should use check.cookie from login_qr_check body');
assert(/createSessionCookie/.test(statusSource), 'QR status should set local session cookie after success');
assert(/sealNcmCookie/.test(statusSource), 'QR status should seal NetEase cookie before storing');
assert(/await\s+saveSession/.test(statusSource), 'QR status should await session persistence');

const meSource = fs.readFileSync(path.join(__dirname, '..', 'api/auth/me.js'), 'utf8');
assert(/parseSessionCookie/.test(meSource), 'me should parse local session cookie');
assert(/await\s+getSession/.test(meSource), 'me should await local session lookup');

const logoutSource = fs.readFileSync(path.join(__dirname, '..', 'api/auth/logout.js'), 'utf8');
assert(/req\.method\s*!==\s*'POST'/.test(logoutSource), 'logout should be POST only');
assert(/await\s+deleteSession/.test(logoutSource), 'logout should await local session deletion');
assert(/createClearCookie/.test(logoutSource), 'logout should clear session cookie');

const recentTracksSource = fs.readFileSync(path.join(__dirname, '..', 'api/me/recent-tracks.js'), 'utf8');
assert(/parseSessionCookie/.test(recentTracksSource), 'recent tracks should parse local session cookie');
assert(/await\s+getSession/.test(recentTracksSource), 'recent tracks should await local session lookup');
assert(/unsealNcmCookie/.test(recentTracksSource), 'recent tracks should unseal stored NetEase cookie');
assert(/LOGIN_REQUIRED/.test(recentTracksSource), 'recent tracks should require login');
assert(/callNcm\('record_recent_song'/.test(recentTracksSource), 'recent tracks should fetch recent songs');
assert(/normalizeRecentTracks\(body,\s*limit\)/.test(recentTracksSource), 'recent tracks should normalize the direct body envelope');

const trackUrlSource = fs.readFileSync(path.join(__dirname, '..', 'api/track/url.js'), 'utf8');
assert(/MISSING_ID/.test(trackUrlSource), 'track URL should require id');
assert(/song_url_v1/.test(trackUrlSource), 'track URL should call NetEase song_url_v1');
assert(/NO_PLAY_PERMISSION/.test(trackUrlSource), 'track URL should handle missing play permission');
assert(/unsealNcmCookie/.test(trackUrlSource), 'track URL should unseal optional session cookie');

const trackLyricSource = fs.readFileSync(path.join(__dirname, '..', 'api/track/lyric.js'), 'utf8');
assert(/MISSING_ID/.test(trackLyricSource), 'track lyric should require id');
assert(/callNcm\('lyric'/.test(trackLyricSource), 'track lyric should call NetEase lyric API');

function createRes() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function clearRoute(relativePath) {
  delete require.cache[require.resolve(relativePath)];
}

function patchExports(relativePath, overrides) {
  const moduleExports = require(relativePath);
  const originals = {};
  const hadOwnProperty = {};

  for (const key of Object.keys(overrides)) {
    hadOwnProperty[key] = Object.prototype.hasOwnProperty.call(moduleExports, key);
    originals[key] = moduleExports[key];
    moduleExports[key] = overrides[key];
  }

  return () => {
    for (const key of Object.keys(overrides)) {
      if (hadOwnProperty[key]) {
        moduleExports[key] = originals[key];
      } else {
        delete moduleExports[key];
      }
    }
  };
}

function makeRecentSongBody(count) {
  return {
    data: {
      list: Array.from({ length: count }, (_, index) => ({
        data: {
          id: index + 1,
          name: `Track ${index + 1}`,
          ar: [{ name: 'Artist' }],
          al: { name: 'Album', picUrl: 'https://example.test/cover.png' },
        },
      })),
    },
  };
}

(async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  const meHandler = require('../api/auth/me');
  const logoutHandler = require('../api/auth/logout');

  await saveSession('sess_contract', {
    uid: 123,
    nickname: 'Contract User',
    avatarUrl: 'https://example.test/avatar.png',
    sealedCookie: 'sealed',
    createdAt: 1,
  });

  const meRes = createRes();
  await meHandler(
    { headers: { cookie: createSessionCookie('sess_contract') } },
    meRes
  );
  assert.strictEqual(meRes.statusCode, 200, 'me should return 200 for active session');
  assert.deepStrictEqual(meRes.body, {
    loggedIn: true,
    user: {
      uid: 123,
      nickname: 'Contract User',
      avatarUrl: 'https://example.test/avatar.png',
    },
  }, 'me should return logged-in user from session');

  const anonymousRes = createRes();
  await meHandler({ headers: {} }, anonymousRes);
  assert.deepStrictEqual(anonymousRes.body, { loggedIn: false }, 'me should return logged out without session');

  const logoutRes = createRes();
  await logoutHandler(
    { method: 'POST', headers: { cookie: createSessionCookie('sess_contract') } },
    logoutRes
  );
  assert.strictEqual(logoutRes.statusCode, 200, 'logout should return 200');
  assert.deepStrictEqual(logoutRes.body, { ok: true }, 'logout should return ok');
  assert(logoutRes.headers['Set-Cookie'].includes('Max-Age=0'), 'logout should clear session cookie');
  assert.strictEqual(await getSession('sess_contract'), null, 'logout should delete local session');

  await deleteSession('sess_contract');

  const restoreRecentUnauthSession = patchExports('../lib/sessionStore', {
    parseSessionCookie: () => null,
    getSession: async () => null,
    unsealNcmCookie: () => {
      throw new Error('unsealNcmCookie should not run without a session');
    },
  });
  const restoreRecentUnauthNcm = patchExports('../lib/ncmClient', {
    callNcm: async () => {
      throw new Error('callNcm should not run without a session');
    },
  });
  clearRoute('../api/me/recent-tracks');
  const recentTracksUnauthHandler = require('../api/me/recent-tracks');
  const recentTracksUnauthRes = createRes();
  await recentTracksUnauthHandler({ headers: {}, query: {} }, recentTracksUnauthRes);
  assert.strictEqual(recentTracksUnauthRes.statusCode, 401, 'recent tracks should reject missing session');
  assert.deepStrictEqual(
    recentTracksUnauthRes.body,
    { ok: false, error: 'LOGIN_REQUIRED' },
    'recent tracks should return LOGIN_REQUIRED without session'
  );
  restoreRecentUnauthNcm();
  restoreRecentUnauthSession();

  async function assertRecentLimit(inputLimit, expectedLimit, message) {
    let callParams = null;
    const restoreSession = patchExports('../lib/sessionStore', {
      parseSessionCookie: () => 'sess_recent',
      getSession: async () => ({ uid: 456, sealedCookie: 'sealed' }),
      unsealNcmCookie: () => 'MUSIC_U=mock',
    });
    const restoreNcm = patchExports('../lib/ncmClient', {
      callNcm: async (fnName, params, ncmCookie) => {
        callParams = { fnName, params, ncmCookie };
        return makeRecentSongBody(8);
      },
    });

    clearRoute('../api/me/recent-tracks');
    const recentTracksHandler = require('../api/me/recent-tracks');
    const res = createRes();
    await recentTracksHandler(
      { headers: { cookie: createSessionCookie('sess_recent') }, query: { limit: inputLimit } },
      res
    );
    restoreNcm();
    restoreSession();

    assert.strictEqual(res.statusCode, 200, message);
    assert.strictEqual(callParams.fnName, 'record_recent_song', `${message}: should call recent song API`);
    assert.strictEqual(callParams.params.limit, expectedLimit, `${message}: should pass clamped limit`);
    assert.strictEqual(callParams.ncmCookie, 'MUSIC_U=mock', `${message}: should pass unsealed cookie`);
    assert.strictEqual(res.body.tracks.length, expectedLimit, `${message}: should return clamped track count`);
  }

  await assertRecentLimit(['abc', '3'], 6, 'malformed recent track limit should default to 6');
  await assertRecentLimit('3abc', 6, 'partially malformed recent track limit should default to 6');
  await assertRecentLimit('-2', 6, 'negative recent track limit should default to 6');
  await assertRecentLimit('99', 6, 'oversized recent track limit should clamp to 6');

  clearRoute('../api/track/url');
  const trackUrlMissingIdHandler = require('../api/track/url');
  const trackUrlMissingIdRes = createRes();
  await trackUrlMissingIdHandler({ headers: {}, query: {} }, trackUrlMissingIdRes);
  assert.strictEqual(trackUrlMissingIdRes.statusCode, 400, 'track URL should reject missing id');
  assert.deepStrictEqual(
    trackUrlMissingIdRes.body,
    { ok: false, error: 'MISSING_ID' },
    'track URL should return MISSING_ID without id'
  );

  const restoreTrackUrlPermissionSession = patchExports('../lib/sessionStore', {
    parseSessionCookie: () => 'sess_url',
    getSession: async () => ({ uid: 789, sealedCookie: 'sealed' }),
    unsealNcmCookie: () => 'MUSIC_U=mock',
  });
  const restoreTrackUrlPermissionNcm = patchExports('../lib/ncmClient', {
    callNcm: async () => ({ data: [{ id: '1', code: 404, url: null }] }),
  });
  clearRoute('../api/track/url');
  const trackUrlPermissionHandler = require('../api/track/url');
  const trackUrlPermissionRes = createRes();
  await trackUrlPermissionHandler(
    { headers: { cookie: createSessionCookie('sess_url') }, query: { id: '1' } },
    trackUrlPermissionRes
  );
  restoreTrackUrlPermissionNcm();
  restoreTrackUrlPermissionSession();
  assert.strictEqual(trackUrlPermissionRes.statusCode, 403, 'track URL should reject missing playable URL');
  assert.strictEqual(trackUrlPermissionRes.body.ok, false, 'track URL no permission should not be ok');
  assert.strictEqual(
    trackUrlPermissionRes.body.error,
    'NO_PLAY_PERMISSION',
    'track URL no permission should return NO_PLAY_PERMISSION'
  );
  assert.strictEqual(trackUrlPermissionRes.body.code, 404, 'track URL no permission should expose item code');

  let anonymousUrlCall = null;
  const restoreTrackUrlAnonymousSession = patchExports('../lib/sessionStore', {
    parseSessionCookie: () => null,
    getSession: async () => null,
    unsealNcmCookie: () => {
      throw new Error('unsealNcmCookie should not run for anonymous playback');
    },
  });
  const restoreTrackUrlAnonymousNcm = patchExports('../lib/ncmClient', {
    callNcm: async (fnName, params, ncmCookie) => {
      anonymousUrlCall = { fnName, params, ncmCookie };
      return { data: [{ id: '2', url: 'https://music.example.test/song.mp3' }] };
    },
  });
  clearRoute('../api/track/url');
  const trackUrlAnonymousHandler = require('../api/track/url');
  const trackUrlAnonymousRes = createRes();
  await trackUrlAnonymousHandler({ headers: {}, query: { id: '2' } }, trackUrlAnonymousRes);
  restoreTrackUrlAnonymousNcm();
  restoreTrackUrlAnonymousSession();
  assert.strictEqual(trackUrlAnonymousRes.statusCode, 200, 'track URL should allow anonymous playback lookup');
  assert.strictEqual(anonymousUrlCall.fnName, 'song_url_v1', 'track URL should call song_url_v1');
  assert.strictEqual(anonymousUrlCall.ncmCookie, '', 'track URL anonymous playback should use empty cookie');

  clearRoute('../api/track/lyric');
  const trackLyricMissingIdHandler = require('../api/track/lyric');
  const trackLyricMissingIdRes = createRes();
  await trackLyricMissingIdHandler({ headers: {}, query: {} }, trackLyricMissingIdRes);
  assert.strictEqual(trackLyricMissingIdRes.statusCode, 400, 'track lyric should reject missing id');
  assert.deepStrictEqual(
    trackLyricMissingIdRes.body,
    { ok: false, error: 'MISSING_ID' },
    'track lyric should return MISSING_ID without id'
  );

  console.log('auth contract checks passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
