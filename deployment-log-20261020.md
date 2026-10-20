# Deployment Log - GitHub and Vercel

Date: 2026-10-20

## Targets

- GitHub repository: `Cutomorrowleo/music-player`
- GitHub branch: `main`
- Vercel project: `music`
- Production domain: `music-ten-beta.vercel.app`

## Pre-deployment Verification

- Ran the complete `npm test` suite.
- Music player regression, session store, track normalizer, auth contract, and local server routing checks passed.
- Excluded local dependencies, backups, server logs, and QA screenshots from publication.

## Issues Found During Deployment

1. The local player used root NetEase paths while Vercel exposes the catch-all function under `/api`.
   - Restored the shared `/api` prefix in `song.html`.
   - Restored the local `/api/*` proxy in `server.js`.
   - Added regression coverage for the shared routing contract.

2. The first production build returned `404` for `/covers/LPcover.jpg`.
   - Cause: the simplified Vercel configuration did not collect `covers/**` under the project's Node framework settings.
   - Restored explicit static, API, and route declarations in `vercel.json`.
   - Added regression coverage for static cover publication and production routes.

## Final Production Verification

- Deployment state: `READY`.
- `/`: HTTP `200`; contains `EchoRoom`; lyrics close button absent; vertical lyrics scrolling enabled.
- `/api/song/detail`: HTTP `200` with song data.
- `/api/track/lyric`: HTTP `200` with lyric data.
- `/api/auth/me`: HTTP `200` with the anonymous session response.
- `/covers/LPcover.jpg`: HTTP `200`, `image/jpeg`, with the expected cache policy.

## Residual Warning

- `NeteaseCloudMusicApi` emits Node.js `DEP0169` warnings because a transitive dependency still calls `url.parse()`.
- Vercel records stderr warnings as error-level log entries, but the tested API requests complete with HTTP `200`.
- Recommended follow-up: evaluate a dependency upgrade or a supported Node runtime change in a separate compatibility test before changing production.
