const path = require('path');
const express = require('express');
const { serveNcmApi } = require('NeteaseCloudMusicApi');

const localApiRoutes = [
  ['/api/auth/qr/start', require('./api/auth/qr/start')],
  ['/api/auth/qr/status', require('./api/auth/qr/status')],
  ['/api/auth/me', require('./api/auth/me')],
  ['/api/auth/logout', require('./api/auth/logout')],
  ['/api/me/recent-tracks', require('./api/me/recent-tracks')],
  ['/api/me/playlists', require('./api/me/playlists')],
  ['/api/playlist/tracks', require('./api/playlist/tracks')],
  ['/api/track/url', require('./api/track/url')],
  ['/api/track/lyric', require('./api/track/lyric')],
];

function isPackageApiLayer(layer) {
  return !layer.route && String(layer.regexp).includes('^\\/api\\/?');
}

function isPackageCacheLayer(layer) {
  return layer.name === 'cache' || (layer.handle && layer.handle.name === 'cache');
}

function findLocalApiInsertIndex(stack) {
  const cacheIndex = stack.findIndex(isPackageCacheLayer);
  const packageApiIndex = stack.findIndex(isPackageApiLayer);

  if (cacheIndex !== -1 && packageApiIndex !== -1) {
    return Math.min(cacheIndex, packageApiIndex);
  }
  if (cacheIndex !== -1) return cacheIndex;
  if (packageApiIndex !== -1) return packageApiIndex;
  return stack.length;
}

function insertLocalApiLayersBeforePackageMiddleware(app, stackStart) {
  const stack = app._router && app._router.stack;
  if (!stack) return;

  const localLayers = stack.splice(stackStart);
  const insertIndex = findLocalApiInsertIndex(stack);

  stack.splice(insertIndex, 0, ...localLayers);
}

function mountLocalApiRoutes(app) {
  const stackStart = app._router && app._router.stack ? app._router.stack.length : 0;

  app.use('/api', express.json({ limit: '1mb' }));

  localApiRoutes.forEach(([routePath, handler]) => {
    app.all(routePath, async (req, res, next) => {
      try {
        await handler(req, res);
      } catch (error) {
        next(error);
      }
    });
  });

  insertLocalApiLayersBeforePackageMiddleware(app, stackStart);
}

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

  mountLocalApiRoutes(app);
  app.use(express.static(__dirname));
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'song.html'));
  });

  console.log('========================================');
  console.log('  Music player is running');
  console.log('  http://localhost:3000');
  console.log('========================================');
}

if (process.env.NODE_ENV === 'test') {
  module.exports = {
    findLocalApiInsertIndex,
    insertLocalApiLayersBeforePackageMiddleware,
    mountLocalApiRoutes,
    start,
  };
} else {
  start();
}
