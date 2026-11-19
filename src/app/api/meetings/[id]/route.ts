import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { meetingService, userService } from '@/lib/db';
import { getMeetingFromLiveKit } from '@/lib/livekit/livekit-knocks';

export async function PATCH(
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
      return NextResponse.json({ error: 'Only the host can change room settings.' }, { status: 403 });
    }
    const body = await req.json();
    if (typeof body.isLocked === 'boolean') {
      await meetingService.lockMeeting(id, session.userId, body.isLocked);
    }
    return NextResponse.json({ success: true, isLocked: body.isLocked });
  } catch (error) {
    console.error('Update meeting error:', error);
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getCurrentUser();

    let meeting = await meetingService.getById(id);

    // Check LiveKit Cloud centralized store for cross-container availability on Vercel
    if (!meeting) {
      const cloudMeeting = await getMeetingFromLiveKit(id);
      if (cloudMeeting) {
        meeting = {
          ...cloudMeeting,
          hostName: cloudMeeting.hostName || 'Meeting Host',
          hostEmail: '',
          hostAvatar: null,
          hasPassword: Boolean(cloudMeeting.password && cloudMeeting.password.trim()),
          waitingRoom: Boolean(cloudMeeting.waitingRoom) || Boolean(cloudMeeting.password && cloudMeeting.password.trim()),
          participantCount: 0,
          settings: {
            allowChat: true,
            allowScreenShare: true,
            muteOnEntry: false,
            allowReactions: true,
          },
        } as any;
      }
    }

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

    const cookieHostId = req.cookies.get(`metromeet_host_${id}`)?.value;
    const isHost = session?.userId
      ? session.userId === activeMeeting.hostId
      : !!cookieHostId && cookieHostId === activeMeeting.hostId;

    return NextResponse.json({
      exists: true,
      id: activeMeeting.id,
      title: activeMeeting.title,
      hostId: activeMeeting.hostId,
      hostName: activeMeeting.hostName,
      isHost,
      requiresPassword: !!activeMeeting.hasPassword && !isHost,
      isLocked: activeMeeting.isLocked && !isHost,
      waitingRoom: Boolean(activeMeeting.waitingRoom) && !isHost,
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
