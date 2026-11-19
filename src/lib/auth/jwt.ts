import jwt from 'jsonwebtoken';

const DEFAULT_JWT_SECRET = 'metromeet-secure-jwt-secret-key-production-ready';
const TOKEN_EXPIRY = '7d';

function getSecret(): string {
  return process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || DEFAULT_JWT_SECRET;
}

export interface TokenPayload {
  userId: string;
  email: string;
  name: string;
}

export function signToken(payload: TokenPayload): string {
  const secret = getSecret();
  return jwt.sign(payload, secret, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): TokenPayload | null {
  const secret = getSecret();
  try {
    return jwt.verify(token, secret) as TokenPayload;
  } catch {
    return null;
  }
}
