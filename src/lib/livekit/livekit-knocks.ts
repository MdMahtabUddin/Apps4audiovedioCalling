import { RoomServiceClient } from 'livekit-server-sdk';

export interface KnockItem {
  id: string;
  displayName: string;
  status: 'WAITING' | 'APPROVED' | 'DENIED';
  joinedAt: string;
}

function getClient(): RoomServiceClient | null {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  let wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;

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
    let meta: { knocks?: KnockItem[] } = {};
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

    const meta = JSON.parse(rooms[0].metadata);
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

    const meta = JSON.parse(rooms[0].metadata);
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

    const meta = JSON.parse(rooms[0].metadata);
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
