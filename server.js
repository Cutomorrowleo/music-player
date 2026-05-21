const path = require('path');
const fs = require('fs');
const { serveNcmApi } = require('NeteaseCloudMusicApi');

async function start() {
  const app = await serveNcmApi({
    port: 3000,
    checkVersion: false,
  });

  // 清除 API 自带的 public 静态文件中间件（避免覆盖我们的首页）
  const stack = app._router.stack;
  for (let i = stack.length - 1; i >= 0; i--) {
    const layer = stack[i];
    // express.static 中间件的 name 是 'serveStatic'
    if (layer.name === 'serveStatic') {
      stack.splice(i, 1);
    }
  }

  // 我们的静态文件 + 首页
  app.use(express.static(__dirname));
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });

  console.log('========================================');
  console.log('  音乐播放器（网易云）');
  console.log('  http://localhost:3000');
  console.log('========================================');
}

// 放在前面避免循环引用
const express = require('express');
start();
