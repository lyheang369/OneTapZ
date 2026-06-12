import jwt from 'jsonwebtoken';

const DEV_FALLBACK = 'dev-only-change-me';

// Resolve the JWT signing/verification secret. In production a missing secret is
// a hard failure — falling back to a hardcoded value would let anyone forge
// tokens (full auth bypass). Only dev/test may use the throwaway fallback.
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not set — refusing to sign/verify tokens with a default secret.');
  }
  return DEV_FALLBACK;
}

export function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, getJwtSecret(), { expiresIn: '7d' });
}
