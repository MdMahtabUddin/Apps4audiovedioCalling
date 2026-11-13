import { NextRequest, NextResponse } from 'next/server';
import { meetingService } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const participants = await meetingService.getParticipants(id);
    const meeting = await meetingService.getById(id);

    const approvedList = participants
      .filter((p: any) => p.isApproved)
      .map((p: any) => ({
        id: p.id,
        userId: p.userId,
        name: p.guestName || p.user?.name || 'Participant',
        displayName: p.guestName || p.user?.name || 'Participant',
        role: p.role,
        avatar: p.user?.avatar || null,
        isApproved: p.isApproved,
        joinedAt: p.joinedAt,
      }));

    // If host is not present in approved participants, inject host
    if (meeting && !approvedList.some((p: any) => p.userId === meeting.hostId || p.role === 'HOST')) {
      approvedList.unshift({
        id: `host_${meeting.hostId}`,
        userId: meeting.hostId,
        name: meeting.hostName || 'Host',
        displayName: meeting.hostName || 'Host',
        role: 'HOST',
        avatar: meeting.hostAvatar || null,
        isApproved: true,
        joinedAt: meeting.startTime || new Date().toISOString(),
      });
    }

    return NextResponse.json({
      participants: approvedList,
      count: approvedList.length,
    });
  } catch (error) {
    console.error('Fetch participants error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch participants' },
      { status: 500 }
    );
  }
}
