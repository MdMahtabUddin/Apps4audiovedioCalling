import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin/admin-auth';
import { getSystemConfig, updateSystemConfig, RtcRoutingMode } from '@/lib/admin/system-config';

export async function GET() {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: 'Admin login required' }, { status: 401 });
  }
  const config = await getSystemConfig();
  return NextResponse.json({ config });
}

export async function PATCH(request: NextRequest) {
  try {
    const adminSession = await getAdminSession();
    if (!adminSession) {
      return NextResponse.json({ error: 'Admin login required' }, { status: 401 });
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
