import { NextRequest, NextResponse } from 'next/server';
import { meetingService } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const participants = await meetingService.getParticipants(id);

    return NextResponse.json({
      participants: participants.map((p) => ({
        id: p.id,
        userId: p.userId,
        name: p.guestName,
        role: p.role,
        isApproved: p.isApproved,
        joinedAt: p.joinedAt,
      })),
    });
  } catch (error) {
    console.error('Fetch participants error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch participants' },
      { status: 500 }
    );
  }
}
