// Local TCP -> HTTP CONNECT proxy tunnel for PostgreSQL
// Listens on localhost:15432 and forwards to Supabase pooler through the sandbox HTTP proxy.
const net = require('net');
const http = require('http');

const PROXY_HOST = '127.0.0.1';
const PROXY_PORT = 18080;
const TARGET_HOST = 'aws-0-ca-central-1.pooler.supabase.com';
const TARGET_PORT = 6543;
const LISTEN_PORT = 15432;

const server = net.createServer((clientSocket) => {
  const req = http.request({
    host: PROXY_HOST,
    port: PROXY_PORT,
    method: 'CONNECT',
    path: `${TARGET_HOST}:${TARGET_PORT}`,
  });

  req.on('connect', (res, upstreamSocket) => {
    if (res.statusCode !== 200) {
      console.error('CONNECT failed:', res.statusCode);
      clientSocket.destroy();
      return;
    }
    // Pipe bidirectionally
    clientSocket.pipe(upstreamSocket);
    upstreamSocket.pipe(clientSocket);
    clientSocket.on('error', () => upstreamSocket.destroy());
    upstreamSocket.on('error', () => clientSocket.destroy());
  });

  req.on('error', (e) => {
    console.error('proxy error:', e.message);
    clientSocket.destroy();
  });

  clientSocket.on('error', (e) => {
    console.error('client error:', e.message);
    req.destroy();
  });

  req.end();
});

server.listen(LISTEN_PORT, '127.0.0.1', () => {
  console.log(`Tunnel listening on 127.0.0.1:${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT} via ${PROXY_HOST}:${PROXY_PORT}`);
});

server.on('error', (e) => {
  console.error('server error:', e.message);
  process.exit(1);
});
