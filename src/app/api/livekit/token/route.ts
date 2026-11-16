import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export async function GET(req: NextRequest) {
  try {
    const room = req.nextUrl.searchParams.get('room');
    const username = req.nextUrl.searchParams.get('username') || 'Guest';
    const identity =
      req.nextUrl.searchParams.get('identity') ||
      `${username}_${Math.random().toString(36).substring(2, 8)}`;

    if (!room) {
      return NextResponse.json({ error: 'Missing room parameter' }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json({
        isConfigured: false,
        message: 'LiveKit server credentials not configured in environment variables.',
      });
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: username,
      ttl: '12h',
    });

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      isConfigured: true,
      token,
      wsUrl,
    });
  } catch (error: any) {
    console.error('LiveKit token generation error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate token' },
      { status: 500 }
    );
  }
}
