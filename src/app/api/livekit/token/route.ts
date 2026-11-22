import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { getSystemConfig } from '@/lib/admin/system-config';
import { getProviderUsageSummary, recordProviderHeartbeat } from '@/lib/admin/usage-tracker';

export async function GET(req: NextRequest) {
  try {
    const sysConfig = await getSystemConfig();
    if (
      !sysConfig.primaryEnabled ||
      sysConfig.routingMode === 'agora' ||
      sysConfig.routingMode === 'daily' ||
      sysConfig.routingMode === 'webrtc'
    ) {
      return NextResponse.json({
        isConfigured: false,
        disabledByAdmin: true,
        message: 'Primary LiveKit provider paused by Admin Panel. Routing to backup.',
      });
    }

    // Smart Auto-Quota Guard: if LiveKit reaches >= 4,900 / 5,000 free mins and Agora Backup is ready, auto-route to Agora before hitting a hard error
    const agoraReady =
      sysConfig.routingMode === 'auto' &&
      sysConfig.agoraEnabled &&
      Boolean((process.env.AGORA_APP_ID || process.env.NEXT_PUBLIC_AGORA_APP_ID || '').trim());
    if (agoraReady) {
      try {
        const usage = await getProviderUsageSummary();
        if (usage.quotas.livekit.usedMinutes >= 4900) {
          return NextResponse.json({
            isConfigured: false,
            quotaGuardTriggered: true,
            message: 'LiveKit monthly quota near limit — auto-routing to Agora Backup Cloud.',
          });
        }
      } catch {
        // Non-blocking: continue with LiveKit if usage check fails
      }
    }

    const room = req.nextUrl.searchParams.get('room');
    const username = req.nextUrl.searchParams.get('username') || 'Guest';
    const identity =
      req.nextUrl.searchParams.get('identity') ||
      `${username}_${Math.random().toString(36).substring(2, 8)}`;

    if (!room) {
      return NextResponse.json({ error: 'Missing room parameter' }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY || 'APIa2BuzPQWD3Vn';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'gjDmc9QfM68VI45DofbIjQIcAoFAhCuPzPz8jTNGCRc';
    let wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || 'wss://metromeet-wjbjv475.livekit.cloud';

    if (!apiKey || !apiSecret || !wsUrl || apiSecret.includes('•') || apiSecret.length < 16) {
      return NextResponse.json({
        isConfigured: false,
        message: 'LiveKit server credentials not properly configured (secret key is masked with dots or invalid). Falling back to WebRTC engine.',
      });
    }

    // Ensure proper wss:// protocol for WebSocket client
    if (wsUrl.startsWith('https://')) {
      wsUrl = 'wss://' + wsUrl.slice(8);
    } else if (wsUrl.startsWith('http://')) {
      wsUrl = 'ws://' + wsUrl.slice(7);
    } else if (!wsUrl.startsWith('wss://') && !wsUrl.startsWith('ws://')) {
      wsUrl = 'wss://' + wsUrl;
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

    // Tag this room's active provider as LiveKit immediately for accurate Admin telemetry
    void recordProviderHeartbeat({
      meetingId: room,
      meetingTitle: room,
      provider: 'livekit',
      participantCount: 1,
      deltaSeconds: 0,
    }).catch(() => {});

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
