// Shared helpers for the Diwali 2026 API. Files starting with "_" are not deployed as routes.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const P = 'dw26:'; // Redis key prefix
export const K = {
  rsvps: P + 'rsvps', // hash: rsvpId -> JSON
  tok: P + 'tok', // hash: tokenHash -> rsvpId
  dishes: P + 'dishes', // hash: dishId -> JSON {id,rsvpId,type,item,ts}
};

function cfg() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new HttpError(503, 'Storage is not connected yet. Please try again later.');
  return { url: url.replace(/\/$/, ''), token };
}

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

async function call(path, payload) {
  const { url, token } = cfg();
  let r;
  try {
    r = await fetch(url + path, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new HttpError(503, 'Could not reach storage. Please try again in a moment.');
  }
  const data = await r.json().catch(() => null);
  if (!r.ok || !data) throw new HttpError(502, 'Storage error. Please try again.');
  return data;
}

/** Run one Redis command: redis('HGET', key, field) */
export async function redis(...cmd) {
  const d = await call('', cmd.map(String));
  if (d.error) throw new HttpError(502, 'Storage error: ' + d.error);
  return d.result;
}

/** Run several commands in one round trip. Returns results array. */
export async function pipeline(cmds) {
  if (!cmds.length) return [];
  const d = await call('/pipeline', cmds.map((c) => c.map(String)));
  return d.map((x) => {
    if (x.error) throw new HttpError(502, 'Storage error: ' + x.error);
    return x.result;
  });
}

/** EVAL a Lua script. */
export function lua(script, keys, args) {
  return redis('EVAL', script, keys.length, ...keys, ...args);
}

export function hgetallToObj(arr) {
  const o = {};
  if (Array.isArray(arr)) for (let i = 0; i < arr.length; i += 2) o[arr[i]] = arr[i + 1];
  return o;
}

export function parse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ---------- request helpers ----------

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    const p = parse(req.body);
    if (p && typeof p === 'object') return p;
    throw new HttpError(400, 'Request body must be JSON.');
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 20000) throw new HttpError(413, 'Request too large.');
  }
  if (!raw) return {};
  const p = parse(raw);
  if (!p || typeof p !== 'object') throw new HttpError(400, 'Request body must be JSON.');
  return p;
}

export function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.end(JSON.stringify(obj));
}

/** Wrap a handler with JSON error handling and method checks. */
export function route(methods, fn) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) {
        res.setHeader('Allow', methods.join(', '));
        throw new HttpError(405, 'Method not allowed.');
      }
      const out = await fn(req, res);
      if (!res.writableEnded) send(res, 200, { ok: true, ...out });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      send(res, status, {
        ok: false,
        error: e instanceof HttpError ? e.message : 'Something went wrong on our side. Please try again.',
        ...(e && e.extra),
      });
    }
  };
}

// ---------- validation ----------

/** Trim, strip control/zero-width chars, collapse whitespace, enforce length. */
export function text(v, { max, required = false, label = 'Field', multiline = false } = {}) {
  if (v == null) v = '';
  if (typeof v !== 'string' && typeof v !== 'number') throw new HttpError(400, label + ' is invalid.');
  let s = String(v)
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '');
  s = multiline ? s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : s.replace(/\s+/g, ' ').trim();
  if (required && !s) throw new HttpError(400, label + ' is required.');
  if ([...s].length > max) throw new HttpError(400, `${label} is too long (max ${max} characters).`);
  return s;
}

export function int(v, { min, max, label = 'Number', dflt = 0 } = {}) {
  if (v === '' || v == null) v = dflt;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${label} must be a whole number from ${min} to ${max}.`);
  return n;
}

export function honeypot(body) {
  return typeof body.website === 'string' && body.website.trim() !== '';
}

// ---------- tokens / auth ----------

export const newToken = () => randomBytes(18).toString('base64url');
export const newId = (n = 8) => randomBytes(n).toString('base64url').replace(/[-_]/g, 'x');
export const sha = (s) => createHash('sha256').update(String(s)).digest('hex');

export function guestToken(req) {
  const t = req.headers['x-guest-token'];
  return typeof t === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(t) ? t : null;
}

export function ip(req) {
  const xf = req.headers['x-forwarded-for'];
  return (typeof xf === 'string' && xf.split(',')[0].trim()) || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

/** Fixed-window rate limit per IP. */
export async function rateLimit(req, bucket, limit, windowSec) {
  const key = `${P}rl:${bucket}:${sha(ip(req)).slice(0, 16)}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  const [n] = await pipeline([
    ['INCR', key],
    ['EXPIRE', key, windowSec],
  ]);
  if (n > limit) throw new HttpError(429, 'Whoa, that is a lot of requests. Please wait a few minutes and try again.');
}

export async function requireAdmin(req) {
  // Trim both sides: a stray space or newline pasted into the dashboard shouldn't lock the host out.
  const expected = (process.env.DIWALI_ADMIN_KEY || '').trim();
  if (!expected) throw new HttpError(503, 'Admin key is not configured on the server.');
  const given = typeof req.headers['x-admin-key'] === 'string' ? req.headers['x-admin-key'].trim() : null;
  const ok =
    typeof given === 'string' &&
    timingSafeEqual(Buffer.from(sha(given), 'hex'), Buffer.from(sha(expected), 'hex'));
  if (!ok) {
    await rateLimit(req, 'adminfail', 10, 600);
    throw new HttpError(401, 'Wrong passphrase.');
  }
}

/** "Chinmay Murugkar" -> "Chinmay M." */
export function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Guest';
  if (parts.length === 1) return parts[0];
  const last = [...parts[parts.length - 1]][0] || '';
  return `${parts[0]} ${last.toUpperCase()}.`;
}

// ---------- data loading ----------

export async function loadDishes() {
  const raw = hgetallToObj(await redis('HGETALL', K.dishes));
  return Object.values(raw).map(parse).filter(Boolean).sort((a, b) => a.ts - b.ts);
}

/** The RSVP that owns this guest token, or null. */
export async function rsvpForToken(token) {
  if (!token) return null;
  const id = await redis('HGET', K.tok, sha(token));
  return id ? parse(await redis('HGET', K.rsvps, id)) : null;
}

export async function loadRsvps() {
  const raw = hgetallToObj(await redis('HGETALL', K.rsvps));
  return Object.values(raw).map(parse).filter(Boolean).sort((a, b) => a.created - b.created);
}

