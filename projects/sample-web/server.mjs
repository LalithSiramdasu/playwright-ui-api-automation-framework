/** Separate local-only website used to prove reusable UI test adapters. */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const host = '127.0.0.1';
const port = Number(process.env.SAMPLE_WEB_PORT ?? 4175);
// Intentionally fake local fixture credentials, not production secrets.
const DEMO_EMAIL = 'tester@example.test';
const DEMO_PASSWORD = 'LocalOnly123!';
const sessions = new Set();
const MAX_BODY = 8192;

function send(res, status, body, mime = 'text/html; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}
function json(res, status, data) {
  send(res, status, JSON.stringify(data), 'application/json; charset=utf-8');
}
function authorized(req) {
  const cookie = (req.headers.cookie ?? '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith('sample_session='));
  return Boolean(cookie && sessions.has(cookie.slice('sample_session='.length)));
}
async function bodyAsJson(req) {
  let input = '';
  for await (const chunk of req) {
    input += String(chunk);
    if (input.length > MAX_BODY) throw new Error('Body too large');
  }
  try { return JSON.parse(input); } catch { throw new Error('Invalid JSON'); }
}
const baseStyles = `
  :root{font:16px system-ui,sans-serif;color:#253143;background:#f5f7fa}*{box-sizing:border-box}
  body{margin:0}.layout{max-width:720px;margin:70px auto;padding:32px;background:#fff;border:1px solid #dce1e8;border-radius:8px}
  h1{font-size:2rem}label{display:block;margin:16px 0 7px}input{width:100%;padding:12px;border:1px solid #9da9b6;border-radius:4px}
  button{margin-top:20px;padding:12px 18px;background:#253143;color:white;border:0;border-radius:4px;cursor:pointer}
  a{color:#1758a1}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #2369b5;outline-offset:3px}
  .error{color:#a12d2d;min-height:1.5em}li{margin-top:12px}`;
const layout = (title, main, extraScript = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | Sample Website</title><style>${baseStyles}</style></head>
<body><main class="layout">${main}</main>${extraScript}</body></html>`;
const loginPage = layout('Sign in', `<h1>Sign in to Sample Website</h1>
<p>Local practice target with its own login and session cookie.</p>
<form id="signin"><label for="user">Email</label><input id="user" type="email" required autocomplete="username">
<label for="pass">Password</label><input id="pass" type="password" required autocomplete="current-password">
<button type="submit">Sign in</button><p id="error" role="alert" class="error"></p></form>`, `<script>
  document.getElementById('signin').addEventListener('submit',async e=>{
    e.preventDefault();const form=e.currentTarget,button=form.querySelector('button'),error=document.getElementById('error');
    button.disabled=true;error.textContent='';
    try{const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:document.getElementById('user').value,password:document.getElementById('pass').value})});
      if(!response.ok){error.textContent='Invalid email or password';return;}
      location.assign('/workspace');
    }catch{error.textContent='Unable to connect. Try again.';}finally{button.disabled=false;}
  });
</script>`);
const workspacePage = layout('Workspace', `<h1>Sample workspace</h1>
<p>Your local session is active.</p><nav><a href="/catalog">View catalog</a></nav>
<button id="logout" type="button">Log out</button>`, `<script>
  document.getElementById('logout').addEventListener('click',async()=>{
    await fetch('/api/logout',{method:'POST'});location.assign('/login');
  });
</script>`);
const catalogPage = layout('Catalog', `<h1>Sample catalog</h1><p>Independent fixture data.</p>
<ul><li data-testid="sample-item">Sample Notebook</li><li data-testid="sample-item">Sample Pen</li></ul>
<a href="/workspace">Back to workspace</a>`);
const errorPage = layout('Diagnostics', `<h1>Diagnostics fixture</h1>
<p>This page deliberately throws a browser exception for diagnostics coverage.</p>`, `<script>
queueMicrotask(()=>{throw new Error('Synthetic page error');});
</script>`);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${host}`);
    const path = url.pathname;
    if (path === '/health' && req.method === 'GET') return json(res, 200, { status: 'ok', service: 'sample-web' });
    if (path === '/api/session' && req.method === 'POST') {
      const credentials = await bodyAsJson(req);
      if (credentials?.email !== DEMO_EMAIL || credentials?.password !== DEMO_PASSWORD) {
        return json(res, 401, { error: 'Invalid email or password' });
      }
      const sessionId = randomUUID();
      sessions.add(sessionId);
      res.setHeader('Set-Cookie', `sample_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/`);
      return json(res, 200, { status: 'authenticated' });
    }
    if (path === '/api/me' && req.method === 'GET') {
      return authorized(req) ? json(res, 200, { email: DEMO_EMAIL }) : json(res, 401, { error: 'Unauthorized' });
    }
    if (path === '/api/logout' && req.method === 'POST') {
      const cookie = (req.headers.cookie ?? '').split(';').map((part) => part.trim())
        .find((part) => part.startsWith('sample_session='));
      if (cookie) sessions.delete(cookie.slice('sample_session='.length));
      res.setHeader('Set-Cookie', 'sample_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
      return json(res, 200, { status: 'signed-out' });
    }
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
    if (path === '/' || path === '/login') return send(res, 200, loginPage);
    if (path === '/diagnostics') return send(res, 200, errorPage);
    if (path === '/workspace' || path === '/catalog') {
      if (!authorized(req)) {
        res.writeHead(302, { Location: '/login', 'Cache-Control': 'no-store' });
        return res.end();
      }
      return send(res, 200, path === '/workspace' ? workspacePage : catalogPage);
    }
    return json(res, 404, { error: 'Not found' });
  } catch (error) {
    return json(res, ['Body too large', 'Invalid JSON'].includes(error.message) ? 400 : 500, {
      error: ['Body too large', 'Invalid JSON'].includes(error.message) ? error.message : 'Internal server error',
    });
  }
});
server.listen(port, host, () => {
  console.log(`Sample website listening at http://${host}:${server.address().port}`);
});
