# Bugfix Log - Lyrics Panel Alignment and Close Button

Time: 2026-05-29

## User Report

- The first visible lyric on the right should align with the left `EchoRoom` heading.
- The right lyrics area looks like it has an invisible frame and should feel frameless.
- The right close button is clipped and not fully visible.
- Run the site, self-test for other bugs, and record the fix.

## Root Cause

1. First lyric was lower than `EchoRoom`.
   - The right lyrics panel itself was aligned to the heading, but `.lyrics-list` had `padding-top: 84px`.
   - On mobile, a separate media rule kept `padding-top: 60px`.

2. The close button was clipped.
   - `.lyrics-close` used negative offsets: `top: -10px; right: -8px`.
   - The parent `.lyrics-panel` had `overflow: hidden`, so the overflowed parts were cut off.

3. The invisible-frame feeling came from the same structure.
   - `.lyrics-panel` clipped its contents.
   - `.lyrics-list` had large internal padding and its own scroll boundary.

## Changes

- `song.html`
  - Changed `.lyrics-panel` from `overflow: hidden` to `overflow: visible`.
  - Moved `.lyrics-close` inside the panel with `top: 0; right: 0`.
  - Raised close button stacking to avoid overlap.
  - Changed desktop `.lyrics-list` padding to `0 44px 96px 12px`.
  - Changed mobile `.lyrics-list` padding to `0 44px 72px 12px`.

- `tests/music-player-regression.test.js`
  - Added checks that:
    - desktop lyrics list no longer has top padding;
    - lyrics panel no longer clips content;
    - close button no longer uses negative offsets;
    - mobile old top padding is removed.

## Verification

- `node tests/music-player-regression.test.js`
  - Result: passed.

- Desktop browser QA at `1920x900`
  - First lyric and `EchoRoom` top difference: `-1px`.
  - `firstLyricAlignedToEchoRoom: true`.
  - `closeFullyInsidePanel: true`.
  - `panelNoClip: true`.
  - `noOldTopPadding: true`.
  - Lyrics scrolling worked: `scrollTop` reached `900`.
  - Close button exited lyrics mode.
  - Playback smoke check kept the cover visible.
  - Console errors/warnings: none.

- Mobile/narrow browser QA at `599x910`
  - First lyric and panel top difference: `-1px`.
  - `closeFullyInsidePanel: true`.
  - `panelNoClip: true`.
  - `noOldTopPadding: true`.
  - Cover, controls, title, progress, and lyrics scrolling remained visible/available.
  - Console errors/warnings: none.

- HTTP smoke check
  - `http://localhost:3000` returned HTTP `200`.

## Artifact

- QA screenshot: `qa-screenshot-20260529-lyrics-panel-fix.png`

## Notes

- The project directory is not a Git repository, so no Git diff/status was available.
