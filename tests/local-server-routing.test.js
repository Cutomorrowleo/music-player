const assert = require('assert');
const http = require('http');
const { serveNcmApi } = require('NeteaseCloudMusicApi');

process.env.NODE_ENV = 'test';

const { mountLocalApiRoutes, findLocalApiInsertIndex } = require('../server');

function layerPath(layer) {
  return layer.route && layer.route.path;
}

function isPackageApiLayer(layer) {
  return !layer.route && String(layer.regexp).includes('^\\/api\\/?');
}

function isCacheLayer(layer) {
  return layer.name === 'cache' || (layer.handle && layer.handle.name === 'cache');
}

function request(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3998,
        path: pathname,
        method: 'GET',
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
      }
    );

    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const fakeStack = [
    { name: 'jsonParser' },
    { name: 'cache' },
    { regexp: /^\/api\/?(?=\/|$)/i },
  ];

  assert.strictEqual(
    findLocalApiInsertIndex(fakeStack),
    1,
    'local API routes should be inserted before package cache middleware'
  );

  const app = await serveNcmApi({ port: 3998, checkVersion: false });

  try {
    mountLocalApiRoutes(app);

    const stack = app._router.stack;
    const cacheIndex = stack.findIndex(isCacheLayer);
    const packageApiIndex = stack.findIndex((layer, index) => index > cacheIndex && isPackageApiLayer(layer));
    const qrStartIndex = stack.findIndex((layer) => layerPath(layer) === '/api/auth/qr/start');
    const playlistsIndex = stack.findIndex((layer) => layerPath(layer) === '/api/me/playlists');
    const playlistTracksIndex = stack.findIndex((layer) => layerPath(layer) === '/api/playlist/tracks');

    assert(qrStartIndex !== -1, 'server should mount /api/auth/qr/start');
    assert(playlistsIndex !== -1, 'server should mount /api/me/playlists');
    assert(playlistTracksIndex !== -1, 'server should mount /api/playlist/tracks');
    assert(cacheIndex !== -1, 'package cache middleware should exist in local stack');
    assert(packageApiIndex !== -1, 'package /api proxy layer should exist in local stack');
    assert(qrStartIndex < cacheIndex, 'local auth routes should run before package cache middleware');
    assert(qrStartIndex < packageApiIndex, 'local auth routes should run before package /api proxy');
    assert(playlistsIndex < cacheIndex, 'local playlists route should run before package cache middleware');
    assert(playlistTracksIndex < cacheIndex, 'local playlist tracks route should run before package cache middleware');

    const response = await request('/api/auth/qr/start');
    assert.strictEqual(
      response.statusCode,
      405,
      'GET /api/auth/qr/start should reach the local handler method guard'
    );
    assert.strictEqual(response.headers.allow, 'POST', 'local method guard should set Allow: POST');
    assert(
      response.body.includes('Method not allowed'),
      'local handler response should be returned instead of package 404'
    );
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
  }

  console.log('local server routing checks passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
