import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { meetingService } from '@/lib/db';

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
    const waitingList = await meetingService.getWaitingParticipants(id);

    return NextResponse.json({
      waitingList: waitingList.map((p: any) => ({
        id: p.id,
        displayName: p.guestName || p.user?.name || 'Guest User',
        userId: p.userId,
        role: p.role,
        joinedAt: p.joinedAt,
      })),
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

    if (action === 'ADMIT' && participantId) {
      await meetingService.admitParticipant(participantId);
      return NextResponse.json({ success: true, message: 'Participant admitted' });
    }

    if (action === 'DENY' && participantId) {
      await meetingService.denyParticipant(participantId);
      return NextResponse.json({ success: true, message: 'Participant denied' });
    }

    if (action === 'ADMIT_ALL') {
      await meetingService.admitAllWaiting(id);
      return NextResponse.json({ success: true, message: 'All waiting participants admitted' });
    }

    return NextResponse.json({ error: 'Invalid knock action' }, { status: 400 });
  } catch (error) {
    console.error('Error in knocks POST:', error);
    return NextResponse.json({ error: 'Failed to process knock action' }, { status: 500 });
  }
}
