const ncm = require('NeteaseCloudMusicApi');

function normalizePathParam(value) {
  if (Array.isArray(value)) return value.join('/');
  return String(value || '');
}

function normalizeQuery(query) {
  const data = { ...query };
  delete data.ncm;
  return data;
}

function setCookies(res, cookies) {
  if (!Array.isArray(cookies) || cookies.length === 0) return;
  res.setHeader(
    'Set-Cookie',
    cookies.map((cookie) => `${cookie}; SameSite=None; Secure`),
  );
}

function setPublicCacheHeaders(res, path, query, method) {
  if (method !== 'GET' || query.cookie || !['song/detail', 'search'].includes(path)) return;

  const maxAge = path === 'song/detail' ? 86400 : 600;
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader(
    'Vercel-CDN-Cache-Control',
    `public, max-age=${maxAge}, stale-while-revalidate=604800`,
  );
}

module.exports = async function handler(req, res) {
  const path = normalizePathParam(req.query.ncm);
  const fnName = path.replace(/\//g, '_');
  const apiFn = ncm[fnName];

  if (typeof apiFn !== 'function') {
    res.status(404).json({ code: 404, data: null, msg: `Unknown API: /${path}` });
    return;
  }

  const query = {
    ...normalizeQuery(req.query),
    ...(req.body && typeof req.body === 'object' ? req.body : {}),
  };

  try {
    const response = await apiFn(query);
    setPublicCacheHeaders(res, path, query, req.method);
    if (!query.noCookie) setCookies(res, response.cookie);
    res.status(response.status || 200).json(response.body);
  } catch (error) {
    if (!error || !error.body) {
      res.status(502).json({ code: 502, data: null, msg: 'Netease API request failed' });
      return;
    }

    if (error.body.code === 301) error.body.msg = '需要登录';
    if (!query.noCookie) setCookies(res, error.cookie);
    res.status(error.status || 500).json(error.body);
  }
};
