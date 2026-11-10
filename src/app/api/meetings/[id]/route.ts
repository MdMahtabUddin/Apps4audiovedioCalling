import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { meetingService, userService } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getCurrentUser();

    let meeting = await meetingService.getById(id);

    // If meeting doesn't exist yet but was clicked via valid code, create instant session if user is logged in
    if (!meeting && session) {
      await meetingService.create({
        id,
        title: 'Instant Meeting',
        hostId: session.userId,
      });
      meeting = await meetingService.getById(id);
    }

    if (!meeting) {
      return NextResponse.json(
        { exists: false, error: 'Meeting not found' },
        { status: 404 }
      );
    }

    if (!meeting.isActive) {
      return NextResponse.json(
        { exists: true, isActive: false, error: 'This meeting has already ended' },
        { status: 410 }
      );
    }

    const isHost = session?.userId === meeting.hostId;

    return NextResponse.json({
      exists: true,
      id: meeting.id,
      title: meeting.title,
      hostId: meeting.hostId,
      hostName: meeting.hostName,
      isHost,
      requiresPassword: !!meeting.hasPassword && !isHost,
      isLocked: meeting.isLocked && !isHost,
      waitingRoom: meeting.waitingRoom && !isHost,
      isActive: meeting.isActive,
      participantCount: meeting.participantCount,
      settings: meeting.settings,
      startTime: meeting.startTime,
    });
  } catch (error) {
    console.error('Validate meeting error:', error);
    return NextResponse.json(
      { error: 'Internal server error validating meeting' },
      { status: 500 }
    );
  }
}
