import { RoomServiceClient } from 'livekit-server-sdk';

export interface KnockItem {
  id: string;
  displayName: string;
  status: 'WAITING' | 'APPROVED' | 'DENIED';
  joinedAt: string;
}

export interface CloudMeetingMetadata {
  id: string;
  title: string;
  hostId: string;
  hostName?: string;
  password?: string | null;
  hasPassword?: boolean;
  waitingRoom?: boolean;
  isLocked?: boolean;
  isActive?: boolean;
  startTime?: string;
  knocks?: KnockItem[];
}

function getClient(): RoomServiceClient | null {
  const apiKey = process.env.LIVEKIT_API_KEY || 'APIa2BuzPQWD3Vn';
  const apiSecret = process.env.LIVEKIT_API_SECRET || 'gjDmc9QfM68VI45DofbIjQIcAoFAhCuPzPz8jTNGCRc';
  // Prefer internal LIVEKIT_URL (e.g. http://127.0.0.1:7880 on self-hosted VPS) for server-side API calls
  let wsUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://metromeet-wjbjv475.livekit.cloud';

  if (!apiKey || !apiSecret || !wsUrl || apiSecret.includes('•') || apiSecret.length < 16) {
    return null;
  }

  // LiveKit RoomServiceClient needs https:// endpoint
  let httpUrl = wsUrl;
  if (httpUrl.startsWith('wss://')) {
    httpUrl = 'https://' + httpUrl.slice(6);
  } else if (httpUrl.startsWith('ws://')) {
    httpUrl = 'http://' + httpUrl.slice(5);
  } else if (!httpUrl.startsWith('http://') && !httpUrl.startsWith('https://')) {
    httpUrl = 'https://' + httpUrl;
  }

  return new RoomServiceClient(httpUrl, apiKey, apiSecret);
}

export async function saveMeetingToLiveKit(meeting: {
  id: string;
  title: string;
  hostId: string;
  hostName?: string;
  password?: string | null;
  waitingRoom?: boolean;
}): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    const hasPassword = Boolean(meeting.password && meeting.password.trim());
    const waitingRoom = Boolean(meeting.waitingRoom) || hasPassword;

    let existingMeta: CloudMeetingMetadata = {
      id: meeting.id,
      title: meeting.title || 'Instant Meeting',
      hostId: meeting.hostId,
      hostName: meeting.hostName || 'Meeting Host',
      password: meeting.password || null,
      hasPassword,
      waitingRoom,
      isLocked: false,
      isActive: true,
      startTime: new Date().toISOString(),
      knocks: [],
    };

    try {
      const rooms = await client.listRooms([meeting.id]);
      if (rooms.length > 0 && rooms[0].metadata) {
        try {
          const parsed = JSON.parse(rooms[0].metadata);
          existingMeta = {
            ...existingMeta,
            ...parsed,
            title: meeting.title || parsed.title,
            password: meeting.password !== undefined ? meeting.password : parsed.password,
            hasPassword,
            waitingRoom,
          };
        } catch {}
      } else {
        await client.createRoom({
          name: meeting.id,
          emptyTimeout: 86400,
          metadata: JSON.stringify(existingMeta),
        });
        return;
      }
    } catch {}

    await client.updateRoomMetadata(meeting.id, JSON.stringify(existingMeta));
  } catch (err) {
    console.warn('[LiveKitKnocks] saveMeetingToLiveKit error:', err);
  }
}

export async function getMeetingFromLiveKit(id: string): Promise<CloudMeetingMetadata | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const rooms = await client.listRooms([id]);
    if (rooms.length === 0 || !rooms[0].metadata) return null;

    const parsed: CloudMeetingMetadata = JSON.parse(rooms[0].metadata);
    if (!parsed || !parsed.id) return null;

    return parsed;
  } catch (err) {
    console.warn('[LiveKitKnocks] getMeetingFromLiveKit error:', err);
    return null;
  }
}

export async function addLiveKitKnock(
  roomId: string,
  participantId: string,
  displayName: string
): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    try {
      await client.createRoom({ name: roomId });
    } catch {}

    const rooms = await client.listRooms([roomId]);
    let meta: CloudMeetingMetadata = {
      id: roomId,
      title: 'Meeting',
      hostId: 'host',
      knocks: [],
    };

    if (rooms.length > 0 && rooms[0].metadata) {
      try {
        meta = JSON.parse(rooms[0].metadata);
      } catch {}
    }

    if (!meta.knocks) meta.knocks = [];

    // Check if participant already knocked
    const existing = meta.knocks.find((k) => k.id === participantId);
    if (!existing) {
      meta.knocks.push({
        id: participantId,
        displayName: displayName || 'Guest User',
        status: 'WAITING',
        joinedAt: new Date().toISOString(),
      });
    } else {
      existing.status = 'WAITING';
      existing.displayName = displayName || existing.displayName;
    }

    await client.updateRoomMetadata(roomId, JSON.stringify(meta));
  } catch (err) {
    console.warn('[LiveKitKnocks] addKnock error:', err);
  }
}

export async function getLiveKitKnocks(roomId: string): Promise<KnockItem[]> {
  const client = getClient();
  if (!client) return [];

  try {
    const rooms = await client.listRooms([roomId]);
    if (rooms.length === 0 || !rooms[0].metadata) return [];

    const meta: CloudMeetingMetadata = JSON.parse(rooms[0].metadata);
    return Array.isArray(meta.knocks)
      ? meta.knocks.filter((k: KnockItem) => k.status === 'WAITING')
      : [];
  } catch (err) {
    console.warn('[LiveKitKnocks] getKnocks error:', err);
    return [];
  }
}

export async function getLiveKitKnockStatus(
  roomId: string,
  participantId: string
): Promise<'WAITING' | 'APPROVED' | 'DENIED' | 'NOT_FOUND'> {
  const client = getClient();
  if (!client) return 'NOT_FOUND';

  try {
    const rooms = await client.listRooms([roomId]);
    if (rooms.length === 0 || !rooms[0].metadata) return 'NOT_FOUND';

    const meta: CloudMeetingMetadata = JSON.parse(rooms[0].metadata);
    if (!Array.isArray(meta.knocks)) return 'NOT_FOUND';

    const item = meta.knocks.find((k: KnockItem) => k.id === participantId);
    if (!item) return 'NOT_FOUND';

    return item.status;
  } catch (err) {
    console.warn('[LiveKitKnocks] getKnockStatus error:', err);
    return 'NOT_FOUND';
  }
}

export async function updateLiveKitKnockStatus(
  roomId: string,
  participantId: string,
  status: 'APPROVED' | 'DENIED'
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const rooms = await client.listRooms([roomId]);
    if (rooms.length === 0 || !rooms[0].metadata) return false;

    const meta: CloudMeetingMetadata = JSON.parse(rooms[0].metadata);
    if (!Array.isArray(meta.knocks)) return false;

    const item = meta.knocks.find((k: KnockItem) => k.id === participantId);
    if (item) {
      item.status = status;
      await client.updateRoomMetadata(roomId, JSON.stringify(meta));
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[LiveKitKnocks] updateKnockStatus error:', err);
    return false;
  }
}
