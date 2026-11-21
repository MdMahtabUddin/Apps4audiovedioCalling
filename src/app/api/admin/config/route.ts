import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getSystemConfig, updateSystemConfig, RtcRoutingMode } from '@/lib/admin/system-config';

function isAuthorizedAdmin(email: string): boolean {
  const allowList = process.env.ADMIN_EMAILS?.trim();
  if (!allowList) return true;
  const allowed = allowList
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!isAuthorizedAdmin(session.email)) {
    return NextResponse.json({ error: 'Admin access denied' }, { status: 403 });
  }
  const config = await getSystemConfig();
  return NextResponse.json({ config });
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!isAuthorizedAdmin(session.email)) {
      return NextResponse.json({ error: 'Admin access denied' }, { status: 403 });
    }

    const body = await request.json();
    const patch: Record<string, unknown> = {};

    if (typeof body.primaryEnabled === 'boolean') patch.primaryEnabled = body.primaryEnabled;
    if (typeof body.backupEnabled === 'boolean') patch.backupEnabled = body.backupEnabled;
    if (
      typeof body.routingMode === 'string' &&
      ['auto', 'livekit', 'daily', 'webrtc'].includes(body.routingMode)
    ) {
      patch.routingMode = body.routingMode as RtcRoutingMode;
    }
    if (typeof body.allowGuestJoin === 'boolean') patch.allowGuestJoin = body.allowGuestJoin;
    if (typeof body.defaultWaitingRoom === 'boolean')
      patch.defaultWaitingRoom = body.defaultWaitingRoom;
    if (typeof body.maintenanceMode === 'boolean') patch.maintenanceMode = body.maintenanceMode;
    if (typeof body.maxParticipantsPerRoom === 'number') {
      patch.maxParticipantsPerRoom = Math.max(2, Math.min(500, Math.round(body.maxParticipantsPerRoom)));
    }
    if (typeof body.globalAnnouncement === 'string') {
      patch.globalAnnouncement = body.globalAnnouncement.slice(0, 300);
    }

    const updated = await updateSystemConfig(patch);
    return NextResponse.json({ config: updated });
  } catch (err) {
    console.error('Admin config update error:', err);
    return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
  }
}
