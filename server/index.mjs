// Password-protected host for the Perform web build.
//
// Teammates open the link, enter the shared password once, and get a signed
// cookie that lasts 60 days. Everything except the login page, health check
// and home-screen icons sits behind that cookie. No dependencies: Node 20+.
//
//   ACCESS_PASSWORD  required — the team password
//   SESSION_SECRET   optional — signs cookies (defaults to one derived from the password,
//                    so changing the password signs everyone out)
//   PORT             default 3000
//   DIST_DIR         default ../dist (output of `npm run build:web`)

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const COOKIE = 'perform_session';
const SESSION_DAYS = 60;
const MAX_FAILURES = 10;
const MAX_FAILURES_TOTAL = 100;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

/** Files the browser fetches without cookies (manifest, home-screen icons). */
const PUBLIC_FILES = new Set(['/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/favicon.ico']);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.map', '.svg', '.txt', '.ttf', '.otf']);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow',
};

const sha256 = (value) => createHash('sha256').update(value).digest();
const sign = (secret, payload) => createHmac('sha256', secret).update(payload).digest('base64url');

/** Same-length digests make the comparison constant-time whatever the input. */
const safeEqual = (a, b) => timingSafeEqual(sha256(a), sha256(b));

export function createToken(secret, now = Date.now()) {
  const payload = `v1.${now + SESSION_DAYS * 24 * 60 * 60 * 1000}`;
  return `${payload}.${sign(secret, payload)}`;
}

export function verifyToken(secret, token, now = Date.now()) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const expires = Number(parts[1]);
  if (!Number.isFinite(expires) || expires < now) return false;
  return safeEqual(sign(secret, `${parts[0]}.${parts[1]}`), parts[2]);
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0) out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

/** Only same-site paths, so the login form can't be used as an open redirect. */
const safeNext = (value) => (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/');

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

export function loginPage({ next = '/', error = '' } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0A0B0A">
<meta name="robots" content="noindex, nofollow">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Perform">
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<title>Perform · Team preview</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; background: radial-gradient(120% 80% at 20% 0%, #1b2414 0%, #0A0B0A 55%); color: #F4F1EA;
    font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif; display: flex; align-items: center; justify-content: center;
    padding: max(24px, env(safe-area-inset-top)) 22px max(24px, env(safe-area-inset-bottom)); }
  main { width: 100%; max-width: 380px; }
  .mark { width: 52px; height: 52px; border-radius: 17px; background: #D4F171; display: flex; align-items: center; justify-content: center; }
  .eyebrow { margin: 26px 0 0; color: #E5C38C; font-size: 11px; font-weight: 600; letter-spacing: 1.6px; }
  h1 { margin: 8px 0 10px; font: 400 40px/1.08 "Instrument Serif", ui-serif, Georgia, "Times New Roman", serif; letter-spacing: -0.3px; }
  p { margin: 0 0 26px; color: #8C918C; font-size: 15px; }
  label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 8px; }
  input[type=password] { width: 100%; min-height: 54px; border-radius: 16px; border: 1px solid rgba(244,241,234,0.16); background: #1C1F1D;
    color: #F4F1EA; font-size: 17px; padding: 0 16px; outline: none; }
  input[type=password]:focus { border-color: #D4F171; }
  button { margin-top: 14px; width: 100%; min-height: 54px; border: 0; border-radius: 16px; background: #D4F171; color: #0A0B0A; font-size: 16px; font-weight: 600; cursor: pointer; }
  .error { margin: 12px 0 0; color: #F0897D; font-size: 14px; }
  .foot { margin-top: 22px; color: #8C918C; font-size: 13px; text-align: center; }
</style>
</head>
<body>
<main>
  <div class="mark" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#0A0B0A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  </div>
  <div class="eyebrow">PERFORM · TEAM PREVIEW</div>
  <h1>Train around your life.</h1>
  <p>This is a private test build. Enter the team password to continue.</p>
  <form method="post" action="/login">
    <input type="hidden" name="next" value="${escapeHtml(safeNext(next))}">
    <input type="text" name="username" value="team" autocomplete="username" hidden>
    <label for="password">Team password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
    ${error ? `<div class="error" role="alert">${escapeHtml(error)}</div>` : ''}
    <button type="submit">Enter</button>
  </form>
  <div class="foot">Don’t have it? Ask whoever shared this link.</div>
</main>
</body>
</html>`;
}

async function readBody(req, limit = 4096) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Body too large'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Map a URL path to a file in the static export, including [param] routes. */
export async function resolveFile(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const clean = path.posix.normalize(`/${decoded}`).replace(/\/+$/, '') || '/';
  const inside = (file) => {
    const resolved = path.resolve(root, `.${file}`);
    return resolved === root || resolved.startsWith(root + path.sep) ? resolved : null;
  };
  const isFile = async (file) => {
    const full = inside(file);
    if (!full) return null;
    try {
      return (await stat(full)).isFile() ? full : null;
    } catch {
      return null;
    }
  };

  if (clean === '/') return isFile('/index.html');
  for (const candidate of [clean, `${clean}.html`, `${clean}/index.html`]) {
    const found = await isFile(candidate);
    if (found) return found;
  }

  // Dynamic segments, e.g. /edit/work -> /edit/[section].html
  const segments = clean.split('/').filter(Boolean);
  let dir = root;
  for (let i = 0; i < segments.length; i += 1) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    const last = i === segments.length - 1;
    const dynamic = (e) => /^\[[^\]]+\]$/.test(e.name.replace(/\.html$/, ''));
    if (last) {
      const page = entries.find((e) => e.isFile() && e.name === `${segments[i]}.html`) ?? entries.find((e) => e.isFile() && e.name.endsWith('.html') && dynamic(e));
      return page ? path.join(dir, page.name) : null;
    }
    const next = entries.find((e) => e.isDirectory() && e.name === segments[i]) ?? entries.find((e) => e.isDirectory() && dynamic(e));
    if (!next) return null;
    dir = path.join(dir, next.name);
  }
  return null;
}

export function createApp({ root, password, secret, secure = false }) {
  if (!password) throw new Error('ACCESS_PASSWORD is required');
  const key = secret || sha256(`perform-session:${password}`).toString('hex');
  const absoluteRoot = path.resolve(root);
  const failures = new Map();
  const cache = new Map();

  const headers = (extra = {}) => ({ ...SECURITY_HEADERS, ...extra });
  // Behind an HTTPS proxy (Render, Fly...) the cookie is marked Secure.
  const cookie = (req, value, maxAge) => {
    const https = secure || String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https';
    return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${https ? '; Secure' : ''}`;
  };

  // The hosting proxy appends the real client address, so trust the last hop,
  // not the first (which the client can set to anything).
  const clientIp = (req) =>
    String(req.headers['x-forwarded-for'] ?? '').split(',').map((part) => part.trim()).filter(Boolean).pop() ||
    req.socket.remoteAddress ||
    'unknown';

  const over = (bucket, max) => {
    const entry = failures.get(bucket);
    return Boolean(entry && entry.reset >= Date.now() && entry.count >= max);
  };
  // Per-address limit, plus an overall cap in case addresses are rotated.
  const limited = (ip) => over(ip, MAX_FAILURES) || over('*', MAX_FAILURES_TOTAL);
  const fail = (ip) => {
    for (const bucket of [ip, '*']) {
      const entry = failures.get(bucket);
      if (!entry || entry.reset < Date.now()) failures.set(bucket, { count: 1, reset: Date.now() + FAILURE_WINDOW_MS });
      else entry.count += 1;
    }
  };

  async function load(file) {
    let entry = cache.get(file);
    if (!entry) {
      const body = await readFile(file);
      const ext = path.extname(file).toLowerCase();
      entry = { body, gzip: COMPRESSIBLE.has(ext) && body.length > 1024 ? gzipSync(body) : null, type: TYPES[ext] ?? 'application/octet-stream' };
      cache.set(file, entry);
    }
    return entry;
  }

  async function sendFile(req, res, file, status = 200) {
    const { body, gzip, type } = await load(file);
    const rel = `/${path.relative(absoluteRoot, file).split(path.sep).join('/')}`;
    const cacheControl = rel.startsWith('/_expo/static/')
      ? 'public, max-age=31536000, immutable'
      : type.startsWith('text/html')
        ? 'private, no-cache'
        : 'private, max-age=3600';
    const useGzip = gzip && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
    const payload = useGzip ? gzip : body;
    res.writeHead(status, headers({
      'Content-Type': type,
      'Content-Length': payload.length,
      'Cache-Control': cacheControl,
      Vary: 'Accept-Encoding',
      ...(useGzip ? { 'Content-Encoding': 'gzip' } : {}),
    }));
    res.end(req.method === 'HEAD' ? undefined : payload);
  }

  const html = (res, status, body, extra = {}) => {
    res.writeHead(status, headers({ 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store', ...extra }));
    res.end(body);
  };
  const redirect = (res, location, extra = {}) => {
    res.writeHead(303, headers({ Location: location, 'Cache-Control': 'no-store', ...extra }));
    res.end();
  };

  return async function handle(req, res) {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const { pathname } = url;
      const authed = verifyToken(key, parseCookies(req.headers.cookie)[COOKIE]);

      if (pathname === '/healthz') {
        res.writeHead(200, headers({ 'Content-Type': TYPES['.txt'], 'Cache-Control': 'no-store' }));
        return res.end('ok');
      }
      if (pathname === '/robots.txt') {
        res.writeHead(200, headers({ 'Content-Type': TYPES['.txt'] }));
        return res.end('User-agent: *\nDisallow: /\n');
      }

      if (pathname === '/login') {
        if (req.method === 'POST') {
          const ip = clientIp(req);
          const form = new URLSearchParams(await readBody(req));
          const next = safeNext(form.get('next'));
          if (limited(ip)) {
            return html(res, 429, loginPage({ next, error: 'Too many attempts. Try again in 15 minutes.' }));
          }
          if (!safeEqual(form.get('password') ?? '', password)) {
            fail(ip);
            return html(res, 401, loginPage({ next, error: 'That password didn’t work. Check it and try again.' }));
          }
          failures.delete(ip);
          return redirect(res, next, { 'Set-Cookie': cookie(req, createToken(key), SESSION_DAYS * 24 * 60 * 60) });
        }
        if (authed) return redirect(res, safeNext(url.searchParams.get('next')));
        return html(res, 200, loginPage({ next: url.searchParams.get('next') ?? '/' }));
      }

      if (pathname === '/logout') {
        return redirect(res, '/login', { 'Set-Cookie': cookie(req, '', 0) });
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, headers({ Allow: 'GET, HEAD' }));
        return res.end();
      }

      if (!authed && !PUBLIC_FILES.has(pathname)) {
        const wantsPage = String(req.headers.accept ?? '').includes('text/html') || !path.extname(pathname);
        if (wantsPage) return redirect(res, `/login?next=${encodeURIComponent(pathname + url.search)}`);
        res.writeHead(401, headers({ 'Content-Type': TYPES['.txt'], 'Cache-Control': 'no-store' }));
        return res.end('Sign in required');
      }

      const file = await resolveFile(absoluteRoot, pathname);
      if (file) return await sendFile(req, res, file);

      // Unknown route: let the app's own not-found screen handle it.
      const notFound = (await resolveFile(absoluteRoot, '/+not-found')) ?? (await resolveFile(absoluteRoot, '/'));
      if (notFound && !path.extname(pathname)) return await sendFile(req, res, notFound, 404);
      res.writeHead(404, headers({ 'Content-Type': TYPES['.txt'] }));
      return res.end('Not found');
    } catch (error) {
      const status = error?.status ?? 500;
      if (status === 500) console.error(error);
      if (!res.headersSent) res.writeHead(status, headers({ 'Content-Type': TYPES['.txt'] }));
      res.end(status === 413 ? 'Request too large' : 'Something went wrong');
    }
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(process.env.DIST_DIR ?? path.join(here, '..', 'dist'));
  const password = process.env.ACCESS_PASSWORD;
  if (!password) {
    console.error('Set ACCESS_PASSWORD to the team password before starting the server.');
    process.exit(1);
  }
  try {
    await stat(path.join(root, 'index.html'));
  } catch {
    console.error(`No web build found in ${root}. Run "npm run build:web" first.`);
    process.exit(1);
  }
  const port = Number(process.env.PORT ?? 3000);
  const secure = process.env.RENDER === 'true';
  const server = http.createServer(createApp({ root, password, secret: process.env.SESSION_SECRET, secure }));
  server.listen(port, () => console.log(`Perform is running at http://localhost:${port} (password protected)`));
}
