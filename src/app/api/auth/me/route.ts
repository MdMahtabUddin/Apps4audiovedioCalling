import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { userService } from '@/lib/db';

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = await userService.findById(session.userId);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    },
  });
}
