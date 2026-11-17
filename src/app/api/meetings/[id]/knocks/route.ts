import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { meetingService } from '@/lib/db';
import {
  getLiveKitKnocks,
  getLiveKitKnockStatus,
  updateLiveKitKnockStatus,
} from '@/lib/livekit/livekit-knocks';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const participantId = searchParams.get('participantId');

    // If querying specific participant status
    if (participantId) {
      // 1. Check LiveKit cloud room metadata first
      const lkStatus = await getLiveKitKnockStatus(id, participantId);
      if (lkStatus !== 'NOT_FOUND') {
        return NextResponse.json({ status: lkStatus });
      }

      // 2. Fallback to meetingService
      const participant = await meetingService.getParticipantById(participantId);
      if (!participant) {
        return NextResponse.json({ status: 'NOT_FOUND' }, { status: 404 });
      }

      if (participant.leftAt) {
        return NextResponse.json({ status: 'DENIED' });
      }

      if (participant.isApproved) {
        return NextResponse.json({ status: 'APPROVED' });
      }

      return NextResponse.json({ status: 'WAITING' });
    }

    // Otherwise, return all waiting participants for the meeting
    const lkKnocks = await getLiveKitKnocks(id);
    const dbWaitingList = await meetingService.getWaitingParticipants(id);

    // Merge waiting lists
    const map = new Map<string, { id: string; displayName: string; role: string; joinedAt: string }>();

    dbWaitingList.forEach((p: any) => {
      map.set(p.id, {
        id: p.id,
        displayName: p.guestName || p.user?.name || 'Guest User',
        role: p.role,
        joinedAt: p.joinedAt,
      });
    });

    lkKnocks.forEach((k) => {
      map.set(k.id, {
        id: k.id,
        displayName: k.displayName,
        role: 'PARTICIPANT',
        joinedAt: k.joinedAt,
      });
    });

    const waitingList = Array.from(map.values());

    return NextResponse.json({
      waitingList,
      count: waitingList.length,
    });
  } catch (error) {
    console.error('Error in knocks GET:', error);
    return NextResponse.json({ error: 'Failed to fetch knocks' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getCurrentUser();
    const meeting = await meetingService.getById(id);

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const { action, participantId } = await req.json();

    if ((action === 'ADMIT' || action === 'APPROVE') && participantId) {
      await updateLiveKitKnockStatus(id, participantId, 'APPROVED');
      await meetingService.admitParticipant(participantId);
      return NextResponse.json({ success: true, message: 'Participant admitted' });
    }

    if ((action === 'DENY' || action === 'REJECT') && participantId) {
      await updateLiveKitKnockStatus(id, participantId, 'DENIED');
      await meetingService.denyParticipant(participantId);
      return NextResponse.json({ success: true, message: 'Participant denied' });
    }

    if (action === 'ADMIT_ALL') {
      const lkKnocks = await getLiveKitKnocks(id);
      for (const k of lkKnocks) {
        await updateLiveKitKnockStatus(id, k.id, 'APPROVED');
      }
      await meetingService.admitAllWaiting(id);
      return NextResponse.json({ success: true, message: 'All waiting participants admitted' });
    }

    return NextResponse.json({ error: 'Invalid knock action' }, { status: 400 });
  } catch (error) {
    console.error('Error in knocks POST:', error);
    return NextResponse.json({ error: 'Failed to process knock action' }, { status: 500 });
  }
}
