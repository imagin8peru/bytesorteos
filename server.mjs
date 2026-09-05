import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === 'production';
const password = process.env.APP_PASSWORD || (production ? '' : 'prueba-local');
const sessionDuration = 12 * 60 * 60 * 1000;
const root = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const sessions = new Map();
const attempts = new Map();

if (!password) {
  console.error('Falta la variable obligatoria APP_PASSWORD.');
  process.exit(1);
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg'
};

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self'");
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(value => {
    const index = value.indexOf('=');
    return [value.slice(0, index).trim(), decodeURIComponent(value.slice(index + 1))];
  }));
}

function authenticated(req) {
  const token = cookies(req).bytesorteos_session;
  const expiresAt = token && sessions.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return false;
  }
  return true;
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

function rateLimited(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter(time => now - time < 15 * 60 * 1000);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > 10;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function loginPage(error = '') {
  const message = error ? `<p class="error" role="alert">${error}</p>` : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ByteSorteos · Acceso</title><style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#070a12;color:#f6f8ff;font-family:Inter,system-ui,sans-serif}.login{width:min(420px,100%);padding:32px;border:1px solid #29334a;border-radius:18px;background:#101625;box-shadow:0 28px 80px #0008}.brand{display:flex;align-items:center;gap:12px;margin-bottom:26px}.logo{display:grid;width:44px;height:44px;place-items:center;border-radius:12px;background:linear-gradient(135deg,#7c5cff,#a94cff);font-weight:800;font-size:22px}.brand div{display:grid}.brand small{color:#99a6bd}h1{font-size:22px;margin:0 0 6px}p{margin:0 0 22px;color:#99a6bd}label{display:grid;gap:8px;font-size:13px;color:#b8c2d6}input{width:100%;padding:13px 14px;border:1px solid #36425d;border-radius:10px;background:#090d17;color:#fff;font:inherit;outline:none}input:focus{border-color:#7c5cff;box-shadow:0 0 0 3px #7c5cff33}button{width:100%;margin-top:16px;padding:13px;border:0;border-radius:10px;background:linear-gradient(135deg,#7c5cff,#9d4dff);color:#fff;font:700 14px system-ui;cursor:pointer}.error{padding:11px 12px;border:1px solid #e5393566;border-radius:9px;background:#e5393517;color:#ff9b98;font-size:13px}</style></head><body><main class="login"><div class="brand"><div class="logo">B</div><div><strong>BYTESORTEOS</strong><small>Ruleta privada del canal</small></div></div><h1>Acceso protegido</h1><p>Introduce la contraseña para continuar.</p>${message}<form method="post" action="/login"><label>Contraseña<input name="password" type="password" autocomplete="current-password" required autofocus></label><button type="submit">Entrar</button></form></main></body></html>`;
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) throw new Error('too-large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function serve(res, filename) {
  const path = join(root, filename);
  const data = await readFile(path);
  res.statusCode = 200;
  res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
  res.setHeader('Cache-Control', filename === 'index.html' ? 'no-cache' : 'public, max-age=3600');
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  const url = new URL(req.url || '/', 'http://localhost');

  try {
    if (url.pathname === '/health') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ status: 'ok' }));
    }

    if (url.pathname === '/login' && req.method === 'POST') {
      if (rateLimited(req)) {
        res.statusCode = 429;
        return res.end(loginPage('Demasiados intentos. Espera unos minutos.'));
      }
      const form = new URLSearchParams(await body(req));
      if (!safeEqual(form.get('password') || '', password)) {
        res.statusCode = 401;
        return res.end(loginPage('La contraseña no es correcta.'));
      }
      const token = randomBytes(32).toString('hex');
      sessions.set(token, Date.now() + sessionDuration);
      const secure = production ? '; Secure' : '';
      res.statusCode = 303;
      res.setHeader('Set-Cookie', `bytesorteos_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure}`);
      res.setHeader('Location', '/');
      return res.end();
    }

    if (url.pathname === '/logout') {
      const token = cookies(req).bytesorteos_session;
      if (token) sessions.delete(token);
      res.statusCode = 303;
      res.setHeader('Set-Cookie', 'bytesorteos_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
      res.setHeader('Location', '/');
      return res.end();
    }

    if (!authenticated(req)) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(loginPage());
    }

    const files = {
      '/': 'index.html',
      '/index.html': 'index.html',
      '/styles.css': 'styles.css',
      '/app.js': 'app.js'
    };
    if (!files[url.pathname]) {
      res.statusCode = 404;
      return res.end('No encontrado');
    }
    return await serve(res, files[url.pathname]);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.end('Error interno');
  }
});

setInterval(() => {
  const now = Date.now();
  for (const [token, expiresAt] of sessions) if (expiresAt < now) sessions.delete(token);
  for (const [ip, times] of attempts) {
    const recent = times.filter(time => now - time < 15 * 60 * 1000);
    if (recent.length) attempts.set(ip, recent); else attempts.delete(ip);
  }
}, 10 * 60 * 1000).unref();

server.listen(port, '0.0.0.0', () => {
  console.log(`ByteSorteos escuchando en el puerto ${port}`);
});
