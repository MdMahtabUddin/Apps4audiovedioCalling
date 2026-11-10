import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { meetingService } from '@/lib/db';
import { generateMeetingId } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, date, startTime, duration, timeZone, password, waitingRoom } = await req.json();

    const meetingId = generateMeetingId();

    const scheduled = await meetingService.schedule({
      title: title || 'Scheduled Meeting',
      hostId: session.userId,
      date: new Date(date),
      startTime: startTime || '10:00',
      duration: duration || 30,
      timeZone: timeZone || 'UTC',
      password: password || null,
      waitingRoom: !!waitingRoom,
      meetingId,
    });

    return NextResponse.json({ scheduled }, { status: 201 });
  } catch (error) {
    console.error('Schedule meeting error:', error);
    return NextResponse.json({ error: 'Failed to schedule meeting' }, { status: 500 });
  }
}
