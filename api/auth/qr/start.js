const { callNcm } = require('../../../lib/ncmClient');

function json(res, status, body) {
  res.status(status).json(body);
}

function methodNotAllowed(res) {
  res.setHeader('Allow', 'POST');
  json(res, 405, { ok: false, error: 'Method not allowed' });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    methodNotAllowed(res);
    return;
  }

  try {
    const keyResult = await callNcm('login_qr_key');
    const key = keyResult && keyResult.data && keyResult.data.unikey;

    if (!key) {
      json(res, 502, { ok: false, error: 'NetEase QR key missing' });
      return;
    }

    const timestamp = Date.now();
    const qrResult = await callNcm('login_qr_create', { key, qrimg: true, timestamp });
    const qrData = (qrResult && qrResult.data) || {};

    json(res, 200, {
      ok: true,
      key,
      qrimg: qrData.qrimg || '',
      qrurl: qrData.qrurl || '',
    });
  } catch (error) {
    json(res, error.status || 502, { ok: false, error: 'NetEase QR start failed' });
  }
};
