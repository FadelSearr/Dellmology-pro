const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const LOGDIR = path.join(__dirname, '..', 'apps', 'streamer', 'logs');
const LOGFILE = path.join(LOGDIR, 'telegram_webhook_received.log');

fs.mkdirSync(LOGDIR, { recursive: true });

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    return res.end('OK');
  }

  let body = [];
  req.on('data', (chunk) => body.push(chunk));
  req.on('end', () => {
    body = Buffer.concat(body).toString();
    const ts = new Date().toISOString();
    const entry = `${ts} ${req.url} ${req.headers['content-type'] || ''} ${body}\n`;
    fs.appendFileSync(LOGFILE, entry);
    console.log('Received webhook:', ts, req.url);
    try {
      console.log(JSON.parse(body));
    } catch (e) {
      console.log(body);
    }
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({received: true, ts}));
  });
});

server.listen(PORT, () => {
  console.log(`Local Telegram webhook listening on http://127.0.0.1:${PORT}`);
  console.log(`Writing received payloads to ${LOGFILE}`);
});
