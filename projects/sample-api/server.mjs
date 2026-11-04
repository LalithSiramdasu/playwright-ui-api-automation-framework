/** Independent, deterministic REST API fixture for Module 4 contract and auth tests. */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.SAMPLE_API_PORT ?? 4174);
const inventory = Object.freeze([{ sku: 'S-001', title: 'Sample Kit', available: true }]);
const tokens = new Set();
// Public, deliberately fake credential defaults are for this localhost fixture only.
const demoUser = 'api-tester@example.test';
const demoPassword = 'LocalOnly123!';
const demoApiKey = process.env.SAMPLE_API_KEY ?? 'local-demo-key';
function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
    if (body.length > 8_192) throw new Error('Request too large');
  }
  try { return JSON.parse(body); } catch { throw new Error('Invalid JSON'); }
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  try {
    if (path === '/api/auth/token' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body?.username || !body?.password) return send(res, 400, { error: 'Username and password are required' });
      if (body.username !== demoUser || body.password !== demoPassword) return send(res, 401, { error: 'Invalid credentials' });
      const accessToken = randomUUID();
      tokens.add(accessToken);
      return send(res, 200, { accessToken, tokenType: 'Bearer', expiresIn: 3600 });
    }
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
    if (path === '/health') return send(res, 200, { status: 'ok', service: 'sample-api' });
    if (path === '/api/inventory') {
      const limit = url.searchParams.get('limit');
      if (limit !== null && (!/^[1-9]\d*$/.test(limit) || Number(limit) > 20)) {
        return send(res, 400, { error: 'limit must be an integer between 1 and 20' });
      }
      return send(res, 200, { items: limit === null ? inventory : inventory.slice(0, Number(limit)) });
    }
    if (path === '/api/account') {
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!token || !tokens.has(token)) return send(res, 401, { error: 'Unauthorized' });
      return send(res, 200, { accountId: 'sample-account', role: 'tester', active: true });
    }
    if (path === '/api/metrics') {
      if (req.headers['x-api-key'] !== demoApiKey) return send(res, 401, { error: 'Invalid API key' });
      return send(res, 200, { service: 'sample-api', healthy: true, requestsProcessed: 1 });
    }
    return send(res, 404, { error: 'Not found' });
  } catch (error) {
    const expected = error.message === 'Invalid JSON' || error.message === 'Request too large';
    return send(res, expected ? 400 : 500, { error: expected ? error.message : 'Internal server error' });
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Independent sample API listening at http://127.0.0.1:${server.address().port}`);
});
