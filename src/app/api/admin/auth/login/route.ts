import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  getAdminCredentials,
} from '@/lib/admin/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = String(body?.username || '').trim();
    const password = String(body?.password || '').trim();

    const expected = getAdminCredentials();
    const normalizedInput = username.toLowerCase();
    const normalizedExpected = expected.username.toLowerCase();
    const usernameMatches =
      normalizedInput === normalizedExpected ||
      (normalizedExpected === 'admin' && normalizedInput === 'admin@gmail.com');

    if (!usernameMatches || password !== expected.password) {
      return NextResponse.json(
        { error: 'Invalid admin username or password' },
        { status: 401 }
      );
    }

    const token = createAdminSessionToken(expected.username);
    const res = NextResponse.json({ ok: true, username: expected.username });
    res.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
