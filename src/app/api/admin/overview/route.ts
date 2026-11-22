import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin/admin-auth';
import { prisma, checkPrisma } from '@/lib/db';
import { getSystemConfig } from '@/lib/admin/system-config';
import { getProviderUsageSummary } from '@/lib/admin/usage-tracker';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const adminSession = await getAdminSession();
    if (!adminSession) {
      return NextResponse.json({ error: 'Admin login required' }, { status: 401 });
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
    const agoraConfigured = Boolean(
      (process.env.AGORA_APP_ID || process.env.NEXT_PUBLIC_AGORA_APP_ID || '').trim()
    );
    const dailyConfigured = Boolean(process.env.DAILY_API_KEY?.trim());
    const usage = await getProviderUsageSummary();
    const usageByMeeting = new Map(usage.records.map((r) => [r.meetingId, r]));

    const enrichMeeting = (m: (typeof meetings)[number]) => {
      const log = usageByMeeting.get(m.id);
      const startMs = new Date(m.startTime).getTime();
      const endMs = m.endTime ? new Date(m.endTime).getTime() : Date.now();
      const fallbackSecs =
        !Number.isNaN(startMs) && !Number.isNaN(endMs)
          ? Math.max(0, Math.min(60 * 60 * 6, Math.round((endMs - startMs) / 1000)))
          : 0;
      const durationSeconds =
        log && log.durationSeconds > 0 ? Math.max(log.durationSeconds, fallbackSecs) : fallbackSecs;
      const participantMinutes =
        log && log.participantMinutes > 0
          ? log.participantMinutes
          : Number(((durationSeconds / 60) * Math.max(1, m.participantCount)).toFixed(1));
      return {
        ...m,
        provider: log?.provider || 'livekit',
        durationSeconds,
        participantMinutes,
      };
    };

    const allEnrichedMeetings = meetings.map(enrichMeeting);
    const enrichedActive = allEnrichedMeetings.filter((m) => m.isActive);
    const enrichedRecent = allEnrichedMeetings.slice(0, 50);

    // Aggregate current month's usage directly from ALL enriched meetings (existing DB meetings + live ProviderUsageLog)
    const monthPrefix = usage.monthKey; // e.g. "2026-11"
    const monthMeetings = allEnrichedMeetings.filter((m) => {
      const iso = m.startTime || m.createdAt || '';
      return iso.startsWith(monthPrefix);
    });

    const sumProvider = (prov: 'livekit' | 'agora' | 'daily' | 'webrtc') => {
      const list = monthMeetings.filter((m) => m.provider === prov);
      const used = Number(
        list.reduce((sum, m) => sum + (m.participantMinutes || 0), 0).toFixed(1)
      );
      return { used, count: list.length };
    };

    const lkTotals = sumProvider('livekit');
    const agTotals = sumProvider('agora');
    const dlTotals = sumProvider('daily');
    const wrTotals = sumProvider('webrtc');

    const mergedUsage = {
      ...usage,
      quotas: {
        livekit: {
          limitMinutes: 5000,
          usedMinutes: lkTotals.used,
          remainingMinutes: Math.max(0, Number((5000 - lkTotals.used).toFixed(1))),
          meetingsCount: lkTotals.count,
        },
        agora: {
          limitMinutes: 10000,
          usedMinutes: agTotals.used,
          remainingMinutes: Math.max(0, Number((10000 - agTotals.used).toFixed(1))),
          meetingsCount: agTotals.count,
        },
        daily: {
          limitMinutes: 10000,
          usedMinutes: dlTotals.used,
          remainingMinutes: Math.max(0, Number((10000 - dlTotals.used).toFixed(1))),
          meetingsCount: dlTotals.count,
        },
        webrtc: {
          usedMinutes: wrTotals.used,
          meetingsCount: wrTotals.count,
        },
      },
    };

    return NextResponse.json({
      admin: {
        name: adminSession.username,
        email: `${adminSession.username}@metromeet.admin`,
      },
      config,
      usage: mergedUsage,
      infrastructure: {
        databaseMode: usePrisma ? 'PostgreSQL Cloud' : 'Local Fallback Store',
        livekitConfigured,
        livekitUrl,
        agoraConfigured,
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
      activeMeetings: enrichedActive,
      recentMeetings: enrichedRecent,
      users,
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    return NextResponse.json({ error: 'Failed to load admin overview' }, { status: 500 });
  }
}
