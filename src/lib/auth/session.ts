import { cookies } from 'next/headers';
import { verifyToken, TokenPayload } from './jwt';

export const AUTH_COOKIE_NAME = 'metromeet_auth_token';

export async function getCurrentUser(): Promise<TokenPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}
