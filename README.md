# MySong Music Player

Single-page music player with animated lava-style background blobs and a NetEase Cloud Music API proxy.

## Local Run

```bash
npm install
node server.js
```

Open `http://localhost:3000`.

## Vercel Deploy

This project is prepared for Vercel:

- Static files are served from the repository root.
- NetEase Cloud Music requests use the same-origin API paths exposed by `server.js`.
- Local development and Vercel deployment use the same root API paths.

Import the GitHub repository in Vercel and deploy with the default settings.

## Notes

- `song.html` is the current player entry file.
- `mysong.html` is kept as the first final version snapshot.
- VIP cookies are stored only in the user's browser local storage.
- Do not commit `server.log`; it can contain request query data.
