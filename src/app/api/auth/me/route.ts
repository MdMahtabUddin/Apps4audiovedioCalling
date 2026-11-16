import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { userService } from '@/lib/db';

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const dbUser = await userService.findById(session.userId);
  const user = dbUser || {
    id: session.userId,
    name: session.name || 'User',
    email: session.email,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(session.name || 'User')}`,
    emailVerified: true,
    createdAt: new Date(),
  };

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
