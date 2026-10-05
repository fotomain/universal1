// Auth server for native Google sign-in (same pattern as expo-w1/app/api/auth).
//
//   app  -> GET  /api/auth/authorize  -> Google consent page
//   Google -> GET /api/auth/callback  -> back to the app (myapp://?code=...)
//   app  -> POST /api/auth/token      -> our own access + refresh tokens (JWT)
//   app  -> POST /api/auth/refresh    -> new access + refresh tokens
//
// The Google client secret stays here on the server; the app never sees it.
// Needs in .env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET.
// In Google Cloud the client must allow the redirect URI  <AUTH_BASE_URL>/api/auth/callback
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as jose from 'jose';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const line of fs.existsSync(path.join(ROOT, '.env')) ? fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n') : []) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}

const PORT = Number(process.env.AUTH_SERVER_PORT || 8089);
const BASE_URL = (process.env.EXPO_PUBLIC_AUTH_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_REDIRECT_URI = `${BASE_URL}/api/auth/callback`;
// App schemes the sign-in is allowed to return to.
const APP_SCHEMES = (process.env.AUTH_APP_SCHEMES || 'myapp').split(',').map(s => s.trim()).filter(Boolean);
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';

const missing = Object.entries({ GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET }).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`[auth] Missing in .env: ${missing.join(', ')}`);
  process.exit(1);
}
const key = new TextEncoder().encode(JWT_SECRET);

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
const redirect = (res, to) => { res.writeHead(302, { Location: to }); res.end(); };
const isAppRedirect = uri => !!uri && APP_SCHEMES.some(s => uri.startsWith(s + '://'));

const readBody = req => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 1e5) reject(new Error('body too large')); });
  req.on('end', () => {
    try {
      if ((req.headers['content-type'] || '').includes('application/json')) resolve(JSON.parse(raw || '{}'));
      else resolve(Object.fromEntries(new URLSearchParams(raw)));
    } catch (e) { reject(e); }
  });
  req.on('error', reject);
});

const issueTokens = async profile => {
  const { sub, name, email, picture, given_name, family_name, email_verified } = profile;
  const claims = { name, email, picture, given_name, family_name, email_verified };
  const accessToken = await new jose.SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setIssuedAt().setExpirationTime(ACCESS_TOKEN_TTL).sign(key);
  const refreshToken = await new jose.SignJWT({ ...claims, type: 'refresh', jti: crypto.randomUUID() })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setIssuedAt().setExpirationTime(REFRESH_TOKEN_TTL).sign(key);
  return { accessToken, refreshToken };
};

const routes = {
  // Step 1: send the user to Google. "state" carries the app's return address.
  'GET /api/auth/authorize': async (req, res, url) => {
    const appRedirect = url.searchParams.get('redirect_uri');
    const state = url.searchParams.get('state');
    if (url.searchParams.get('client_id') !== 'google') return json(res, 400, { error: 'Invalid client' });
    if (!isAppRedirect(appRedirect)) return json(res, 400, { error: 'Invalid redirect_uri' });
    if (!state) return json(res, 400, { error: 'Invalid state' });
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: url.searchParams.get('scope') || 'openid profile email',
      state: Buffer.from(JSON.stringify({ r: appRedirect, s: state })).toString('base64url'),
      prompt: 'select_account',
    });
    redirect(res, 'https://accounts.google.com/o/oauth2/v2/auth?' + params);
  },

  // Step 2: Google comes back here; pass the code on to the app.
  'GET /api/auth/callback': async (req, res, url) => {
    let st;
    try { st = JSON.parse(Buffer.from(url.searchParams.get('state') || '', 'base64url').toString()); } catch (_) {}
    if (!st || !isAppRedirect(st.r)) return json(res, 400, { error: 'Invalid state' });
    // auth_flow marks the link as ours, so the app's Supabase email-link handler leaves it alone
    const out = new URLSearchParams({ state: st.s, auth_flow: 'google' });
    if (url.searchParams.get('error')) out.set('error', url.searchParams.get('error'));
    else out.set('code', url.searchParams.get('code') || '');
    console.log('[auth] returning to app at', st.r, url.searchParams.get('error') ? 'with error ' + url.searchParams.get('error') : 'with code');
    redirect(res, st.r + (st.r.includes('?') ? '&' : '?') + out);
  },

  // Step 3: swap Google's code for our own tokens.
  'POST /api/auth/token': async (req, res) => {
    const body = await readBody(req);
    if (!body.code) return json(res, 400, { error: 'Missing authorization code' });
    console.log('[auth] exchanging code with Google...');
    const g = await fetch('https://oauth2.googleapis.com/token', {
      signal: AbortSignal.timeout(15000),
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
        code: body.code,
      }),
    });
    const data = await g.json();
    if (data.error || !data.id_token) {
      console.error('[auth] Google token exchange failed:', data.error, data.error_description || '');
      return json(res, 400, { error: data.error || 'no_id_token', error_description: data.error_description });
    }
    const tokens = await issueTokens(jose.decodeJwt(data.id_token));
    console.log('[auth] Google accepted the code; tokens sent to the app');
    // idToken: Google's own signed token. The app uses it once to sign in to Supabase as the same user as on web.
    json(res, 200, { ...tokens, idToken: data.id_token });
  },

  // Step 4: rotate tokens using the refresh token.
  'POST /api/auth/refresh': async (req, res) => {
    const body = await readBody(req);
    try {
      const { payload } = await jose.jwtVerify(body.refreshToken || '', key);
      if (payload.type !== 'refresh') throw new Error('not a refresh token');
      json(res, 200, await issueTokens(payload));
    } catch (e) {
      json(res, 401, { error: 'Invalid or expired refresh token' });
    }
  },

  'GET /api/auth/health': async (req, res) => json(res, 200, { ok: true }),
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE_URL);
  const handler = routes[`${req.method} ${url.pathname}`];
  console.log(`[auth] ${new Date().toISOString().slice(11, 19)} ${req.method} ${url.pathname}`);
  if (!handler) return json(res, 404, { error: 'Not found' });
  try {
    await handler(req, res, url);
  } catch (e) {
    console.error('[auth]', url.pathname, e?.message || e);
    if (!res.headersSent) json(res, 500, { error: 'Server error' });
  }
}).listen(PORT, () => {
  console.log(`[auth] listening on ${BASE_URL}`);
  console.log(`[auth] Google redirect URI to allow: ${GOOGLE_REDIRECT_URI}`);
});
