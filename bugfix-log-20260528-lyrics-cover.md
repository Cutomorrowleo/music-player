# Bugfix Log - Lyrics Mode Cover and Scrolling

Time: 2026-05-28 17:15:15 +08:00

## User Report

- In lyrics detail mode, the album cover disappears after pausing.
- Lyrics only show part of the content and cannot be scrolled up/down.
- Requested root-cause check, repair, full run check, and a log.

## Root Cause

1. Cover disappearing after pause:
   - In lyrics mode only the current card is rendered.
   - `updateCardScales()` compared the DOM loop index with `currentIdx`.
   - When the current song was not slot `0`, the only rendered card had DOM index `0`, so it lost `is-active-card`.
   - CSS hides non-active cards in lyrics mode, so the cover disappeared.

2. Lyrics not fully viewable:
   - `.lyrics-list` used `overflow: hidden`.
   - `syncLyricScroll()` moved the whole lyrics list with `transform`.
   - That made native manual scrolling impossible and could move lyrics out of the visible area.

3. Additional issue found during QA:
   - At a 1280x720 viewport, the lyrics-mode page title could slightly overlap the album cover.

## Changes

- `song.html`
  - Made `.lyrics-list` a native vertical scroll container.
  - Replaced transform-based lyric syncing with `scrollTo()`.
  - Added temporary manual-scroll protection so user scrolling is not immediately snapped back.
  - Changed `updateCardScales()` to use each card's `data-index` instead of DOM position.
  - Adjusted lyrics-mode title positioning to avoid cover overlap.

- `tests/music-player-regression.test.js`
  - Added a Node regression check for:
    - active cover state using `data-index`;
    - lyrics list vertical scrolling;
    - native scroll syncing instead of transform translation.

## Verification

- `node tests/music-player-regression.test.js`
  - Result: passed.

- `Invoke-WebRequest http://localhost:3000`
  - Result: HTTP 200.

- Browser QA on `http://localhost:3000/?qa=<timestamp>`
  - Selected `后来 - 刘若英`.
  - Entered lyrics mode.
  - Paused playback.
  - Confirmed cover remained visible:
    - `coverVisibleAfterPause: true`
    - active card `dataIndex: "2"`
    - active card `display: "flex"`
  - Confirmed lyrics scroll:
    - `overflowY: "auto"`
    - `rows: 52`
    - `scrollHeight: 3924`
    - `clientHeight: 475`
    - manual scroll changed `scrollTop` from `0` to `760`
  - Confirmed title and cover no longer overlap:
    - `h1GapToCover: 18`
  - Console check:
    - no browser error or warning logs.

## Notes

- The directory is not a Git repository, so no `git diff` or `git status` was available.
- Existing server logs contain older upstream NetEase API 502/network errors. The final browser QA did not produce console errors or warnings.
