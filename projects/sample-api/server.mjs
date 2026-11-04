/** Deliberately separate local API under test for verifying project isolation. */
import { createServer } from 'node:http';
const port = Number(process.env.SAMPLE_API_PORT ?? 4174);
const inventory = Object.freeze([{ sku: 'S-001', title: 'Sample Kit', available: true }]);
const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.writeHead(405); return res.end(JSON.stringify({ error: 'Method not allowed' })); }
  if (pathname === '/health') { res.writeHead(200); return res.end(JSON.stringify({ status: 'ok', service: 'sample-api' })); }
  if (pathname === '/api/inventory') { res.writeHead(200); return res.end(JSON.stringify({ items: inventory })); }
  res.writeHead(404);
  return res.end(JSON.stringify({ error: 'Not found' }));
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Independent sample API listening at http://127.0.0.1:${server.address().port}`);
});
