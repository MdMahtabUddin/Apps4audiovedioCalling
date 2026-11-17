import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { meetingService, userService } from '@/lib/db';
import { addLiveKitKnock } from '@/lib/livekit/livekit-knocks';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getCurrentUser();
    const { displayName, password } = await req.json();

    let meeting = await meetingService.getById(id);
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
      } catch (err) {
        console.warn('Auto create in join route warning:', err);
      }
    }

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
      return NextResponse.json({ error: 'This meeting has ended' }, { status: 410 });
    }

    const cookieHostId = req.cookies.get(`metromeet_host_${id}`)?.value;
    const isHost = session?.userId
      ? session.userId === activeMeeting.hostId
      : !!cookieHostId && cookieHostId === activeMeeting.hostId;

    // Check lock
    if (activeMeeting.isLocked && !isHost) {
      return NextResponse.json(
        { error: 'This meeting is locked by the host.' },
        { status: 403 }
      );
    }

    // Check password
    if (activeMeeting.hasPassword && !isHost) {
      if (!password || password !== activeMeeting.password) {
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
        finalName = u?.name || session.name || (isHost ? 'Host' : 'Participant');
      } else {
        finalName = isHost ? 'Meeting Host' : 'Guest User';
      }
    }

    const role = isHost ? 'HOST' : 'PARTICIPANT';
    // If meeting is password protected or has waiting room enabled, guests must wait in Waiting Room
    const requiresWaitingRoom = !isHost && (Boolean(activeMeeting.hasPassword) || Boolean(activeMeeting.waitingRoom));
    const isApproved = !requiresWaitingRoom;

    const participant = await meetingService.joinMeeting({
      meetingId: id,
      userId: session?.userId || null,
      name: finalName,
      role,
      isApproved,
    });

    if (requiresWaitingRoom) {
      await addLiveKitKnock(id, participant.id, finalName);
    }

    const response = NextResponse.json({
      success: true,
      participant: {
        id: participant.id,
        name: finalName,
        role,
        isApproved,
        isHost,
      },
      meeting: {
        id: activeMeeting.id,
        title: activeMeeting.title,
        hostId: activeMeeting.hostId,
        hostName: activeMeeting.hostName,
        isLocked: activeMeeting.isLocked,
        waitingRoom: true,
        settings: activeMeeting.settings,
      },
      status: isApproved ? 'JOINED' : 'WAITING_ROOM',
    });

    if (isHost) {
      response.cookies.set(`metromeet_host_${id}`, activeMeeting.hostId, {
        path: '/',
        httpOnly: true,
        maxAge: 86400,
        sameSite: 'lax',
      });
    }

    return response;
  } catch (error) {
    console.error('Join meeting error:', error);
    return NextResponse.json(
      { error: 'Failed to join meeting' },
      { status: 500 }
    );
  }
}
