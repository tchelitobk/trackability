import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { createApp, createToken, resolveFile, verifyToken } from './index.mjs';

let root;
let server;
let base;

const get = (pathname, init = {}) => fetch(base + pathname, { redirect: 'manual', ...init });
const login = (password, next = '/') =>
  get('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password, next }).toString(),
  });
const sessionFrom = (res) => res.headers.get('set-cookie')?.split(';')[0];

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'perform-dist-'));
  await mkdir(path.join(root, '_expo/static/js'), { recursive: true });
  await mkdir(path.join(root, 'edit'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), '<html>today</html>');
  await writeFile(path.join(root, 'plan.html'), '<html>plan</html>');
  await writeFile(path.join(root, 'edit/[section].html'), '<html>edit</html>');
  await writeFile(path.join(root, '+not-found.html'), '<html>missing</html>');
  await writeFile(path.join(root, '_expo/static/js/entry.js'), 'console.log("app");'.repeat(200));
  await writeFile(path.join(root, 'manifest.json'), '{"name":"Perform"}');
  server = http.createServer(createApp({ root, password: 'squad-2026' }));
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await rm(root, { recursive: true, force: true });
});

describe('access', () => {
  it('sends visitors without a session to the login page', async () => {
    const res = await get('/plan', { headers: { accept: 'text/html' } });
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/login?next=%2Fplan');
    const page = await get('/login');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Team password/);
  });

  it('refuses app files without a session', async () => {
    const res = await get('/_expo/static/js/entry.js');
    assert.equal(res.status, 401);
  });

  it('keeps the health check and home-screen manifest public', async () => {
    assert.equal((await get('/healthz')).status, 200);
    assert.equal((await get('/manifest.json')).status, 200);
  });

  it('rejects a wrong password', async () => {
    const res = await login('nope');
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('set-cookie'), null);
    assert.match(await res.text(), /didn’t work/);
  });

  it('signs in with the right password and returns to the page asked for', async () => {
    const res = await login('squad-2026', '/plan');
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/plan');
    const cookie = res.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    const page = await get('/plan', { headers: { cookie: sessionFrom(res) } });
    assert.equal(page.status, 200);
    assert.equal(await page.text(), '<html>plan</html>');
  });

  it('never redirects off-site after login', async () => {
    const res = await login('squad-2026', '//evil.example.com');
    assert.equal(res.headers.get('location'), '/');
  });

  it('marks the cookie Secure behind an HTTPS proxy', async () => {
    const res = await fetch(base + '/login', {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-forwarded-proto': 'https' },
      body: 'password=squad-2026',
    });
    assert.match(res.headers.get('set-cookie'), /; Secure/);
  });

  it('locks out an address after repeated wrong passwords', async () => {
    const attempt = () =>
      fetch(base + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '203.0.113.9' },
        body: 'password=guess',
      });
    for (let i = 0; i < 10; i += 1) assert.equal((await attempt()).status, 401);
    assert.equal((await attempt()).status, 429);
  });

  it('signs out', async () => {
    const res = await get('/logout');
    assert.equal(res.headers.get('location'), '/login');
    assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
  });
});

describe('serving the app', () => {
  let cookie;
  before(async () => {
    cookie = sessionFrom(await login('squad-2026'));
  });

  it('serves app routes, including dynamic ones', async () => {
    assert.equal(await (await get('/', { headers: { cookie } })).text(), '<html>today</html>');
    assert.equal(await (await get('/edit/work', { headers: { cookie } })).text(), '<html>edit</html>');
  });

  it('compresses and long-caches the hashed bundle', async () => {
    const res = await get('/_expo/static/js/entry.js', { headers: { cookie, 'accept-encoding': 'gzip' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-encoding'), 'gzip');
    assert.match(res.headers.get('cache-control'), /immutable/);
  });

  it('shows the app’s not-found page for unknown routes', async () => {
    const res = await get('/nowhere', { headers: { cookie } });
    assert.equal(res.status, 404);
    assert.equal(await res.text(), '<html>missing</html>');
  });

  it('cannot be tricked into reading files outside the build', async () => {
    for (const evil of ['/../package.json', '/%2e%2e/%2e%2e/etc/passwd', '/..%2f..%2fetc%2fpasswd']) {
      const res = await get(evil, { headers: { cookie } });
      assert.notEqual(await res.text(), '');
      assert.equal(await resolveFile(root, evil), null);
    }
  });
});

describe('tokens', () => {
  it('expire and cannot be forged', () => {
    const token = createToken('secret', 0);
    assert.equal(verifyToken('secret', token, 1000), true);
    assert.equal(verifyToken('other', token, 1000), false);
    assert.equal(verifyToken('secret', token, 61 * 24 * 60 * 60 * 1000), false);
    assert.equal(verifyToken('secret', token.replace(/.$/, 'x'), 1000), false);
  });
});
