import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma, checkPrisma } from '@/lib/db';
import { getSystemConfig } from '@/lib/admin/system-config';
import fs from 'fs';
import path from 'path';

function isAuthorizedAdmin(email: string): boolean {
  const allowList = process.env.ADMIN_EMAILS?.trim();
  if (!allowList) return true; // Any signed-in workspace host can access unless ADMIN_EMAILS is restricted
  const allowed = allowList
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!isAuthorizedAdmin(session.email)) {
      return NextResponse.json({ error: 'Admin access denied' }, { status: 403 });
    }

    const config = await getSystemConfig();
    const usePrisma = await checkPrisma();

    let users: Array<{
      id: string;
      name: string;
      email: string;
      createdAt: string;
      hostedCount: number;
    }> = [];

    let meetings: Array<{
      id: string;
      title: string;
      hostName: string;
      hostEmail: string;
      isActive: boolean;
      isLocked: boolean;
      waitingRoom: boolean;
      participantCount: number;
      startTime: string;
      endTime: string | null;
      createdAt: string;
    }> = [];

    let scheduledCount = 0;

    if (usePrisma) {
      const [dbUsers, dbMeetings, dbScheduledCount] = await Promise.all([
        prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: { _count: { select: { hostedMeetings: true } } },
        }),
        prisma.meeting.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            host: { select: { name: true, email: true } },
            _count: { select: { participants: true } },
          },
        }),
        prisma.scheduledMeeting.count(),
      ]);

      users = dbUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt.toISOString(),
        hostedCount: u._count.hostedMeetings,
      }));

      meetings = dbMeetings.map((m) => ({
        id: m.id,
        title: m.title,
        hostName: m.host?.name || 'Host',
        hostEmail: m.host?.email || '',
        isActive: m.isActive,
        isLocked: m.isLocked,
        waitingRoom: m.waitingRoom,
        participantCount: m._count.participants,
        startTime: m.startTime.toISOString(),
        endTime: m.endTime ? m.endTime.toISOString() : null,
        createdAt: m.createdAt.toISOString(),
      }));

      scheduledCount = dbScheduledCount;
    } else {
      const dataDir =
        process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME ? '/tmp' : process.cwd();
      const filePath = path.join(dataDir, '.metromeet-dev-data.json');
      if (fs.existsSync(filePath)) {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const rawUsers = Array.isArray(raw.users) ? raw.users : [];
        const rawMeetings = Array.isArray(raw.meetings) ? raw.meetings : [];
        const rawParticipants = Array.isArray(raw.participants) ? raw.participants : [];
        const rawScheduled = Array.isArray(raw.scheduledMeetings) ? raw.scheduledMeetings : [];

        users = rawUsers.map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          createdAt: u.createdAt || new Date().toISOString(),
          hostedCount: rawMeetings.filter((m: any) => m.hostId === u.id).length,
        }));

        meetings = rawMeetings
          .slice()
          .sort(
            (a: any, b: any) =>
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          )
          .slice(0, 100)
          .map((m: any) => {
            const host = rawUsers.find((u: any) => u.id === m.hostId);
            return {
              id: m.id,
              title: m.title,
              hostName: host?.name || 'Host',
              hostEmail: host?.email || '',
              isActive: Boolean(m.isActive),
              isLocked: Boolean(m.isLocked),
              waitingRoom: Boolean(m.waitingRoom),
              participantCount: rawParticipants.filter((p: any) => p.meetingId === m.id).length,
              startTime: m.startTime || m.createdAt || new Date().toISOString(),
              endTime: m.endTime || null,
              createdAt: m.createdAt || new Date().toISOString(),
            };
          });

        scheduledCount = rawScheduled.length;
      }
    }

    const activeMeetings = meetings.filter((m) => m.isActive);
    const totalParticipants = meetings.reduce((sum, m) => sum + m.participantCount, 0);

    const livekitKey = process.env.LIVEKIT_API_KEY || 'APIa2BuzPQWD3Vn';
    const livekitSecret =
      process.env.LIVEKIT_API_SECRET || 'gjDmc9QfM68VI45DofbIjQIcAoFAhCuPzPz8jTNGCRc';
    const livekitUrl =
      process.env.NEXT_PUBLIC_LIVEKIT_URL ||
      process.env.LIVEKIT_URL ||
      'wss://metromeet-wjbjv475.livekit.cloud';
    const livekitConfigured = Boolean(
      livekitKey && livekitSecret && livekitUrl && !livekitSecret.includes('•') && livekitSecret.length >= 16
    );
    const dailyConfigured = Boolean(process.env.DAILY_API_KEY?.trim());

    return NextResponse.json({
      admin: {
        name: session.name,
        email: session.email,
      },
      config,
      infrastructure: {
        databaseMode: usePrisma ? 'PostgreSQL Cloud' : 'Local Fallback Store',
        livekitConfigured,
        livekitUrl,
        dailyConfigured,
        webrtcMeshAvailable: true,
        environment: process.env.VERCEL ? 'Vercel Production' : 'Local Studio',
      },
      stats: {
        totalUsers: users.length,
        totalMeetings: meetings.length,
        activeMeetingsCount: activeMeetings.length,
        scheduledMeetingsCount: scheduledCount,
        totalParticipants,
      },
      activeMeetings,
      recentMeetings: meetings.slice(0, 40),
      users,
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    return NextResponse.json({ error: 'Failed to load admin overview' }, { status: 500 });
  }
}
