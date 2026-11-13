import { NextRequest, NextResponse } from 'next/server';
import { prisma, checkPrisma } from '@/lib/db';

interface InMemorySignal {
  id: string;
  meetingId: string;
  from: string;
  to: string;
  type: string;
  data: any;
  createdAt: number;
}

// In-memory fallback queue for fast local dev or if DB is offline
const inMemorySignals: InMemorySignal[] = [];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { from, to, type, data } = body;

    if (!from || !to || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const payloadString = JSON.stringify({ to, type, data });

    const usePg = await checkPrisma();
    if (usePg) {
      await prisma.meetingMessage.create({
        data: {
          meetingId: id,
          senderName: from,
          content: payloadString,
          isSystem: true,
        },
      });
    } else {
      inMemorySignals.push({
        id: Math.random().toString(36).slice(2),
        meetingId: id,
        from,
        to,
        type,
        data,
        createdAt: Date.now(),
      });
      // Purge old in-memory items older than 60s
      const now = Date.now();
      while (inMemorySignals.length > 500 || (inMemorySignals[0] && now - inMemorySignals[0].createdAt > 60000)) {
        inMemorySignals.shift();
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Signal POST error:', err);
    return NextResponse.json({ error: err.message || 'Signal error' }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const peerId = searchParams.get('peerId');
    const since = searchParams.get('since');

    if (!peerId) {
      return NextResponse.json({ error: 'peerId parameter required' }, { status: 400 });
    }

    const usePg = await checkPrisma();
    const resultSignals: Array<{ id: string; from: string; to: string; type: string; data: any; createdAt: string }> = [];

    if (usePg) {
      const sinceDate = since ? new Date(since) : new Date(Date.now() - 30000);
      const messages = await prisma.meetingMessage.findMany({
        where: {
          meetingId: id,
          isSystem: true,
          createdAt: { gt: sinceDate },
        },
        orderBy: { createdAt: 'asc' },
      });

      for (const msg of messages) {
        try {
          const parsed = JSON.parse(msg.content);
          if (parsed.to === peerId || parsed.to === '*') {
            resultSignals.push({
              id: msg.id,
              from: msg.senderName,
              to: parsed.to,
              type: parsed.type,
              data: parsed.data,
              createdAt: msg.createdAt.toISOString(),
            });
          }
        } catch {}
      }

      // Background cleanup of stale signals older than 2 minutes
      const twoMinutesAgo = new Date(Date.now() - 120000);
      prisma.meetingMessage
        .deleteMany({
          where: {
            meetingId: id,
            isSystem: true,
            createdAt: { lt: twoMinutesAgo },
          },
        })
        .catch(() => {});
    } else {
      const sinceTime = since ? new Date(since).getTime() : Date.now() - 30000;
      const filtered = inMemorySignals.filter(
        (s) => s.meetingId === id && (s.to === peerId || s.to === '*') && s.createdAt > sinceTime
      );
      filtered.forEach((s) => {
        resultSignals.push({
          id: s.id,
          from: s.from,
          to: s.to,
          type: s.type,
          data: s.data,
          createdAt: new Date(s.createdAt).toISOString(),
        });
      });
    }

    return NextResponse.json({
      signals: resultSignals,
      latestTimestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Signal GET error:', err);
    return NextResponse.json({ error: err.message || 'Signal fetch error' }, { status: 500 });
  }
}
