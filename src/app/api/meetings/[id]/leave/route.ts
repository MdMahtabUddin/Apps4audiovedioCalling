import { NextRequest, NextResponse } from 'next/server';
import { meetingService } from '@/lib/db';

// Records the real time a participant left. Called on "Leave", unmount, and via sendBeacon when the tab closes.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const text = await req.text();
    let body: { participantId?: string; isHost?: boolean } = {};
    try {
      body = JSON.parse(text) || {};
    } catch {
      body = {};
    }
    const participantId = body.participantId;
    if (!participantId || typeof participantId !== 'string') {
      return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
    }
    await meetingService.leaveMeeting(id, participantId, Boolean(body.isHost));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Leave meeting error:', error);
    return NextResponse.json({ error: 'Failed to record leave' }, { status: 500 });
  }
}
