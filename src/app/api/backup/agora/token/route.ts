import { NextRequest, NextResponse } from 'next/server';
import { RtcRole, RtcTokenBuilder } from 'agora-token';
import { getSystemConfig } from '@/lib/admin/system-config';

function sanitizeChannel(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  return cleaned || 'metromeet_room';
}

export async function GET(request: NextRequest) {
  try {
    const sysConfig = await getSystemConfig();
    if (
      !sysConfig.agoraEnabled ||
      sysConfig.routingMode === 'livekit' ||
      sysConfig.routingMode === 'daily' ||
      sysConfig.routingMode === 'webrtc'
    ) {
      return NextResponse.json({
        isConfigured: false,
        provider: 'agora',
        disabledByAdmin: true,
        message: 'Agora Backup provider is disabled by Admin Panel.',
      });
    }

    const appId = (process.env.AGORA_APP_ID || process.env.NEXT_PUBLIC_AGORA_APP_ID || '').trim();
    const appCertificate = (process.env.AGORA_APP_CERTIFICATE || '').trim();

    if (!appId) {
      return NextResponse.json({
        isConfigured: false,
        provider: 'agora',
        message: 'AGORA_APP_ID is not configured.',
      });
    }

    const { searchParams } = new URL(request.url);
    const roomParam = searchParams.get('room') || 'default';
    const channel = sanitizeChannel(roomParam);
    const uid = Math.floor(100000 + Math.random() * 899999);

    let token: string | null = null;
    if (appCertificate && appCertificate.length >= 16) {
      const expireSeconds = 60 * 60 * 6; // 6 hours
      const privilegeExpireTs = Math.floor(Date.now() / 1000) + expireSeconds;
      token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channel,
        uid,
        RtcRole.PUBLISHER,
        expireSeconds,
        privilegeExpireTs
      );
    }

    return NextResponse.json({
      isConfigured: true,
      provider: 'agora',
      appId,
      channel,
      uid,
      token,
    });
  } catch (err) {
    console.warn('Agora token route error:', err);
    return NextResponse.json(
      { isConfigured: false, provider: 'agora', error: 'Agora token generation failed' },
      { status: 500 }
    );
  }
}
