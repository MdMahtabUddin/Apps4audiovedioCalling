import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { meetingService } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const meeting = await meetingService.getById(id);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    if (meeting.hostId !== session.userId) {
      return NextResponse.json(
        { error: 'Only the meeting host can end the meeting.' },
        { status: 403 }
      );
    }

    await meetingService.endMeeting(id, session.userId);

    return NextResponse.json({
      success: true,
      message: 'Meeting ended successfully',
    });
  } catch (error) {
    console.error('End meeting error:', error);
    return NextResponse.json({ error: 'Failed to end meeting' }, { status: 500 });
  }
}
