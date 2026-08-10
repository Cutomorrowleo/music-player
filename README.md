# MySong Music Player

Single-page music player with animated lava-style background blobs and a NetEase Cloud Music API proxy.

## Local Run

```bash
npm install
node server.js
```

Open `http://localhost:3000`. The local server mirrors the production `/api/*` URLs.

## Vercel Deploy

This project is prepared for Vercel:

- `song.html` and cover images are served directly from Vercel's CDN.
- NetEase Cloud Music requests use the same-origin `/api` prefix in local development and on Vercel.
- Public song metadata is cached at the edge, while account and playback endpoints remain uncached.

Import the GitHub repository in Vercel and deploy with the default settings.

## Notes

- `song.html` is the current player entry file.
- `mysong.html` is kept as the first final version snapshot.
- VIP cookies are stored only in the user's browser local storage.
- Do not commit `server.log`; it can contain request query data.
