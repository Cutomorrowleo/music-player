# 2026-06-01 Mobile Login Refresh Fixes Log

## Scope

- Fix logged-in home carousel refresh when recent tracks are empty by falling back to the user's first playlist.
- Separate mobile account modal playlist rows from selected playlist song rows.
- Center mobile song title and make tapping the active cover reliably open lyrics.
- Preserve the existing EchoRoom layout, visual language, and account modal style.

## Timeline

- Plan created before implementation.
- Root cause review:
  - Home refresh only used `/api/me/recent-tracks?limit=6`; empty/unusable recent tracks preserved default slots.
  - Mobile account modal rendered playlist and song lists as one continuous stacked flow.
  - Mobile title used a narrower fixed width and inherited padding, which wrapped short Chinese names in lyrics mode.
  - Mobile touch handling checked a non-existent `.active` class instead of comparing the tapped card `data-index` to `currentIdx`.
- TDD red test:
  - Command: `node tests/music-player-regression.test.js`
  - Expected failure: mobile title centering assertion failed before implementation.
- Implementation:
  - Added `loadAccountTracksForHome()` playlist fallback for home refresh.
  - Added `applyAccountTracksToHome()` to share the six-slot replacement/render path.
  - Added account modal mobile section labels and divider: playlist area and current playlist songs area.
  - Added `handleCardTap(card)` and delegated click/touch tap handling through it.
  - Adjusted mobile `#track-title` to wider centered width with smaller clamp and reduced padding.
- Green test:
  - Command: `node tests/music-player-regression.test.js`
  - Result: passed.
- Full verification:
  - Command: `npm test`
  - Result: passed all checks.
- Browser QA:
  - Local URL: `http://127.0.0.1:3000/`
  - Mobile title center: 197px.
  - Mobile viewport center: 197px.
  - Mobile play button center: 197px.
  - Active cover tap: `lyricsMode=true`.
  - Console errors during QA: 0.

## Verification

- `node tests/music-player-regression.test.js`: passed.
- `npm test`: passed.
- Browser desktop/mobile screenshots captured.
- Actual mobile cover tap entered lyrics mode.
- Actual mobile title is centered and single-line for `年少有为 - 李荣浩`.

## Screenshots

- Step 1, logged-in home refresh preview:
  - Desktop: `qa-screenshot-20260601-step1-home-refresh-desktop.png`
  - Mobile: `qa-screenshot-20260601-step1-home-refresh-mobile.png`
- Step 2, account modal playlist/song separation preview:
  - Desktop: `qa-screenshot-20260601-step2-account-separation-desktop.png`
  - Mobile: `qa-screenshot-20260601-step2-account-separation-mobile.png`
- Step 3, title/lyrics preview:
  - Desktop: `qa-screenshot-20260601-step3-title-lyrics-desktop.png`
  - Mobile: `qa-screenshot-20260601-step3-title-lyrics-mobile.png`
- Real app QA:
  - Desktop home: `qa-screenshot-20260601-real-home-desktop.png`
  - Mobile home: `qa-screenshot-20260601-real-home-mobile.png`
  - Mobile after tapping cover: `qa-screenshot-20260601-real-mobile-lyrics-after-tap.png`

## Residual Notes

- Logged-in home refresh cannot be fully exercised without a real NetEase authenticated session in the browser, so the network path is covered by source-level regression tests and the visual state is covered by the local QA preview page.
- The real unauthenticated app was checked for layout regressions and console errors.

## 2026-06-01 Desktop Account Layout And Mobile Title Follow-up

- User-reported issue:
  - Desktop logged-in account modal placed section labels, playlist list, divider, and song list as independent grid children, so the two-column layout auto-flowed into the wrong cells.
  - Mobile song title sat too low; the user wanted it moved into the blank area above the existing title position while keeping other layout unchanged.
- Root cause:
  - `.ncm-account-layout` was a two-column grid, but the account view DOM did not wrap "我的歌单 + list" and "当前歌单歌曲 + list" into column containers.
  - Mobile `#track-title` used `bottom: 86px`, close to the hint/control region instead of the requested blank area.
- Red test:
  - Command: `node tests/music-player-regression.test.js`
  - Expected failure: `mobile track title should be lifted into the blank space above the existing control area without moving the controls`.
- Implementation:
  - Wrapped the playlist label/list and song label/list in `.ncm-account-column` containers.
  - Added `.ncm-account-column` desktop flex-column styling and hid `.ncm-account-divider` on desktop.
  - Kept the mobile divider visible through the existing mobile media rule.
  - Changed mobile `#track-title` from `bottom: 86px` to `bottom: 126px`; controls and hint positions were not changed.
  - Synced the QA preview page to the same desktop/mobile account structure.
- Green/full verification:
  - `node tests/music-player-regression.test.js`: passed.
  - `npm test`: passed all checks.
- Browser QA metrics:
  - Desktop account preview: playlist column x=331.5, song column x=615.92, desktop divider display=`none`.
  - Mobile real app: title bottom=`126px`, hint bottom=`66px`, controls bottom=`12px`.
- Screenshots:
  - Desktop account layout fixed: `qa-screenshot-20260601-desktop-account-layout-fixed.png`
  - Mobile real title lifted: `qa-screenshot-20260601-mobile-title-lifted-real.png`
  - Mobile account layout after wrapper change: `qa-screenshot-20260601-mobile-account-layout-fixed.png`

## 2026-06-01 Conditional Title Fade Follow-up

- User-reported issue:
  - Short mobile song titles looked like the lower half had a shadow/fade.
- Root cause:
  - The bottom fade mask was attached directly to `#track-title`, so every title faded, including short one-line titles.
- Red test:
  - Command: `node tests/music-player-regression.test.js`
  - Expected failure: default `#track-title` still had `mask-image`.
- Implementation:
  - Moved the mask to `.track-title-fade`.
  - Added `updateTrackTitleFade()` and call it after `updateTrackInfo()` and window resize.
  - The fade class is only enabled when the title is long and the rendered title is clipped or crowds the controls/hint.
- Verification:
  - `node tests/music-player-regression.test.js`: passed.
  - `npm test`: passed all checks.
  - Browser QA on mobile real page: `#track-title` for `年少有为 - 李荣浩` had `hasFade=false` and computed mask=`none`.
- Screenshot:
  - Mobile short title without fade: `qa-screenshot-20260601-title-no-fade-short.png`

## 2026-06-01 Mobile Lyrics Hint And Sound Wave Follow-up

- User-reported issue:
  - Mobile lyrics view still showed the "滑动卡片切换歌曲" hint after tapping the cover.
  - Mobile main and mobile lyrics views should include the same bottom-left playback-following sound wave component used on desktop.
- Root cause:
  - The mobile media rule explicitly set `.sound-wave { display: none; }`.
  - The mobile media rule always displayed `.drag-hint`, and lyrics mode did not override it.
- Red test:
  - Command: `node tests/music-player-regression.test.js`
  - Expected failure: mobile lyrics mode did not hide `.drag-hint`.
- Implementation:
  - Changed mobile `.sound-wave` to `display:flex` with a compact lower-left placement.
  - Kept the existing desktop implementation and `soundWave.classList.toggle('active', p)` playback logic unchanged.
  - Added `body.lyrics-mode .drag-hint { display:none; }` inside the mobile media rule.
  - Updated the QA preview page so active playback screenshots can show the lower-left sound wave without requiring a real playable NetEase session.
- Verification:
  - `node tests/music-player-regression.test.js`: passed.
  - `npm test`: passed all checks.
  - Browser QA on real mobile page after entering lyrics mode: `.drag-hint` computed `display=none`; `.sound-wave` computed `display=flex`, rect x=20, y=798, h=28.
- Screenshots:
  - Mobile home active sound wave preview: `qa-screenshot-20260601-mobile-home-sound-wave-preview.png`
  - Mobile lyrics active sound wave preview: `qa-screenshot-20260601-mobile-lyrics-sound-wave-preview.png`

## 2026-06-01 Failed Song Switch Rollback Follow-up

- User-reported issue:
  - When switching to a song that cannot play for any reason, the page should not stay on the failed song; it should return to the currently playing song page.
- Self-check result:
  - Bug confirmed in the existing flow.
  - `goTo()` changed `currentIdx` and rerendered the page before `loadAndPlay()` knew whether the new song could play.
  - `loadAndPlay()` only showed an error toast on no source/network/play failure and did not return a success/failure value to the caller.
- Red test:
  - Command: `node tests/music-player-regression.test.js`
  - Expected failure: `restoreDisplayedTrack should exist`.
- Implementation:
  - Added `playingIdx` to remember the slot that actually began playing.
  - Added `playRequestSeq` to guard stale async play requests.
  - Added `renderCurrentTrackState()` and `restoreDisplayedTrack(index)`.
  - Changed `goTo()` to await `loadAndPlay(slots[requestedIdx], { requestedIdx })`; if it returns false and the user has not moved again, restore the page to `playingIdx` or the previous displayed slot.
  - Changed `loadAndPlay()` to return `true` only after `await audio.play()` succeeds, and `false` for no nid, no source, network errors, stale requests, and `audio.play()` rejection.
- Verification:
  - `node tests/music-player-regression.test.js`: passed.
  - `npm test`: passed all checks.
- Browser QA note:
  - The current browser plugin surface cannot intercept local `/api/track/url` requests or inject a mock `fetch` into the page, so the forced no-source scenario is covered by the regression test and source-level flow checks rather than an injected browser run.
