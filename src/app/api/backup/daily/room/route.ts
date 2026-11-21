import { NextRequest, NextResponse } from 'next/server';
import { getSystemConfig } from '@/lib/admin/system-config';

const DAILY_API_BASE = 'https://api.daily.co/v1';

function sanitizeRoomName(raw: string): string {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9-_]/g, '-').slice(0, 48);
  return `mm-${cleaned || 'room'}`;
}

export async function GET(request: NextRequest) {
  try {
    const sysConfig = await getSystemConfig();
    if (!sysConfig.backupEnabled || sysConfig.routingMode === 'webrtc' || sysConfig.routingMode === 'livekit') {
      return NextResponse.json({
        isConfigured: false,
        provider: 'daily',
        disabledByAdmin: true,
        message: 'Backup Daily.co provider disabled by Admin Panel.',
      });
    }

    const apiKey = process.env.DAILY_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({
        isConfigured: false,
        provider: 'daily',
        message: 'DAILY_API_KEY is not configured.',
      });
    }

    const { searchParams } = new URL(request.url);
    const roomParam = searchParams.get('room') || 'default';
    const username = (searchParams.get('username') || 'Participant').slice(0, 60);
    const isHost = searchParams.get('host') === 'true';

    const roomName = sanitizeRoomName(roomParam);
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    // 1. Check if Daily room already exists; otherwise create it
    let roomUrl: string | null = null;
    const existingRes = await fetch(`${DAILY_API_BASE}/rooms/${encodeURIComponent(roomName)}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (existingRes.ok) {
      const existingData = await existingRes.json();
      roomUrl = existingData?.url || null;
    } else {
      const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 6; // 6 hours
      const createRes = await fetch(`${DAILY_API_BASE}/rooms`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: roomName,
          privacy: 'public',
          properties: {
            exp,
            enable_chat: true,
            enable_screenshare: true,
            enable_hand_raising: true,
            enable_noise_cancellation_ui: true,
            start_audio_off: false,
            start_video_off: false,
          },
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text().catch(() => '');
        console.warn('Daily.co room creation failed:', createRes.status, errText);
        return NextResponse.json(
          { isConfigured: false, provider: 'daily', error: 'Failed to provision Daily backup room' },
          { status: 502 }
        );
      }

      const createdData = await createRes.json();
      roomUrl = createdData?.url || null;
    }

    if (!roomUrl) {
      return NextResponse.json(
        { isConfigured: false, provider: 'daily', error: 'Daily room URL missing' },
        { status: 502 }
      );
    }

    // 2. Mint participant meeting token for pre-filled display name & host permissions
    let token: string | null = null;
    try {
      const tokenRes = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          properties: {
            room_name: roomName,
            user_name: username,
            is_owner: isHost,
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 6,
          },
        }),
      });
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        token = tokenData?.token || null;
      }
    } catch {
      // Token is optional for public Daily rooms; fallback to roomUrl directly
    }

    return NextResponse.json({
      isConfigured: true,
      provider: 'daily',
      roomUrl,
      token,
    });
  } catch (err) {
    console.warn('Daily.co backup route error:', err);
    return NextResponse.json(
      { isConfigured: false, provider: 'daily', error: 'Backup provider unavailable' },
      { status: 500 }
    );
  }
}
