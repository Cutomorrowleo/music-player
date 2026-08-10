const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'song.html'), 'utf8');
const vercelConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));

const genericNcmRoute = vercelConfig.routes.find((route) => route.src === '/api/(.*)');
assert.strictEqual(
  genericNcmRoute?.dest,
  '/api/[...ncm].js?ncm=$1',
  'Vercel should route public music API paths to the generated catch-all function file'
);

const authMeRoute = vercelConfig.routes.find((route) => route.src === '/api/auth/me');
assert.strictEqual(
  authMeRoute?.dest,
  '/api/auth/me.js',
  'Vercel should route dedicated APIs to their generated function files before the catch-all route'
);

assert(
  /const\s+API\s*=\s*['"]\/api['"]/.test(html),
  'browser requests should use the Vercel /api function prefix so the player page can be served statically'
);

const apiFetch = extractFunction('apiFetch');
assert(
  /noCookie=1/.test(apiFetch),
  'anonymous public API requests should opt out of cookies so Vercel can cache metadata safely'
);

assert(
  /DEFAULT_SLOTS\.map\(\(slot\)\s*=>\s*slot\.nid\)\.join\(['"],['"]\)/.test(html) &&
  /apiFetch\(`\/song\/detail\?ids=\$\{encodeURIComponent\(ids\)\}/.test(html),
  'initial song details should be fetched in one batched request instead of six function calls'
);

assert(
  /@media\s*\(max-width:\s*600px\)[\s\S]*\.paper-bg,\s*\.grain-overlay\s*\{\s*display:\s*none/.test(html),
  'mobile layout should disable the full-screen SVG grain filters to avoid scroll and animation jank'
);

function extractFunction(name) {
  const start = html.indexOf(`function ${name}`);
  assert.notStrictEqual(start, -1, `${name} should exist`);
  const braceStart = html.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}') depth--;
    if (depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`${name} body should close`);
}

function extractCssRule(selector) {
  const start = html.indexOf(selector);
  assert.notStrictEqual(start, -1, `${selector} CSS rule should exist`);
  const braceStart = html.indexOf('{', start);
  const braceEnd = html.indexOf('}', braceStart);
  return html.slice(braceStart + 1, braceEnd);
}

function extractInitThenBlock() {
  const start = html.indexOf('init().then(() =>');
  assert.notStrictEqual(start, -1, 'init().then boot block should exist');
  const braceStart = html.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}') depth--;
    if (depth === 0) return html.slice(start, i + 1);
  }
  throw new Error('init().then boot block should close');
}

const updateCardScales = extractFunction('updateCardScales');
assert(
  /dataset\.index/.test(updateCardScales) || /getAttribute\(['"]data-index['"]\)/.test(updateCardScales),
  'updateCardScales should use each card data-index, not the DOM position, so the active cover remains visible after pausing in lyrics mode'
);

const lyricsListRule = extractCssRule('.lyrics-list');
assert(
  /overflow-y\s*:\s*auto/.test(lyricsListRule),
  'lyrics list should allow vertical scrolling'
);
assert(
  /padding\s*:\s*0\s+44px\s+96px\s+12px/.test(lyricsListRule),
  'desktop lyrics list should not push the first lyric below the EchoRoom heading'
);

const lyricsPanelRule = extractCssRule('.lyrics-panel');
assert(
  /overflow\s*:\s*visible/.test(lyricsPanelRule),
  'lyrics panel should not create an invisible clipped frame'
);

assert(
  !/id=["']lyrics-close["']/.test(html) && !/class=["']lyrics-close["']/.test(html),
  'lyrics close button should not be rendered'
);

const syncLyricScroll = extractFunction('syncLyricScroll');
assert(
  !/style\.transform/.test(syncLyricScroll) && /(scrollTo|scrollTop)/.test(syncLyricScroll),
  'lyric auto-sync should use native scrolling instead of translating the scroll container'
);

assert(
  /<h1>\s*EchoRoom\s*<\/h1>/.test(html),
  'player heading should display EchoRoom'
);

const lyricsModeRule = extractCssRule('body.lyrics-mode');
assert(
  /--lyrics-left-top\s*:\s*var\(--lyrics-panel-top\)/.test(lyricsModeRule),
  'lyrics mode should align the left player module top to the right lyrics panel top'
);

const lyricsModeHeadingRule = extractCssRule('body.lyrics-mode h1');
assert(
  /top\s*:\s*var\(--lyrics-left-top\)/.test(lyricsModeHeadingRule),
  'lyrics mode heading should use the shared left module top'
);

assert(
  !/\.lyrics-list\s*\{\s*padding\s*:\s*60px\s+12px\s+72px/.test(html),
  'mobile lyrics list should not keep the old top padding that misaligns the first lyric'
);

assert(
  /id=["']ncm-login-btn["']/.test(html),
  'NetEase Cloud login button should be rendered'
);

assert(
  /<button\s+id=["']ncm-login-btn["'][^>]*>\s*登录网易云\s*<\/button>/.test(html),
  'NetEase Cloud login button should default to 登录网易云'
);

const ncmLoginBtnRule = extractCssRule('.ncm-login-btn');
assert(
  /position\s*:\s*fixed/.test(ncmLoginBtnRule),
  'NetEase Cloud login button should be fixed and not affect layout flow'
);
assert(
  /top\s*:\s*20px/.test(ncmLoginBtnRule),
  'NetEase Cloud login button should align with the top control row'
);
assert(
  /left\s*:\s*50%/.test(ncmLoginBtnRule),
  'NetEase Cloud login button should be horizontally centered'
);
assert(
  /height\s*:\s*42px/.test(ncmLoginBtnRule),
  'NetEase Cloud login button should keep the frozen top control height'
);
assert(
  /transform\s*:\s*translateX\(-50%\)/.test(ncmLoginBtnRule),
  'NetEase Cloud login button should use translateX(-50%) centering'
);

const trackTitleRule = extractCssRule('#track-title');
assert(
  /overflow\s*:\s*hidden/.test(trackTitleRule) &&
  /-webkit-line-clamp\s*:\s*2/.test(trackTitleRule) &&
  !/(mask-image|-webkit-mask-image)\s*:/.test(trackTitleRule),
  'normal song and artist titles should be clamped without bottom fade'
);
const trackTitleFadeRule = extractCssRule('.track-title-fade');
assert(
  /-webkit-mask-image\s*:\s*linear-gradient\(to bottom,\s*#000 0%,\s*#000 72%,\s*transparent 100%\)/.test(trackTitleFadeRule) &&
  /mask-image\s*:\s*linear-gradient\(to bottom,\s*#000 0%,\s*#000 72%,\s*transparent 100%\)/.test(trackTitleFadeRule),
  'only long song and artist titles should opt into bottom fade before they cover the controls'
);

assert(
  /@media\s*\(max-width:\s*600px\)[\s\S]*\.ncm-login-btn\s*\{[\s\S]*max-width\s*:\s*34vw[\s\S]*\}/.test(html),
  'mobile login nickname should be constrained so it does not cover the EchoRoom heading'
);
assert(
  /@media\s*\(max-width:\s*600px\)[\s\S]*h1\s*\{[\s\S]*top\s*:\s*calc\(env\(safe-area-inset-top,\s*0px\)\s*\+\s*76px\)/.test(html),
  'mobile EchoRoom heading should sit below the top control row instead of under the login button'
);
assert(
  /@media\s*\(max-width:\s*600px\)[\s\S]*#track-title\s*\{[\s\S]*left\s*:\s*50%[\s\S]*transform\s*:\s*translateX\(-50%\)[\s\S]*text-align\s*:\s*center[\s\S]*box-sizing\s*:\s*border-box[\s\S]*\}/.test(html),
  'mobile track title should be centered above the controls with stable width and box sizing'
);
assert(
  /@media\s*\(max-width:\s*600px\)[\s\S]*#track-title\s*\{[\s\S]*bottom\s*:\s*126px[\s\S]*left\s*:\s*50%/.test(html),
  'mobile track title should be lifted into the blank space above the existing control area without moving the controls'
);
assert(
  /@media\s*\(max-width:\s*600px\)[\s\S]*body\.lyrics-mode\s+#track-title\s*\{[\s\S]*left\s*:\s*50%[\s\S]*transform\s*:\s*translateX\(-50%\)[\s\S]*\}/.test(html),
  'mobile lyrics-mode track title should keep the same centered alignment'
);
assert(
  /@media\s*\(max-width:\s*600px\)[\s\S]*body\.lyrics-mode\s+\.drag-hint\s*\{[\s\S]*display\s*:\s*none[\s\S]*\}/.test(html),
  'mobile lyrics mode should hide the swipe hint under the lyrics'
);

const soundWaveRule = extractCssRule('.sound-wave');
assert(
  /position\s*:\s*fixed/.test(soundWaveRule) &&
  /bottom\s*:\s*24px/.test(soundWaveRule) &&
  /left\s*:\s*24px/.test(soundWaveRule),
  'sound wave visualizer should keep the desktop bottom-left anchored implementation'
);
assert(
  /soundWave\.classList\.toggle\(['"]active['"],\s*p\)/.test(html),
  'sound wave visualizer should keep following playback through the existing active class'
);
assert(
  /@media\s*\(max-width:\s*600px\)[\s\S]*\.sound-wave\s*\{[\s\S]*display\s*:\s*flex[\s\S]*left\s*:\s*20px[\s\S]*bottom\s*:\s*18px[\s\S]*\}/.test(html),
  'mobile main and lyrics pages should show the same playback-following sound wave component in the lower-left corner'
);

assert(
  /id=["']ncm-login-overlay["']/.test(html),
  'NetEase Cloud login overlay should be rendered'
);
assert(
  /id=["']ncm-login-overlay["'][^>]*(role=["']dialog["']|aria-modal=["']true["']|aria-labelledby=["']ncm-login-title["'])/s.test(html) ||
  /id=["']ncm-login-overlay["'][^>]*role=["']dialog["'][^>]*aria-modal=["']true["'][^>]*aria-labelledby=["']ncm-login-title["']/s.test(html) ||
  /class=["']ncm-login-panel["'][^>]*role=["']dialog["'][^>]*aria-modal=["']true["'][^>]*aria-labelledby=["']ncm-login-title["']/s.test(html),
  'NetEase Cloud login dialog should expose role, aria-modal, and aria-labelledby'
);
assert(
  /id=["']ncm-login-title["']/.test(html),
  'NetEase Cloud login title should have an id for aria-labelledby'
);
[
  'ncm-qr-view',
  'ncm-account-view',
  'ncm-playlist-list',
  'ncm-track-list',
  'ncm-logout-btn',
  'ncm-account-close',
].forEach((id) => {
  assert(
    new RegExp(`id=["']${id}["']`).test(html),
    `NetEase Cloud account modal should include #${id}`
  );
});

assert(
  /<button\s+id=["']ncm-account-close["'][^>]*class=["']popup-close[^"']*["'][^>]*aria-label=["']关闭["']/s.test(html),
  'NetEase Cloud account modal should use the existing round popup-close button style for the top-right close action'
);

const ncmAccountScrollRule = extractCssRule('.ncm-playlist-list,');
assert(
  /scrollbar-width\s*:\s*thin/.test(ncmAccountScrollRule) &&
  /scrollbar-color\s*:\s*var\(--track-accent\)\s+transparent/.test(ncmAccountScrollRule),
  'NetEase Cloud account lists should use the same themed Firefox scrollbar colors as the frontend'
);
['.ncm-playlist-list::-webkit-scrollbar', '.ncm-track-list::-webkit-scrollbar'].forEach((selector) => {
  const rule = extractCssRule(selector);
  assert(/width\s*:\s*5px/.test(rule), `${selector} should match the frontend thin scrollbar width`);
});
['.ncm-playlist-list::-webkit-scrollbar-track', '.ncm-track-list::-webkit-scrollbar-track'].forEach((selector) => {
  const rule = extractCssRule(selector);
  assert(/background\s*:\s*transparent/.test(rule), `${selector} should use a transparent track`);
});
['.ncm-playlist-list::-webkit-scrollbar-thumb', '.ncm-track-list::-webkit-scrollbar-thumb'].forEach((selector) => {
  const rule = extractCssRule(selector);
  assert(
    /background\s*:\s*var\(--track-accent\)/.test(rule) && /border-radius\s*:\s*999px/.test(rule),
    `${selector} should use the active accent thumb with rounded ends`
  );
});

[
  '登录网易云',
  '扫码同步最近常听和会员播放权限',
  '等待扫码',
  '打开网易云音乐',
  '扫一扫',
  '确认登录',
  '刷新',
  '取消',
  '仅保存加密会话，不暴露 Cookie',
].forEach((text) => {
  assert(
    html.includes(text),
    `NetEase Cloud login modal should include required text: ${text}`
  );
});

['ncmLoginKey', 'ncmLoginTimer', 'ncmUser'].forEach((name) => {
  assert(
    new RegExp(`let\\s+${name}\\b`).test(html),
    `${name} state variable should be declared`
  );
});

[
  'fetchNcmMe',
  'renderNcmLoginState',
  'openNcmLogin',
  'openNcmAccount',
  'loadAccountTracksForHome',
  'loadNcmPlaylists',
  'loadNcmPlaylistTracks',
  'applyAccountTracksToHome',
  'renderNcmPlaylists',
  'renderNcmPlaylistTracks',
  'logoutNcm',
  'closeNcmLogin',
  'startNcmQrLogin',
  'checkNcmQrLogin',
].forEach((name) => {
  extractFunction(name);
});

const fetchNcmMe = extractFunction('fetchNcmMe');
assert(
  /fetch\(['"]\/api\/auth\/me['"]\s*,\s*\{[^}]*credentials\s*:\s*['"]include['"][^}]*\}/s.test(fetchNcmMe),
  'fetchNcmMe should call /api/auth/me with credentials include'
);
assert(
  /renderNcmLoginState\(\)[\s\S]*if\s*\(\s*ncmUser\s*&&\s*typeof\s+loadRecentTracksFromAccount\s*===\s*['"]function['"]\s*\)[\s\S]*loadRecentTracksFromAccount\(\)/.test(fetchNcmMe),
  'fetchNcmMe should call loadRecentTracksFromAccount with a typeof guard when ncmUser exists'
);

const loadRecentTracksFromAccount = extractFunction('loadRecentTracksFromAccount');
const loadAccountTracksForHome = extractFunction('loadAccountTracksForHome');
const applyAccountTracksToHome = extractFunction('applyAccountTracksToHome');
const updateTrackInfo = extractFunction('updateTrackInfo');
const updateTrackTitleFade = extractFunction('updateTrackTitleFade');
const sanitizeRecentTrack = extractFunction('sanitizeRecentTrack');
const isValidTrackCover = extractFunction('isValidTrackCover');
assert(
  /trackTitle\.classList\.remove\(['"]track-title-fade['"]\)/.test(updateTrackInfo) &&
  /updateTrackTitleFade\(\)/.test(updateTrackInfo),
  'updateTrackInfo should reset title fade and re-evaluate it after each song change'
);
assert(
  /const\s+shouldFade\s*=/.test(updateTrackTitleFade) &&
  /trackTitle\.classList\.toggle\(['"]track-title-fade['"],\s*shouldFade\)/.test(updateTrackTitleFade),
  'updateTrackTitleFade should toggle the fade class only when the rendered title needs protection'
);
assert(
  /fetch\(['"]\/api\/me\/recent-tracks\?limit=6['"]\s*,\s*\{[^}]*credentials\s*:\s*['"]include['"][^}]*\}/s.test(loadRecentTracksFromAccount),
  'loadRecentTracksFromAccount should fetch recent tracks with credentials include'
);
assert(
  /loadAccountTracksForHome\(\)/.test(loadRecentTracksFromAccount) &&
  /applyAccountTracksToHome\(tracks\)/.test(loadRecentTracksFromAccount),
  'loadRecentTracksFromAccount should fall back to account playlist tracks and then apply the resulting six tracks'
);
assert(
  /fetch\(['"]\/api\/me\/playlists['"]\s*,\s*\{[^}]*credentials\s*:\s*['"]include['"][^}]*\}/s.test(loadAccountTracksForHome) &&
  /fetch\(\s*`\/api\/playlist\/tracks\?id=\$\{encodeURIComponent\(playlistId\)\}&limit=6`\s*,\s*\{[^}]*credentials\s*:\s*['"]include['"][^}]*\}/s.test(loadAccountTracksForHome),
  'loadAccountTracksForHome should fetch the first playlist and its first six songs with credentials include'
);
assert(
  /if\s*\(\s*!Array\.isArray\(tracks\)\s*\|\|\s*!tracks\.length\s*\)\s*return\s+false/.test(applyAccountTracksToHome),
  'applyAccountTracksToHome should report false when there are no account tracks to apply'
);
assert(
  /SLOT_COLORS\s*\[\s*index\s*%\s*SLOT_COLORS\.length\s*\]/.test(applyAccountTracksToHome),
  'applyAccountTracksToHome should assign slot colors from SLOT_COLORS by index'
);
assert(
  /currentIdx\s*=\s*0/.test(applyAccountTracksToHome) &&
  /replaceIdx\s*=\s*0/.test(applyAccountTracksToHome),
  'applyAccountTracksToHome should reset currentIdx and replaceIdx'
);
assert(
  /slice\(0,\s*6\)/.test(applyAccountTracksToHome) &&
  /(while|for)\s*\([^)]*\.length\s*<\s*6/.test(applyAccountTracksToHome) &&
  /slots\s*=\s*nextSlots/.test(applyAccountTracksToHome),
  'applyAccountTracksToHome should build exactly 6 slots before replacing slots'
);
assert(
  /track\?\.nid/.test(sanitizeRecentTrack) &&
  /Unknown Track/.test(sanitizeRecentTrack) &&
  /Unknown Artist/.test(sanitizeRecentTrack),
  'loadRecentTracksFromAccount should require nid and sanitize title and artist fallbacks'
);
assert(
  /isValidTrackCover/.test(sanitizeRecentTrack) &&
  /fixCover\(track\.cover\)/.test(sanitizeRecentTrack) &&
  /\?\s*fixCover\(track\.cover\)\s*:\s*''/.test(sanitizeRecentTrack) &&
  /https\?:\\\/\\\/\|data:image\\\//.test(isValidTrackCover),
  'loadRecentTracksFromAccount should blank invalid covers so gradient fallback works'
);
assert(
  /if\s*\(\s*isPlaying\s*\)\s*loadAndPlay\(slots\[0\]\)/.test(applyAccountTracksToHome),
  'applyAccountTracksToHome should reload audio for the displayed account track when already playing'
);
[
  'renderCards',
  'updateContentTransform',
  'updateSlotDots',
  'updateTrackInfo',
  'updateLavaColors',
].forEach((name) => {
  assert(
    new RegExp(`${name}\\(\\)`).test(applyAccountTracksToHome),
    `applyAccountTracksToHome should call ${name}()`
  );
});
assert(
  /if\s*\(\s*lyricsMode\s*\)\s*loadLyricsForCurrent\(\)/.test(applyAccountTracksToHome),
  'applyAccountTracksToHome should reload lyrics only when lyricsMode is active'
);

const loadLyricsForCurrent = extractFunction('loadLyricsForCurrent');
assert(
  /fetch\(\s*`\/api\/track\/lyric\?id=\$\{track\.nid\}`\s*,\s*\{[^}]*credentials\s*:\s*['"]include['"][^}]*\}/s.test(loadLyricsForCurrent),
  'loadLyricsForCurrent should use /api/track/lyric with credentials include'
);
assert(
  !/apiFetch\(\s*`\/lyric/.test(loadLyricsForCurrent),
  'loadLyricsForCurrent should no longer call apiFetch(`/lyric`)'
);

const loadAndPlay = extractFunction('loadAndPlay');
const goTo = extractFunction('goTo');
const restoreDisplayedTrack = extractFunction('restoreDisplayedTrack');
assert(
  /let\s+playingIdx\s*=\s*null/.test(html) &&
  /let\s+playRequestSeq\s*=\s*0/.test(html),
  'player should track the currently playing slot and guard stale play requests'
);
assert(
  /const\s+previousIdx\s*=\s*currentIdx/.test(goTo) &&
  /const\s+requestedIdx\s*=\s*currentIdx/.test(goTo) &&
  /const\s+rollbackIdx\s*=\s*Number\.isInteger\(playingIdx\)\s*\?\s*playingIdx\s*:\s*previousIdx/.test(goTo),
  'goTo should remember the current playing/displayed song before attempting an autoplay switch'
);
assert(
  /const\s+playStarted\s*=\s*await\s+loadAndPlay\(slots\[requestedIdx\],\s*\{\s*requestedIdx\s*\}\)/.test(goTo) &&
  /if\s*\(\s*!playStarted\s*&&\s*currentIdx\s*===\s*requestedIdx\s*\)\s*\{[\s\S]*restoreDisplayedTrack\(rollbackIdx\)/.test(goTo),
  'goTo should restore the current playing song page when the requested song cannot play'
);
assert(
  /currentIdx\s*=\s*\(\(index\s*%\s*6\)\s*\+\s*6\)\s*%\s*6/.test(restoreDisplayedTrack) &&
  /renderCurrentTrackState\(\)/.test(restoreDisplayedTrack),
  'restoreDisplayedTrack should normalize the slot index and rerender the current song state'
);
assert(
  /let\s+urlEndpoint\s*=\s*`\/api\/track\/url\?id=\$\{track\.nid\}&level=\$\{level\}&realIP=\$\{NCM_REAL_IP\}`/.test(loadAndPlay) &&
  /fetch\(\s*urlEndpoint\s*,\s*\{[^}]*credentials\s*:\s*['"]include['"][^}]*\}/s.test(loadAndPlay),
  'loadAndPlay should use /api/track/url with credentials include'
);
assert(
  !/apiFetch\(\s*`\/song\/url\/v1/.test(loadAndPlay),
  'loadAndPlay should no longer call apiFetch(`/song/url/v1`)'
);
assert(
  /\['lossless',\s*'exhigh',\s*'higher',\s*'standard'\]/.test(loadAndPlay),
  'loadAndPlay should keep trying the existing quality levels'
);
assert(
  /res\.status\s*===\s*403/.test(loadAndPlay) && /NO_PLAY_PERMISSION/.test(loadAndPlay) && /continue/.test(loadAndPlay),
  'loadAndPlay should continue to the next level on 403 or NO_PLAY_PERMISSION'
);
assert(
  /urlEndpoint\s*\+=\s*['"]&cookie=['"]\s*\+\s*encodeURIComponent\(vipCookie\)/.test(loadAndPlay),
  'loadAndPlay should append vipCookie to /api/track/url as a compatibility bridge'
);
assert(
  /let\s+networkFailures\s*=\s*0/.test(loadAndPlay) &&
  /try\s*\{[\s\S]*await\s+fetch\([\s\S]*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*networkFailures\+\+[\s\S]*continue[\s\S]*\}/.test(loadAndPlay) &&
  /try\s*\{[\s\S]*await\s+res\.json\(\)[\s\S]*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*continue[\s\S]*\}/.test(loadAndPlay),
  'loadAndPlay should isolate fetch and JSON failures per quality level'
);
assert(
  /if\s*\(\s*!res\.ok\s*\)\s*continue/.test(loadAndPlay) &&
  /if\s*\(\s*!data\s*\|\|\s*typeof\s+data\s*!==\s*['"]object['"]\s*\)\s*continue/.test(loadAndPlay) &&
  /if\s*\(\s*!data\.data\?\.\[0\]\?\.url\s*\)\s*continue/.test(loadAndPlay),
  'loadAndPlay should continue on malformed, non-ok, and no-url responses'
);
assert(
  /if\s*\(\s*networkFailures\s*===\s*qualityLevels\.length\s*\)\s*\{[\s\S]*showToast\(['"]缃戠粶閿欒['"]\)/.test(loadAndPlay),
  'loadAndPlay should show the network error toast only when every level failed due to fetch errors'
);

assert(
  /return\s+false/.test(loadAndPlay) &&
  /await\s+audio\.play\(\)/.test(loadAndPlay) &&
  /playingIdx\s*=\s*options\.requestedIdx/.test(loadAndPlay) &&
  /return\s+true/.test(loadAndPlay),
  'loadAndPlay should return a success boolean and record the playing slot only after audio.play succeeds'
);

const startNcmQrLogin = extractFunction('startNcmQrLogin');
assert(
  /fetch\(['"]\/api\/auth\/qr\/start['"]\s*,\s*\{[^}]*method\s*:\s*['"]POST['"][^}]*credentials\s*:\s*['"]include['"][^}]*\}/s.test(startNcmQrLogin),
  'startNcmQrLogin should POST /api/auth/qr/start with credentials include'
);
assert(
  /\^data:image\\\/\(png\|jpeg\|jpg\|webp\);base64,/.test(startNcmQrLogin),
  'startNcmQrLogin should validate QR images as expected image data URLs'
);
assert(
  /document\.createElement\(['"]img['"]\)/.test(startNcmQrLogin) &&
  /\.src\s*=\s*data\.qrimg/.test(startNcmQrLogin) &&
  /\.alt\s*=/.test(startNcmQrLogin) &&
  /replaceChildren\([^)]*img[^)]*\)/.test(startNcmQrLogin),
  'startNcmQrLogin should create the QR img safely and replace children'
);
assert(
  !/innerHTML\s*=\s*data\.qrimg/.test(startNcmQrLogin) &&
  !/innerHTML\s*=\s*[^;]*\$\{data\.qrimg\}/s.test(startNcmQrLogin),
  'startNcmQrLogin should not interpolate data.qrimg through innerHTML'
);
assert(
  /replaceChildren\(\)/.test(startNcmQrLogin),
  'startNcmQrLogin should safely clear the QR container for invalid or missing images'
);

const checkNcmQrLogin = extractFunction('checkNcmQrLogin');
assert(
  /fetch\(['"]\/api\/auth\/qr\/status\?key=['"]\s*\+\s*encodeURIComponent\(ncmLoginKey\)\s*,\s*\{[^}]*credentials\s*:\s*['"]include['"][^}]*\}/s.test(checkNcmQrLogin),
  'checkNcmQrLogin should call /api/auth/qr/status with credentials include'
);
assert(
  /ncmUser\s*=\s*data\.user\s*\|\|\s*null/.test(checkNcmQrLogin) && /renderNcmLoginState\(\)/.test(checkNcmQrLogin),
  'QR success should store the returned user and render the nickname state'
);
assert(
  /typeof\s+loadRecentTracksFromAccount\s*===\s*['"]function['"]/.test(checkNcmQrLogin),
  'QR success should guard loadRecentTracksFromAccount for Task 6'
);
assert(
  /data\.code\s*===\s*800/.test(checkNcmQrLogin) &&
  /二维码已过期/.test(checkNcmQrLogin) &&
  /clearInterval\(ncmLoginTimer\)/.test(checkNcmQrLogin) &&
  /ncmLoginTimer\s*=\s*null/.test(checkNcmQrLogin) &&
  /ncmLoginKey\s*=\s*['"]['"]/.test(checkNcmQrLogin),
  'checkNcmQrLogin should stop polling and clear state when QR code expires'
);

const renderNcmLoginState = extractFunction('renderNcmLoginState');
assert(
  /btn\.textContent\s*=\s*ncmUser\s*&&\s*ncmUser\.nickname\s*\?\s*ncmUser\.nickname\s*:\s*['"]登录网易云['"]/.test(renderNcmLoginState),
  'renderNcmLoginState should show nickname after login and 登录网易云 before login'
);

const openNcmLogin = extractFunction('openNcmLogin');
assert(
  /if\s*\(\s*ncmUser\s*\)\s*\{[\s\S]*openNcmAccount\(\)[\s\S]*return[\s\S]*\}/.test(openNcmLogin),
  'openNcmLogin should open the account playlist view instead of QR when already logged in'
);
assert(
  /document\.getElementById\(['"]ncm-login-(refresh|cancel)['"]\)\?\.focus\(\)/.test(openNcmLogin) ||
  /document\.getElementById\(['"]ncm-login-(refresh|cancel)['"]\)[\s\S]*\.focus\(\)/.test(openNcmLogin),
  'openNcmLogin should focus a modal action button'
);

const openNcmAccount = extractFunction('openNcmAccount');
assert(
  /showNcmAccountView\(\)/.test(openNcmAccount) && /loadNcmPlaylists\(\)/.test(openNcmAccount),
  'openNcmAccount should switch to the playlist view and load the logged-in user playlists'
);

const loadNcmPlaylists = extractFunction('loadNcmPlaylists');
assert(
  /fetch\(['"]\/api\/me\/playlists['"]\s*,\s*\{[^}]*credentials\s*:\s*['"]include['"][^}]*\}/s.test(loadNcmPlaylists),
  'loadNcmPlaylists should fetch /api/me/playlists with credentials include'
);

const loadNcmPlaylistTracks = extractFunction('loadNcmPlaylistTracks');
assert(
  /fetch\(\s*`\/api\/playlist\/tracks\?id=\$\{encodeURIComponent\(playlistId\)\}`\s*,\s*\{[^}]*credentials\s*:\s*['"]include['"][^}]*\}/s.test(loadNcmPlaylistTracks),
  'loadNcmPlaylistTracks should fetch selected playlist songs with credentials include'
);

const renderNcmPlaylistTracks = extractFunction('renderNcmPlaylistTracks');
assert(
  /replaceSlot\(track\)/.test(renderNcmPlaylistTracks),
  'renderNcmPlaylistTracks should let the user select a playlist song into the player'
);

const ncmAccountLayoutRule = extractCssRule('.ncm-account-layout');
assert(
  /grid-template-columns\s*:\s*minmax\(190px,\s*0\.9fr\)\s+minmax\(260px,\s*1\.4fr\)/.test(ncmAccountLayoutRule),
  'desktop account modal should keep the two-column playlist and song layout'
);
assert(
  /<div\s+class=["']ncm-account-column\s+ncm-playlist-column["']>\s*<span\s+class=["']ncm-playlist-section-label["'][^>]*>[\s\S]*?<\/span>\s*<div\s+id=["']ncm-playlist-list["'][\s\S]*?<\/div>\s*<\/div>/.test(html),
  'desktop account modal should keep the playlist label and playlist list inside the left column'
);
assert(
  /<div\s+class=["']ncm-account-column\s+ncm-track-column["']>\s*<span\s+class=["']ncm-track-section-label["'][^>]*>[\s\S]*?<\/span>\s*<div\s+id=["']ncm-track-list["'][\s\S]*?<\/div>\s*<\/div>/.test(html),
  'desktop account modal should keep the song label and song list inside the right column'
);
const ncmAccountColumnRule = extractCssRule('.ncm-account-column');
assert(
  /display\s*:\s*flex/.test(ncmAccountColumnRule) &&
  /flex-direction\s*:\s*column/.test(ncmAccountColumnRule) &&
  /min-width\s*:\s*0/.test(ncmAccountColumnRule),
  'desktop account modal columns should be explicit flex columns so grid children do not auto-flow into the wrong cells'
);
const ncmAccountDividerRule = extractCssRule('.ncm-account-divider');
assert(
  /display\s*:\s*none/.test(ncmAccountDividerRule),
  'desktop account modal should hide the mobile-only playlist/song divider'
);
['ncm-playlist-section-label', 'ncm-track-section-label', 'ncm-account-divider'].forEach((className) => {
  assert(
    new RegExp(`class=["'][^"']*${className}`).test(html),
    `mobile account modal should include .${className} for clear playlist/song separation`
  );
});
assert(
  /@media\s*\(max-width:\s*600px\)[\s\S]*\.ncm-account-layout\s*\{[\s\S]*display\s*:\s*flex[\s\S]*flex-direction\s*:\s*column[\s\S]*\}/.test(html) &&
  /@media\s*\(max-width:\s*600px\)[\s\S]*\.ncm-account-divider\s*\{[\s\S]*height\s*:\s*1px[\s\S]*\}/.test(html),
  'mobile account modal should stack playlist and song sections with a visible divider'
);

const logoutNcm = extractFunction('logoutNcm');
assert(
  /fetch\(['"]\/api\/auth\/logout['"]\s*,\s*\{[^}]*method\s*:\s*['"]POST['"][^}]*credentials\s*:\s*['"]include['"][^}]*\}/s.test(logoutNcm),
  'logoutNcm should POST /api/auth/logout with credentials include'
);

const handleCardTap = extractFunction('handleCardTap');
const bindCardClicks = extractFunction('bindCardClicks');
const onDragEnd = extractFunction('onDragEnd');
assert(
  /const\s+idx\s*=\s*parseInt\(card\.dataset\.index,\s*10\)/.test(handleCardTap) &&
  /if\s*\(\s*idx\s*===\s*currentIdx\s*\)[\s\S]*toggleLyricsMode\(\)/.test(handleCardTap),
  'handleCardTap should enter lyrics mode when tapping the current cover'
);
assert(
  /handleCardTap\(el\)/.test(bindCardClicks),
  'bindCardClicks should use handleCardTap so desktop and mobile click behavior stay consistent'
);
assert(
  /function\s+onDragEnd\s*\(\s*e\s*\)/.test(onDragEnd) &&
  /e\?\.type\s*===\s*['"]touchend['"]/.test(onDragEnd) &&
  /handleCardTap\(tappedCard\)/.test(onDragEnd),
  'mobile touch tap on a cover should delegate to handleCardTap instead of checking a missing active class'
);

const closeNcmLogin = extractFunction('closeNcmLogin');
assert(
  /document\.getElementById\(['"]ncm-login-btn['"]\)\?\.focus\(\)/.test(closeNcmLogin) ||
  /document\.getElementById\(['"]ncm-login-btn['"]\)[\s\S]*\.focus\(\)/.test(closeNcmLogin),
  'closeNcmLogin should restore focus to the login button'
);

assert(
  /document\.getElementById\(['"]ncm-account-close['"]\)\?\.addEventListener\(['"]click['"],\s*closeNcmLogin\)/.test(html),
  'NetEase Cloud account close button should close the modal through closeNcmLogin'
);

const bootBlock = extractInitThenBlock();
assert(
  /updateVipStatus\(\)/.test(bootBlock) && /fetchNcmMe\(\)/.test(bootBlock),
  'init().then boot block should call both updateVipStatus() and fetchNcmMe()'
);

assert(
  /case\s+['"]Escape['"]\s*:[^;]*closeNcmLogin\(\)/s.test(html) ||
  /case\s+['"]Escape['"]\s*:[\s\S]*closeNcmLogin\(\)[\s\S]*break/.test(html),
  'Escape key handling should close the NetEase Cloud login dialog'
);

assert(
  !/body\.logged-in\s+\.icon-cards/.test(html),
  'login state should not alter carousel layout with body.logged-in .icon-cards'
);
assert(
  !/body\.ncm-login-open\s+\.icon-cards/.test(html),
  'login state should not alter carousel layout with body.ncm-login-open .icon-cards'
);
assert(
  !/\.ncm-login-overlay\s+\.icon-cards/.test(html),
  'login overlay should not style carousel layout'
);

console.log('music player regression checks passed');
