const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = process.env.PORT || 3000;

const mimeTypes = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendResponse(res, statusCode, contentType, content) {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(content);
}

function handleRequest(req, res) {
  const urlPath = decodeURI(req.url.split('?')[0]);
  let filePath = path.join(root, urlPath);

  if (urlPath === '/' || !path.extname(filePath)) {
    filePath = path.join(root, 'index.html');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      sendResponse(res, 404, 'text/plain; charset=UTF-8', '404 Not Found');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        sendResponse(res, 500, 'text/plain; charset=UTF-8', '500 Internal Server Error');
        return;
      }
      sendResponse(res, 200, contentType, data);
    });
  });
}

http.createServer(handleRequest).listen(port, () => {
  console.log(`OYO.plus site available at http://localhost:${port}`);
});
