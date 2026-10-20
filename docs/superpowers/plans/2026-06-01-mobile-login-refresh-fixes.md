# Mobile Login Refresh Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix logged-in home refresh, mobile playlist/song separation, and mobile title/tap-to-lyrics behavior without changing the core EchoRoom layout.

**Architecture:** Keep the single-page `song.html` architecture. Add small client-side helpers for account track fallback and slot replacement, refine account modal CSS for mobile separation, and make mobile tap detection explicit so cover taps are not swallowed by drag handling.

**Tech Stack:** Static HTML/CSS/JS, Vercel API routes, Node-based regression tests, local Browser QA.

---

### Task 1: Regression Tests

**Files:**
- Modify: `tests/music-player-regression.test.js`

- [ ] Add assertions that `loadRecentTracksFromAccount()` falls back to the first playlist when `/api/me/recent-tracks` is empty or unusable.
- [ ] Add assertions that account modal mobile CSS includes separate playlist and song sections with an explicit divider/header.
- [ ] Add assertions that mobile `#track-title` is centered with `box-sizing`, full-width centering, and a stable transform.
- [ ] Add assertions that mobile card tap uses a dedicated helper instead of relying on the incorrect `.active` class.
- [ ] Run: `node tests/music-player-regression.test.js`
- [ ] Expected: FAIL before implementation.

### Task 2: Account Data Flow

**Files:**
- Modify: `song.html`

- [ ] Add `loadAccountTracksForHome()` to fetch `/api/me/playlists`, choose the first playlist, fetch `/api/playlist/tracks?id=...&limit=6`, and return tracks.
- [ ] Refactor slot replacement into `applyAccountTracksToHome(tracks)` so both recent tracks and playlist fallback use the same render/update path.
- [ ] Update `loadRecentTracksFromAccount()` to use recent tracks first and playlist fallback second.
- [ ] Update QR success and `fetchNcmMe()` paths to call the refreshed loader.

### Task 3: Mobile Account Modal Separation

**Files:**
- Modify: `song.html`

- [ ] Add a visible section label above the playlist list and a separate label above song rows.
- [ ] On mobile, keep both sections in one modal but use a divider, spacing, and capped heights so playlist rows and song rows are visually distinct.
- [ ] Keep the existing dark glass panel, gold accent, card borders, and themed scrollbars.

### Task 4: Mobile Title and Cover Tap

**Files:**
- Modify: `song.html`

- [ ] Center mobile `#track-title` with stable width and transform.
- [ ] Add a `handleCardTap(card)` helper that reads `data-index`, enters lyrics mode when tapping the current card, and navigates otherwise.
- [ ] Update `bindCardClicks()` and `onDragEnd()` to call `handleCardTap()`.
- [ ] Keep swipe/drag behavior unchanged when movement passes the drag threshold.

### Task 5: Verification and Log

**Files:**
- Modify: `docs/superpowers/progress/2026-06-01-mobile-login-refresh-fixes.md`

- [ ] Run: `npm test`
- [ ] Start local server and verify desktop and mobile screenshots.
- [ ] Capture desktop and mobile screenshots for homepage, account modal, and lyrics/mobile title state.
- [ ] Inspect console errors.
- [ ] Append commands, results, screenshot paths, and residual risks to the log.
