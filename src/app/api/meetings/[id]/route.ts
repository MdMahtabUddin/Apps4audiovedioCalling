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

    // If meeting doesn't exist yet, automatically initialize as an instant meeting session
    if (!meeting) {
      try {
        let hostId = session?.userId;
        if (!hostId) {
          const guestHost = await userService.getOrCreateGuestHost();
          hostId = guestHost.id;
        }

        await meetingService.create({
          id,
          title: 'Instant Meeting',
          hostId,
        });
        meeting = await meetingService.getById(id);
      } catch (e) {
        console.warn('Auto-create meeting in DB note (using fallback):', e);
      }
    }

    // Resilient fallback: If DB didn't return, instantiate dynamic session
    if (!meeting) {
      meeting = {
        id,
        title: 'Instant Meeting',
        hostId: session?.userId || 'guest_host_system',
        hostName: session?.name || 'Meeting Host',
        hostEmail: session?.email || '',
        hostAvatar: null,
        password: null,
        hasPassword: false,
        isLocked: false,
        waitingRoom: false,
        isActive: true,
        startTime: new Date().toISOString(),
        endTime: null,
        participantCount: 0,
        settings: {
          allowChat: true,
          allowScreenShare: true,
          muteOnEntry: false,
          allowReactions: true,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any;
    }

    const activeMeeting = meeting!;

    if (!activeMeeting.isActive) {
      return NextResponse.json(
        { exists: true, isActive: false, error: 'This meeting has already ended' },
        { status: 410 }
      );
    }

    const activeParticipants = await meetingService.getParticipants(id);
    const hasActiveHost = activeParticipants.some((p: any) => p.role === 'HOST' && !p.leftAt);

    const cookieHostId = req.cookies.get(`metromeet_host_${id}`)?.value;
    let isHost = session?.userId
      ? session.userId === activeMeeting.hostId
      : !!cookieHostId && cookieHostId === activeMeeting.hostId;

    // First person rule: If the meeting has NO active host yet, this first visitor is the host organizer!
    if (!hasActiveHost && (!activeMeeting.hostId || activeMeeting.hostId === 'guest_host_system' || activeMeeting.hostId.startsWith('usr_guest_') || activeMeeting.hostId.startsWith('gst_') || !cookieHostId)) {
      isHost = true;
    }

    return NextResponse.json({
      exists: true,
      id: activeMeeting.id,
      title: activeMeeting.title,
      hostId: activeMeeting.hostId,
      hostName: activeMeeting.hostName,
      isHost,
      requiresPassword: !!activeMeeting.hasPassword && !isHost,
      isLocked: activeMeeting.isLocked && !isHost,
      waitingRoom: !isHost,
      isActive: activeMeeting.isActive,
      participantCount: activeMeeting.participantCount,
      settings: activeMeeting.settings,
      startTime: activeMeeting.startTime,
    });
  } catch (error) {
    console.error('Validate meeting error:', error);
    return NextResponse.json(
      { error: 'Internal server error validating meeting' },
      { status: 500 }
    );
  }
}
