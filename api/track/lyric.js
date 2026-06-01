const { callNcm } = require('../../lib/ncmClient');

function json(res, status, body) {
  res.status(status).json(body);
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

module.exports = async function handler(req, res) {
  const id = firstValue(req.query && req.query.id);

  if (!id) {
    json(res, 400, { ok: false, error: 'MISSING_ID' });
    return;
  }

  try {
    const body = await callNcm('lyric', { id });
    json(res, 200, body);
  } catch (error) {
    json(res, error.status || 502, { ok: false, error: 'NetEase lyric failed' });
  }
};
