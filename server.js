const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const port = Number(process.env.PORT || 8080);
const publicDir = path.join(__dirname, 'public');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, err.code === 'ENOENT' ? 404 : 500, { error: err.code === 'ENOENT' ? 'Not found' : 'Server error' });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health') {
    return sendJson(res, 200, { status: 'ok', service: 'ai-governance-command-center', version: '2.0.0' });
  }

  if (url.pathname.startsWith('/api/')) {
    return sendJson(res, 501, {
      status: 'not-connected',
      message: 'Live ServiceNow, Azure DevOps and Moveworks APIs are intentionally disabled in demo mode.'
    });
  }

  let requested = decodeURIComponent(url.pathname);
  if (requested === '/') requested = '/index.html';
  const safePath = path.normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) return sendJson(res, 403, { error: 'Forbidden' });

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) return serveFile(res, filePath);
    // SPA fallback
    serveFile(res, path.join(publicDir, 'index.html'));
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`AI Governance Command Center listening on http://0.0.0.0:${port}`);
});
