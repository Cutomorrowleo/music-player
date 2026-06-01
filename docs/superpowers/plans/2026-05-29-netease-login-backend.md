# NetEase Login Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure NetEase QR login, account-based recent top 6 tracks, and authenticated playback while preserving the existing EchoRoom layout.

**Architecture:** Keep the current single-page player and Vercel Node API shape. Add dedicated auth/session/music endpoints that store NetEase credentials server-side, then make `song.html` consume those endpoints through additive login UI only.

**Tech Stack:** Node.js CommonJS, Vercel API routes, `NeteaseCloudMusicApi`, built-in `crypto`, optional Upstash Redis/Vercel KV session adapter, existing browser JavaScript in `song.html`.

---

## File Structure

- Create `lib/sessionStore.js`: session cookie parsing, in-memory development store, encrypted NetEase Cookie storage, production adapter boundary.
- Create `lib/ncmClient.js`: safe wrapper around `NeteaseCloudMusicApi` functions with Cookie injection.
- Create `lib/trackNormalizer.js`: convert NetEase recent record results to the existing `{ nid, title, artist, cover, album, color }` slot shape.
- Create `api/auth/qr/start.js`: begin QR login.
- Create `api/auth/qr/status.js`: poll QR status and create a local session.
- Create `api/auth/me.js`: return current account state.
- Create `api/auth/logout.js`: clear local session.
- Create `api/me/recent-tracks.js`: return authenticated recent top 6 tracks.
- Create `api/track/url.js`: return account-authorized playback URL.
- Create `api/track/lyric.js`: optional lyric wrapper using existing NetEase lyric API.
- Modify `song.html`: add only top-center login/account button, login modal, and JavaScript integration; preserve existing layout rules.
- Modify `tests/music-player-regression.test.js`: add layout-freeze assertions for login UI.
- Create `tests/session-store.test.js`, `tests/track-normalizer.test.js`, and `tests/auth-contract.test.js`: focused backend contract tests.
- Modify `package.json`: add a `test` script that runs all focused Node tests.

## Task 1: Add Session Store Foundation

**Files:**
- Create: `lib/sessionStore.js`
- Test: `tests/session-store.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing session tests**

Create `tests/session-store.test.js`:

```js
const assert = require('assert');
const {
  createSessionCookie,
  parseSessionCookie,
  sealNcmCookie,
  unsealNcmCookie,
} = require('../lib/sessionStore');

const cookie = createSessionCookie('sess_abc123');
assert(cookie.includes('ncm_session=sess_abc123'), 'session cookie should contain opaque id');
assert(cookie.includes('HttpOnly'), 'session cookie must be HttpOnly');
assert(cookie.includes('Secure'), 'session cookie must be Secure');
assert(cookie.includes('SameSite=Lax'), 'session cookie must use SameSite=Lax');

assert.strictEqual(
  parseSessionCookie('theme=dark; ncm_session=sess_abc123; other=x'),
  'sess_abc123',
  'should parse ncm_session from cookie header'
);

process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef';
const sealed = sealNcmCookie('MUSIC_U=secret; __csrf=token');
assert.notStrictEqual(sealed, 'MUSIC_U=secret; __csrf=token', 'sealed value should not expose raw cookie');
assert.strictEqual(unsealNcmCookie(sealed), 'MUSIC_U=secret; __csrf=token', 'sealed cookie should decrypt');

console.log('session store checks passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node tests/session-store.test.js
```

Expected: `Cannot find module '../lib/sessionStore'`.

- [ ] **Step 3: Implement `lib/sessionStore.js`**

```js
const crypto = require('crypto');

const SESSION_COOKIE = 'ncm_session';
const memoryStore = new Map();

function getSecret() {
  const secret = process.env.SESSION_SECRET || 'dev-only-session-secret-32-bytes!!';
  return crypto.createHash('sha256').update(secret).digest();
}

function createSessionId() {
  return `sess_${crypto.randomBytes(24).toString('base64url')}`;
}

function createSessionCookie(sessionId, maxAgeSeconds = 60 * 60 * 24 * 7) {
  return `${SESSION_COOKIE}=${sessionId}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

function createClearCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function parseSessionCookie(cookieHeader = '') {
  const match = String(cookieHeader).match(/(?:^|;\s*)ncm_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function sealNcmCookie(rawCookie) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(String(rawCookie), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

function unsealNcmCookie(sealed) {
  const data = Buffer.from(String(sealed), 'base64url');
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getSecret(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

async function saveSession(sessionId, data) {
  memoryStore.set(sessionId, { ...data, updatedAt: Date.now() });
}

async function getSession(sessionId) {
  if (!sessionId) return null;
  return memoryStore.get(sessionId) || null;
}

async function deleteSession(sessionId) {
  memoryStore.delete(sessionId);
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
```

- [ ] **Step 4: Add the test script**

Modify `package.json` scripts:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js",
    "test": "node tests/music-player-regression.test.js && node tests/session-store.test.js"
  }
}
```

Later tasks extend this script when their test files are created.

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
node tests/session-store.test.js
```

Expected: `session store checks passed`.

- [ ] **Step 6: Commit**

```bash
git add lib/sessionStore.js tests/session-store.test.js package.json
git commit -m "Add secure session store foundation"
```

## Task 2: Add NetEase Client and Track Normalizer

**Files:**
- Create: `lib/ncmClient.js`
- Create: `lib/trackNormalizer.js`
- Test: `tests/track-normalizer.test.js`

- [ ] **Step 1: Write the failing normalizer test**

Create `tests/track-normalizer.test.js`:

```js
const assert = require('assert');
const { normalizeRecentTracks } = require('../lib/trackNormalizer');

const records = [
  {
    data: {
      id: 101,
      name: '年少有为',
      ar: [{ name: '李荣浩' }],
      al: { name: '耳朵', picUrl: 'https://img.example/cover.jpg' },
    },
  },
  {
    song: {
      id: 102,
      name: 'Fallback Shape',
      artists: [{ name: 'Artist B' }],
      album: { name: 'Album B', picUrl: 'https://img.example/b.jpg' },
    },
  },
];

const tracks = normalizeRecentTracks(records, 6);
assert.strictEqual(tracks.length, 2, 'should normalize available records');
assert.deepStrictEqual(tracks[0], {
  nid: 101,
  title: '年少有为',
  artist: '李荣浩',
  album: '耳朵',
  cover: 'https://img.example/cover.jpg',
});
assert.strictEqual(tracks[1].artist, 'Artist B');

console.log('track normalizer checks passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node tests/track-normalizer.test.js
```

Expected: `Cannot find module '../lib/trackNormalizer'`.

- [ ] **Step 3: Implement `lib/trackNormalizer.js`**

```js
function pickSong(record) {
  return record?.data || record?.song || record;
}

function pickArtists(song) {
  const artists = song?.ar || song?.artists || [];
  return artists.map((artist) => artist.name).filter(Boolean).join(' / ') || 'Unknown Artist';
}

function normalizeTrack(record) {
  const song = pickSong(record);
  if (!song || !song.id || !song.name) return null;
  const album = song.al || song.album || {};
  return {
    nid: song.id,
    title: song.name,
    artist: pickArtists(song),
    album: album.name || '',
    cover: album.picUrl || album.blurPicUrl || '',
  };
}

function normalizeRecentTracks(records, limit = 6) {
  return (Array.isArray(records) ? records : [])
    .map(normalizeTrack)
    .filter(Boolean)
    .slice(0, limit);
}

module.exports = { normalizeRecentTracks };
```

- [ ] **Step 4: Implement `lib/ncmClient.js`**

```js
const ncm = require('NeteaseCloudMusicApi');

async function callNcm(fnName, params = {}, ncmCookie = '') {
  const fn = ncm[fnName];
  if (typeof fn !== 'function') {
    const error = new Error(`Unknown NetEase API function: ${fnName}`);
    error.status = 404;
    throw error;
  }
  const response = await fn({
    ...params,
    cookie: ncmCookie || params.cookie,
  });
  return response.body;
}

module.exports = { callNcm };
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
node tests/track-normalizer.test.js
```

Expected: `track normalizer checks passed`.

- [ ] **Step 6: Commit**

```bash
git add lib/ncmClient.js lib/trackNormalizer.js tests/track-normalizer.test.js
git commit -m "Add NetEase client helpers"
```

## Task 3: Add Auth API Contract

**Files:**
- Create: `api/auth/qr/start.js`
- Create: `api/auth/qr/status.js`
- Create: `api/auth/me.js`
- Create: `api/auth/logout.js`
- Test: `tests/auth-contract.test.js`

- [ ] **Step 1: Write auth contract tests**

Create `tests/auth-contract.test.js`:

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const files = [
  'api/auth/qr/start.js',
  'api/auth/qr/status.js',
  'api/auth/me.js',
  'api/auth/logout.js',
];

for (const file of files) {
  const full = path.join(__dirname, '..', file);
  assert(fs.existsSync(full), `${file} should exist`);
  const source = fs.readFileSync(full, 'utf8');
  assert(/module\.exports\s*=\s*async function handler/.test(source), `${file} should export Vercel handler`);
}

const statusSource = fs.readFileSync(path.join(__dirname, '..', 'api/auth/qr/status.js'), 'utf8');
assert(/createSessionCookie/.test(statusSource), 'QR status should set local session cookie after success');
assert(/sealNcmCookie/.test(statusSource), 'QR status should seal NetEase cookie before storing');

const logoutSource = fs.readFileSync(path.join(__dirname, '..', 'api/auth/logout.js'), 'utf8');
assert(/createClearCookie/.test(logoutSource), 'logout should clear session cookie');

console.log('auth contract checks passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node tests/auth-contract.test.js
```

Expected: first missing auth route assertion fails.

- [ ] **Step 3: Implement QR start route**

Create `api/auth/qr/start.js`:

```js
const { callNcm } = require('../../../lib/ncmClient');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const keyBody = await callNcm('login_qr_key', { timestamp: Date.now() });
  const key = keyBody?.data?.unikey;
  if (!key) {
    res.status(502).json({ ok: false, error: 'QR_KEY_FAILED' });
    return;
  }

  const qrBody = await callNcm('login_qr_create', {
    key,
    qrimg: true,
    timestamp: Date.now(),
  });

  res.status(200).json({
    ok: true,
    key,
    qrimg: qrBody?.data?.qrimg || '',
    qrurl: qrBody?.data?.qrurl || '',
  });
};
```

- [ ] **Step 4: Implement QR status route**

Create `api/auth/qr/status.js`:

```js
const { callNcm } = require('../../../lib/ncmClient');
const {
  createSessionId,
  createSessionCookie,
  sealNcmCookie,
  saveSession,
} = require('../../../lib/sessionStore');

function cookieArrayToString(cookies) {
  return Array.isArray(cookies) ? cookies.map((cookie) => cookie.split(';')[0]).join('; ') : '';
}

module.exports = async function handler(req, res) {
  const key = req.query.key;
  if (!key) {
    res.status(400).json({ ok: false, error: 'MISSING_KEY' });
    return;
  }

  const body = await callNcm('login_qr_check', {
    key,
    noCookie: true,
    timestamp: Date.now(),
  });

  if (body.code !== 803) {
    res.status(200).json({ ok: true, code: body.code, message: body.message || '' });
    return;
  }

  const ncmCookie = cookieArrayToString(body.cookie);
  const sessionId = createSessionId();
  const accountBody = await callNcm('user_account', {}, ncmCookie);
  const profile = accountBody?.profile || {};

  await saveSession(sessionId, {
    uid: profile.userId,
    nickname: profile.nickname || '网易云用户',
    avatarUrl: profile.avatarUrl || '',
    sealedCookie: sealNcmCookie(ncmCookie),
    createdAt: Date.now(),
  });

  res.setHeader('Set-Cookie', createSessionCookie(sessionId));
  res.status(200).json({
    ok: true,
    code: 803,
    loggedIn: true,
    user: {
      uid: profile.userId,
      nickname: profile.nickname || '网易云用户',
      avatarUrl: profile.avatarUrl || '',
    },
  });
};
```

- [ ] **Step 5: Implement `me` and `logout` routes**

Create `api/auth/me.js`:

```js
const { parseSessionCookie, getSession } = require('../../lib/sessionStore');

module.exports = async function handler(req, res) {
  const sessionId = parseSessionCookie(req.headers.cookie || '');
  const session = await getSession(sessionId);
  if (!session) {
    res.status(200).json({ loggedIn: false });
    return;
  }

  res.status(200).json({
    loggedIn: true,
    user: {
      uid: session.uid,
      nickname: session.nickname,
      avatarUrl: session.avatarUrl,
    },
  });
};
```

Create `api/auth/logout.js`:

```js
const { parseSessionCookie, deleteSession, createClearCookie } = require('../../lib/sessionStore');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const sessionId = parseSessionCookie(req.headers.cookie || '');
  await deleteSession(sessionId);
  res.setHeader('Set-Cookie', createClearCookie());
  res.status(200).json({ ok: true });
};
```

- [ ] **Step 6: Run auth contract test**

Run:

```bash
node tests/auth-contract.test.js
```

Expected: `auth contract checks passed`.

- [ ] **Step 7: Commit**

```bash
git add api/auth lib tests/auth-contract.test.js
git commit -m "Add NetEase QR auth API"
```

## Task 4: Add Authenticated Music API

**Files:**
- Create: `api/me/recent-tracks.js`
- Create: `api/track/url.js`
- Create: `api/track/lyric.js`

- [ ] **Step 1: Implement shared session read pattern in each route**

Use this pattern inside each route:

```js
const {
  parseSessionCookie,
  getSession,
  unsealNcmCookie,
} = require('../../lib/sessionStore');

async function getNcmCookie(req) {
  const sessionId = parseSessionCookie(req.headers.cookie || '');
  const session = await getSession(sessionId);
  if (!session?.sealedCookie) return '';
  return unsealNcmCookie(session.sealedCookie);
}
```

- [ ] **Step 2: Implement recent tracks route**

Create `api/me/recent-tracks.js`:

```js
const { callNcm } = require('../../lib/ncmClient');
const { normalizeRecentTracks } = require('../../lib/trackNormalizer');
const { parseSessionCookie, getSession, unsealNcmCookie } = require('../../lib/sessionStore');

module.exports = async function handler(req, res) {
  const sessionId = parseSessionCookie(req.headers.cookie || '');
  const session = await getSession(sessionId);
  if (!session?.sealedCookie || !session.uid) {
    res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' });
    return;
  }

  const limit = Math.min(Number(req.query.limit || 6), 6);
  const ncmCookie = unsealNcmCookie(session.sealedCookie);
  const body = await callNcm('record_recent_song', { limit }, ncmCookie);
  const records = body?.data?.list || body?.data || [];

  res.status(200).json({
    ok: true,
    tracks: normalizeRecentTracks(records, limit),
  });
};
```

- [ ] **Step 3: Implement playback URL route**

Create `api/track/url.js`:

```js
const { callNcm } = require('../../lib/ncmClient');
const { parseSessionCookie, getSession, unsealNcmCookie } = require('../../lib/sessionStore');

module.exports = async function handler(req, res) {
  const id = req.query.id;
  if (!id) {
    res.status(400).json({ ok: false, error: 'MISSING_ID' });
    return;
  }

  const sessionId = parseSessionCookie(req.headers.cookie || '');
  const session = await getSession(sessionId);
  const ncmCookie = session?.sealedCookie ? unsealNcmCookie(session.sealedCookie) : '';
  const body = await callNcm('song_url_v1', {
    id,
    level: req.query.level || 'exhigh',
    realIP: req.query.realIP || '116.25.146.177',
  }, ncmCookie);

  const item = Array.isArray(body?.data) ? body.data[0] : null;
  if (!item?.url) {
    res.status(403).json({
      ok: false,
      error: 'NO_PLAY_PERMISSION',
      code: item?.code || body?.code || 403,
      message: '当前账号无权播放该音质或歌曲',
    });
    return;
  }

  res.status(200).json({ ok: true, data: [item] });
};
```

- [ ] **Step 4: Implement lyric route**

Create `api/track/lyric.js`:

```js
const { callNcm } = require('../../lib/ncmClient');

module.exports = async function handler(req, res) {
  if (!req.query.id) {
    res.status(400).json({ ok: false, error: 'MISSING_ID' });
    return;
  }
  const body = await callNcm('lyric', { id: req.query.id });
  res.status(200).json(body);
};
```

- [ ] **Step 5: Commit**

```bash
git add api/me api/track
git commit -m "Add authenticated music endpoints"
```

## Task 5: Add Login UI Without Layout Changes

**Files:**
- Modify: `song.html`
- Modify: `tests/music-player-regression.test.js`

- [ ] **Step 1: Extend regression test before editing UI**

Append these assertions to `tests/music-player-regression.test.js`:

```js
assert(
  /id=["']ncm-login-btn["']/.test(html),
  'top-center NetEase login button should exist'
);

const loginButtonRule = extractCssRule('.ncm-login-btn');
assert(
  /position\s*:\s*fixed/.test(loginButtonRule) &&
  /top\s*:\s*20px/.test(loginButtonRule) &&
  /left\s*:\s*50%/.test(loginButtonRule),
  'login button should be fixed at top center, aligned with corner controls'
);

assert(
  !/body\.logged-in\s+\.icon-cards/.test(html) &&
  !/body\.ncm-login-open\s+\.icon-cards/.test(html),
  'login state should not alter carousel layout'
);
```

- [ ] **Step 2: Run regression test to verify it fails**

Run:

```bash
node tests/music-player-regression.test.js
```

Expected: failure that `top-center NetEase login button should exist`.

- [ ] **Step 3: Add top-center button markup**

Insert near the existing top controls in `song.html`:

```html
<button id="ncm-login-btn" class="ncm-login-btn" type="button" aria-label="登录网易云">
    登录网易云
</button>
```

- [ ] **Step 4: Add modal markup**

Insert near the existing overlays:

```html
<div id="ncm-login-overlay" class="ncm-login-overlay" aria-hidden="true">
    <div class="ncm-login-panel" onclick="event.stopPropagation()">
        <h2 class="ncm-login-title">登录网易云</h2>
        <p class="ncm-login-subtitle">扫码同步最近常听和会员播放权限</p>
        <div id="ncm-login-qr" class="ncm-login-qr"></div>
        <p id="ncm-login-status" class="ncm-login-status">等待扫码</p>
        <div class="ncm-login-steps">
            <span>打开网易云音乐</span>
            <span>扫一扫</span>
            <span>确认登录</span>
        </div>
        <div class="ncm-login-actions">
            <button id="ncm-login-refresh" type="button">刷新</button>
            <button id="ncm-login-cancel" type="button">取消</button>
        </div>
        <p class="ncm-login-note">仅保存加密会话，不暴露 Cookie</p>
    </div>
</div>
```

- [ ] **Step 5: Add isolated CSS**

Add CSS without touching existing selectors:

```css
.ncm-login-btn {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    min-width: 92px;
    height: 42px;
    border-radius: 999px;
    border: 1px solid var(--track-accent-line);
    background: rgba(22,20,20,0.38);
    color: var(--track-accent);
    font-family: var(--font-heading);
    font-size: 0.52rem;
    letter-spacing: 0.12em;
    padding: 0 16px;
    z-index: 100;
    cursor: pointer;
    box-shadow: inset 0 0 16px rgba(245,230,208,0.035), 0 0 24px var(--track-accent-glow);
}
.ncm-login-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: none;
    align-items: center;
    justify-content: center;
    background: rgba(3,3,3,0.58);
}
.ncm-login-overlay.active { display: flex; }
.ncm-login-panel {
    width: min(360px, calc(100vw - 40px));
    border-radius: 8px;
    border: 1px solid var(--track-accent-line);
    background: rgba(22,20,20,0.92);
    color: var(--cream);
    padding: 24px;
    text-align: center;
}
.ncm-login-title { font-size: 1rem; margin: 0 0 8px; }
.ncm-login-subtitle,
.ncm-login-status,
.ncm-login-note,
.ncm-login-steps { font-size: 0.68rem; color: rgba(245,230,208,0.58); }
.ncm-login-qr {
    width: 188px;
    height: 188px;
    margin: 18px auto 12px;
    border-radius: 6px;
    background: rgba(245,230,208,0.92);
    display: grid;
    place-items: center;
    overflow: hidden;
}
.ncm-login-qr img { width: 100%; height: 100%; object-fit: cover; }
.ncm-login-steps { display: flex; justify-content: space-between; gap: 8px; margin: 14px 0; }
.ncm-login-actions { display: flex; gap: 8px; justify-content: center; }
.ncm-login-actions button {
    height: 34px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--cream);
    padding: 0 14px;
    cursor: pointer;
}
```

- [ ] **Step 6: Add login JavaScript**

Add script functions near the current VIP helpers:

```js
let ncmLoginKey = '';
let ncmLoginTimer = null;
let ncmUser = null;

async function fetchNcmMe() {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    ncmUser = data.loggedIn ? data.user : null;
    renderNcmLoginState();
    if (ncmUser) loadRecentTracksFromAccount();
}

function renderNcmLoginState() {
    const btn = document.getElementById('ncm-login-btn');
    btn.textContent = ncmUser?.nickname || '登录网易云';
    btn.setAttribute('aria-label', ncmUser ? `网易云账号：${ncmUser.nickname}` : '登录网易云');
}

async function openNcmLogin() {
    if (ncmUser) return;
    document.getElementById('ncm-login-overlay').classList.add('active');
    await startNcmQrLogin();
}

function closeNcmLogin() {
    document.getElementById('ncm-login-overlay').classList.remove('active');
    clearInterval(ncmLoginTimer);
    ncmLoginTimer = null;
}

async function startNcmQrLogin() {
    const res = await fetch('/api/auth/qr/start', { method: 'POST', credentials: 'include' });
    const data = await res.json();
    ncmLoginKey = data.key;
    document.getElementById('ncm-login-qr').innerHTML = data.qrimg ? `<img src="${data.qrimg}" alt="网易云登录二维码">` : '';
    document.getElementById('ncm-login-status').textContent = '等待扫码';
    clearInterval(ncmLoginTimer);
    ncmLoginTimer = setInterval(checkNcmQrLogin, 2200);
}

async function checkNcmQrLogin() {
    if (!ncmLoginKey) return;
    const res = await fetch(`/api/auth/qr/status?key=${encodeURIComponent(ncmLoginKey)}`, { credentials: 'include' });
    const data = await res.json();
    if (data.code === 802) document.getElementById('ncm-login-status').textContent = '请在网易云音乐中确认登录';
    if (data.code === 800) document.getElementById('ncm-login-status').textContent = '二维码已过期';
    if (data.loggedIn) {
        ncmUser = data.user;
        renderNcmLoginState();
        closeNcmLogin();
        loadRecentTracksFromAccount();
        showToast('网易云登录成功');
    }
}

document.getElementById('ncm-login-btn').addEventListener('click', openNcmLogin);
document.getElementById('ncm-login-refresh').addEventListener('click', startNcmQrLogin);
document.getElementById('ncm-login-cancel').addEventListener('click', closeNcmLogin);
document.getElementById('ncm-login-overlay').addEventListener('click', closeNcmLogin);
```

- [ ] **Step 7: Run regression test**

Run:

```bash
node tests/music-player-regression.test.js
```

Expected: `music player regression checks passed`.

- [ ] **Step 8: Commit**

```bash
git add song.html tests/music-player-regression.test.js
git commit -m "Add additive NetEase login UI"
```

## Task 6: Wire Recent Tracks and Authenticated Playback

**Files:**
- Modify: `song.html`

- [ ] **Step 1: Add recent-track loader without changing layout**

Add:

```js
async function loadRecentTracksFromAccount() {
    try {
        const res = await fetch('/api/me/recent-tracks?limit=6', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data.tracks) || data.tracks.length === 0) return;
        slots = data.tracks.map((track, index) => ({
            ...track,
            color: SLOT_COLORS[index % SLOT_COLORS.length],
        }));
        currentIdx = 0;
        renderCards();
        updateContentTransform();
        updateTrackInfo();
        if (lyricsMode) loadLyricsForCurrent();
    } catch (error) {
        showToast('最近常听加载失败');
    }
}
```

- [ ] **Step 2: Replace playback URL request**

Change the existing playback fetch from:

```js
const res = await apiFetch(`/song/url/v1?id=${track.nid}&level=${level}&realIP=${NCM_REAL_IP}`);
```

to:

```js
const res = await fetch(`/api/track/url?id=${track.nid}&level=${level}&realIP=${NCM_REAL_IP}`, { credentials: 'include' });
```

Keep the rest of the parsing compatible with `{ ok: true, data: [...] }`.

- [ ] **Step 3: Replace lyric request**

Change:

```js
const res = await apiFetch(`/lyric?id=${track.nid}`);
```

to:

```js
const res = await fetch(`/api/track/lyric?id=${track.nid}`, { credentials: 'include' });
```

- [ ] **Step 4: Initialize account state on boot**

Inside the existing `init().then(...)` boot block, add:

```js
fetchNcmMe();
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test
```

Expected: all focused checks pass.

- [ ] **Step 6: Commit**

```bash
git add song.html
git commit -m "Use account recent tracks and playback"
```

## Task 7: Local and Visual Verification

**Files:**
- No source edits expected unless verification finds a bug.

- [ ] **Step 1: Start local server**

Run:

```bash
npm start
```

Expected: server logs `http://localhost:3000`.

- [ ] **Step 2: Verify default page**

Open `http://localhost:3000`.

Expected:

- Top-center `登录网易云` button is aligned with the top-left star button and top-right reactive button.
- Existing EchoRoom title, carousel, album art, song title, controls, and corner buttons have not moved.

- [ ] **Step 3: Verify login modal**

Click `登录网易云`.

Expected:

- Modal matches current dark cream/yellow style.
- Base page is dimmed but not reflowed.
- QR appears or a controlled error is shown.

- [ ] **Step 4: Verify after login**

Scan with NetEase Cloud Music.

Expected:

- Button changes to the NetEase nickname.
- Recent top 6 tracks replace current slots without changing carousel geometry.
- Playback works for tracks the account can access.
- Permission failures show a toast and do not crash the player.

- [ ] **Step 5: Run final tests**

Run:

```bash
npm test
```

Expected: all checks pass.

- [ ] **Step 6: Commit verification fixes if needed**

```bash
git add <fixed-files>
git commit -m "Fix NetEase login verification issues"
```

## Task 8: Production Configuration and Deploy

**Files:**
- Modify only deployment environment variables outside source control.

- [ ] **Step 1: Set session secret**

Set `SESSION_SECRET` in Vercel production and preview environments. Use a random value at least 32 characters long.

- [ ] **Step 2: Configure production session adapter**

If using Upstash/Vercel KV, add the provider environment variables and update `lib/sessionStore.js` to use Redis/KV when those variables exist, with the existing in-memory store as local fallback.

- [ ] **Step 3: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 4: Confirm Vercel deployment**

Expected:

- Vercel production deployment reaches `READY`.
- Production URL loads.
- Login button is visible in the approved top-center position.

## Self-Review Checklist

- Every requirement in `docs/superpowers/specs/2026-05-29-netease-login-design.md` maps to a task above.
- No step changes the existing carousel/title/playback layout.
- No task stores NetEase Cookie in front-end JavaScript.
- The plan has explicit tests before implementation where practical.
- Production secret handling is outside source control.
