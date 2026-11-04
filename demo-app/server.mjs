import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, 'public');
const port = Number(process.env.PORT ?? 4173);

const products = Object.freeze([
  { id: 101, name: 'Wireless Mouse', category: 'Electronics', pricePaise: 259900 },
  { id: 102, name: 'Notebook', category: 'Stationery', pricePaise: 89900 },
  { id: 103, name: 'Water Bottle', category: 'Lifestyle', pricePaise: 159900 },
]);
const tokens = new Set();
const sendJson = (res, status, value) => {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
};

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
    if (body.length > 10_000) throw new Error('Request too large');
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error('Invalid JSON');
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/health' && req.method === 'GET') {
      return sendJson(res, 200, { status: 'ok' });
    }
    if (url.pathname === '/api/products' && req.method === 'GET') {
      const search = (url.searchParams.get('q') || '').toLowerCase();
      const category = url.searchParams.get('category') || '';
      return sendJson(res, 200, {
        products: products.filter(
          (p) => p.name.toLowerCase().includes(search) && (!category || p.category === category),
        ),
      });
    }
    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      const credentials = await readJson(req);
      if (!credentials?.email || !credentials?.password) {
        return sendJson(res, 400, { error: 'Email and password are required' });
      }
      if (credentials.email !== 'demo@example.com' || credentials.password !== 'Password123!') {
        return sendJson(res, 401, { error: 'Invalid email or password' });
      }
      const token = randomUUID();
      tokens.add(token);
      return sendJson(res, 200, { token, user: { email: credentials.email } });
    }
    if (url.pathname === '/api/orders' && req.method === 'POST') {
      const token = req.headers.authorization?.replace(/^Bearer /, '');
      if (!token || !tokens.has(token)) {
        return sendJson(res, 401, { error: 'Unauthorized' });
      }
      const order = await readJson(req);
      if (
        !Array.isArray(order?.items) ||
        order.items.length === 0 ||
        order.items.some(
          (item) =>
            !products.some((p) => p.id === item.productId) ||
            !Number.isInteger(item.quantity) ||
            item.quantity < 1 ||
            item.quantity > 100,
        )
      ) {
        return sendJson(res, 400, { error: 'Invalid order items' });
      }
      const totalPaise = order.items.reduce(
        (sum, item) =>
          sum + products.find((product) => product.id === item.productId).pricePaise * item.quantity,
        0,
      );
      return sendJson(res, 201, { id: randomUUID(), status: 'confirmed', totalPaise });
    }
    if (req.method === 'GET' && ['/', '/index.html', '/app.js', '/styles.css'].includes(url.pathname)) {
      const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const content = await readFile(join(publicDir, path));
      const contentType = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
      }[extname(path)];
      res.writeHead(200, { 'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff' });
      return res.end(content);
    }
    return sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    const badRequest = ['Invalid JSON', 'Request too large'].includes(error.message);
    return sendJson(res, badRequest ? 400 : 500, {
      error: badRequest ? error.message : 'Internal server error',
    });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`QA demo shop running at http://127.0.0.1:${server.address().port}`);
});
