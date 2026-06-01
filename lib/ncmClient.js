const ncm = require('NeteaseCloudMusicApi');

async function callNcm(fnName, params = {}, ncmCookie = '') {
  const fn = ncm[fnName];
  if (typeof fn !== 'function') {
    const error = new Error(`Unknown NetEase API function: ${fnName}`);
    error.status = 404;
    throw error;
  }

  const response = await fn({
    ...params,
    cookie: ncmCookie || params.cookie,
  });
  return response.body;
}

module.exports = { callNcm };
