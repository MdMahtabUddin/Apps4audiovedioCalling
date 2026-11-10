import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { meetingService, userService } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getCurrentUser();
    const { displayName, password } = await req.json();

    const meeting = await meetingService.getById(id);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    if (!meeting.isActive) {
      return NextResponse.json({ error: 'This meeting has ended' }, { status: 410 });
    }

    const isHost = session?.userId === meeting.hostId;

    // Check lock
    if (meeting.isLocked && !isHost) {
      return NextResponse.json(
        { error: 'This meeting is locked by the host.' },
        { status: 403 }
      );
    }

    // Check password
    if (meeting.hasPassword && !isHost) {
      if (!password || password !== meeting.password) {
        return NextResponse.json(
          { error: 'Invalid meeting password.' },
          { status: 401 }
        );
      }
    }

    let finalName = displayName?.trim();
    if (!finalName) {
      if (session) {
        const u = await userService.findById(session.userId);
        finalName = u?.name || 'Participant';
      } else {
        finalName = 'Guest User';
      }
    }

    const role = isHost ? 'HOST' : 'PARTICIPANT';
    const isApproved = isHost || !meeting.waitingRoom;

    const participant = await meetingService.joinMeeting({
      meetingId: id,
      userId: session?.userId || null,
      name: finalName,
      role,
      isApproved,
    });

    return NextResponse.json({
      success: true,
      participant: {
        id: participant.id,
        name: finalName,
        role,
        isApproved,
        isHost,
      },
      meeting: {
        id: meeting.id,
        title: meeting.title,
        hostId: meeting.hostId,
        hostName: meeting.hostName,
        isLocked: meeting.isLocked,
        waitingRoom: meeting.waitingRoom,
        settings: meeting.settings,
      },
      status: isApproved ? 'JOINED' : 'WAITING_ROOM',
    });
  } catch (error) {
    console.error('Join meeting error:', error);
    return NextResponse.json(
      { error: 'Failed to join meeting' },
      { status: 500 }
    );
  }
}
