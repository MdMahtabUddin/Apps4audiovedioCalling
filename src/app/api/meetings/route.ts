import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { meetingService, userService } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    let hostId = session?.userId;

    if (!hostId) {
      // If no session, create a guest host account or require auth
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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

    return NextResponse.json({ meeting }, { status: 201 });
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
