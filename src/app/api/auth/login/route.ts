import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { signToken } from '@/lib/auth/jwt';
import { AUTH_COOKIE_NAME } from '@/lib/auth/session';

// Basic in-memory brute-force protection: 8 failed attempts per IP+email per 10 minutes.
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function attemptKey(req: NextRequest, email: string) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return `${ip}:${String(email).toLowerCase().trim()}`;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const key = attemptKey(req, email);
    const record = failedAttempts.get(key);
    if (record && record.resetAt > Date.now() && record.count >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Too many failed login attempts. Please try again in a few minutes.' },
        { status: 429 }
      );
    }
    const registerFailure = () => {
      const now = Date.now();
      const current = failedAttempts.get(key);
      if (!current || current.resetAt <= now) {
        failedAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
      } else {
        current.count += 1;
      }
    };

    const user = await userService.findByEmail(email);
    if (!user) {
      registerFailure();
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      registerFailure();
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }
    failedAttempts.delete(key);

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json(
      {
        message: 'Logged in successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          emailVerified: user.emailVerified,
        },
      },
      { status: 200 }
    );

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error during login.' },
      { status: 500 }
    );
  }
}
