// api/_lib/security.js — shared security helpers for the serverless API.
// Files/dirs prefixed with "_" are not exposed as routes by Vercel but remain importable.
import crypto from 'crypto';

// Origins permitted to call the API. Configure via ALLOWED_ORIGINS (comma separated).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'https://jacal.io,https://www.jacal.io')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Apply a restrictive, origin-allowlisted CORS policy. Returns the matched origin (or null).
export function applyCors(req, res, { methods = 'POST, OPTIONS' } = {}) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Internal-Secret');
  res.setHeader('Content-Type', 'application/json');
  return origin && ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

// Cryptographically strong, unguessable token. Replaces Math.random()-based tokens.
export function generateSecureToken(prefix = 'tok') {
  return `${prefix}_${crypto.randomBytes(32).toString('hex')}`;
}

// Best-effort in-memory rate limiter. Note: serverless instances are ephemeral and not
// shared, so this throttles bursts on a warm instance rather than providing global limits.
// For hard guarantees, back this with a shared store (e.g. Supabase/Redis).
const rateBuckets = new Map();
export function rateLimit(key, { max = 5, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const hits = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) return false;
  hits.push(now);
  rateBuckets.set(key, hits);
  return true;
}

// Best-effort client IP from proxy headers.
export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

// Constant-time string comparison for secrets/tokens.
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
