const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'song.html'), 'utf8');

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

console.log('music player regression checks passed');
