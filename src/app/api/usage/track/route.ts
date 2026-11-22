import { NextRequest, NextResponse } from 'next/server';
import { MediaProviderType, recordProviderHeartbeat } from '@/lib/admin/usage-tracker';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const meetingId = String(body?.meetingId || '').trim();
    const meetingTitle = String(body?.meetingTitle || 'Live Meeting').trim();
    const provider = String(body?.provider || 'livekit') as MediaProviderType;
    const participantCount = Number(body?.participantCount || 1);
    const deltaSeconds = Number(body?.deltaSeconds || 30);

    if (!meetingId) {
      return NextResponse.json({ error: 'meetingId required' }, { status: 400 });
    }

    await recordProviderHeartbeat({
      meetingId,
      meetingTitle,
      provider,
      participantCount,
      deltaSeconds,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn('Usage track notice:', err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
