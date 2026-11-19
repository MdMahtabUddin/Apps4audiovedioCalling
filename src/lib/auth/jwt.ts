import jwt from 'jsonwebtoken';

const DEV_FALLBACK_SECRET = 'metromeet-dev-only-secret-do-not-use-in-production';
const TOKEN_EXPIRY = '7d';

// In production a real secret is mandatory; a hardcoded fallback would let anyone forge login tokens.
function getSecret(): string | null {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') return null;
  return DEV_FALLBACK_SECRET;
}

export interface TokenPayload {
  userId: string;
  email: string;
  name: string;
}

export function signToken(payload: TokenPayload): string {
  const secret = getSecret();
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set. Configure it in your hosting dashboard.');
  }
  return jwt.sign(payload, secret, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): TokenPayload | null {
  const secret = getSecret();
  if (!secret) return null;
  try {
    return jwt.verify(token, secret) as TokenPayload;
  } catch {
    return null;
  }
}
