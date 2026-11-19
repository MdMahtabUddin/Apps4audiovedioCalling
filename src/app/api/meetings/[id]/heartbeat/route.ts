import { NextRequest, NextResponse } from 'next/server';
import { meetingService } from '@/lib/db';

// Periodic presence ping sent every 25 seconds while participant is active in the room.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { participantId } = await req.json();
    if (!participantId || typeof participantId !== 'string') {
      return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
    }
    await meetingService.recordHeartbeat(id, participantId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.warn('Heartbeat error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
