import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { meetingService, userService } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    let hostId = session?.userId;
    let guestHostToken: string | null = null;

    if (!hostId) {
      guestHostToken = 'gst_' + Math.random().toString(36).substring(2, 12);
      const guestHost = await userService.create({
        name: 'Meeting Host',
        email: `${guestHostToken}@metromeet.internal`,
        passwordHash: 'guest-disabled-password',
      });
      hostId = guestHost.id;
    }

    const { id, title, password, waitingRoom } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 });
    }

    const meeting = await meetingService.create({
      id,
      title: title || 'Instant Meeting',
      hostId,
      password: password || null,
      waitingRoom: !!waitingRoom,
    });

    const response = NextResponse.json({ meeting }, { status: 201 });
    if (guestHostToken) {
      response.cookies.set(`metromeet_host_${id}`, hostId, {
        path: '/',
        httpOnly: true,
        maxAge: 86400,
        sameSite: 'lax',
      });
    }
    return response;
  } catch (error) {
    console.error('Create meeting error:', error);
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const meetings = await meetingService.getRecentAndHistory(session.userId);
    return NextResponse.json({ meetings });
  } catch (error) {
    console.error('Get meetings error:', error);
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
  }
}
