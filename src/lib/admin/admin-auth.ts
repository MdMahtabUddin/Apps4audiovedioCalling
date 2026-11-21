import crypto from 'crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE_NAME = 'metromeet_admin_session';

export function getAdminCredentials() {
  return {
    username: (process.env.ADMIN_USERNAME || 'admin').trim(),
    password: (process.env.ADMIN_PASSWORD || 'MetroAdmin@2026').trim(),
  };
}

function getSigningSecret(): string {
  return (
    process.env.JWT_SECRET ||
    process.env.ADMIN_PASSWORD ||
    'metromeet-secure-admin-session-secret-2026'
  );
}

export function createAdminSessionToken(username: string): string {
  const exp = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAdminSessionToken(token: string | undefined): { username: string } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto
    .createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('base64url');
  if (sig !== expected) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (!decoded?.u || typeof decoded.exp !== 'number' || decoded.exp < Date.now()) {
      return null;
    }
    return { username: String(decoded.u) };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<{ username: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}
