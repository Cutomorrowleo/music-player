const path = require('path');
const express = require('express');
const { serveNcmApi } = require('NeteaseCloudMusicApi');

async function start() {
  const app = await serveNcmApi({
    port: 3000,
    checkVersion: false,
  });

  // Remove the API package static middleware so our player page is served at root.
  const stack = app._router.stack;
  for (let i = stack.length - 1; i >= 0; i--) {
    const layer = stack[i];
    if (layer.name === 'serveStatic') {
      stack.splice(i, 1);
    }
  }

  app.use(express.static(__dirname));
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'song.html'));
  });

  console.log('========================================');
  console.log('  Music player is running');
  console.log('  http://localhost:3000');
  console.log('========================================');
}

start();
