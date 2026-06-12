// Lightweight in-memory sliding-window rate limiter.
//
// Intended for abuse-prone unauthenticated endpoints (login, register, Telegram
// auth, checkout). Keyed by client IP. State lives in a per-process Map, so on
// Vercel's Fluid Compute it is shared across requests handled by the same warm
// instance but NOT across instances — it raises the bar against brute force and
// spam without external infrastructure, and is not a substitute for a
// distributed limiter (e.g. Upstash) if stronger guarantees are needed.

const buckets = new Map();

function clientIp(req) {
  // Vercel sets x-forwarded-for; take the first hop. Fall back to socket addr.
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export function rateLimit({ windowMs, max, message = 'Too many requests. Please try again shortly.' }) {
  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = `${req.method}:${req.baseUrl}${req.path}:${clientIp(req)}`;

    const hits = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);
    hits.push(now);
    buckets.set(key, hits);

    // Opportunistic cleanup so the Map can't grow unbounded on a long-lived
    // instance: drop this key once its window is empty (checked on next sweep).
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (v.every((ts) => now - ts >= windowMs)) buckets.delete(k);
      }
    }

    if (hits.length > max) {
      const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
      res.set('Retry-After', String(Math.max(retryAfter, 1)));
      return res.status(429).json({ message });
    }

    next();
  };
}
