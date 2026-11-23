import fs from 'fs';
import path from 'path';
import { prisma, checkPrisma } from '@/lib/db';

export type MediaProviderType = 'livekit' | 'agora' | 'daily' | 'webrtc';

export interface ProviderUsageRecord {
  meetingId: string;
  meetingTitle: string;
  provider: MediaProviderType;
  monthKey: string; // YYYY-MM
  maxParticipants: number;
  durationSeconds: number;
  participantMinutes: number; // Billing-equivalent participant-minutes
  startedAt: string;
  lastHeartbeatAt: string;
}

export interface ProviderUsageSummary {
  monthKey: string;
  quotas: {
    livekit: { limitMinutes: number | null; usedMinutes: number; remainingMinutes: number | null; meetingsCount: number };
    agora: { limitMinutes: number; usedMinutes: number; remainingMinutes: number; meetingsCount: number };
    daily: { limitMinutes: number; usedMinutes: number; remainingMinutes: number; meetingsCount: number };
    webrtc: { usedMinutes: number; meetingsCount: number };
  };
  records: ProviderUsageRecord[];
}

const DATA_DIR =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME ? '/tmp' : process.cwd();
const USAGE_FILE = path.join(DATA_DIR, '.metromeet-usage-logs.json');

let tableReady = false;

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function ensureUsageTable() {
  if (tableReady) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProviderUsageLog" (
        "meetingId" TEXT PRIMARY KEY,
        "meetingTitle" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "monthKey" TEXT NOT NULL,
        "maxParticipants" INTEGER NOT NULL DEFAULT 1,
        "durationSeconds" INTEGER NOT NULL DEFAULT 0,
        "participantMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    tableReady = true;
  } catch (err) {
    console.warn('ProviderUsageLog table init notice:', err);
  }
}

function readLocalRecords(): ProviderUsageRecord[] {
  try {
    if (fs.existsSync(USAGE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function writeLocalRecords(records: ProviderUsageRecord[]) {
  try {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch {}
}

export async function recordProviderHeartbeat(input: {
  meetingId: string;
  meetingTitle: string;
  provider: MediaProviderType;
  participantCount: number;
  deltaSeconds: number;
}): Promise<void> {
  const safeId = String(input.meetingId || '').trim().slice(0, 80);
  if (!safeId) return;

  const safeTitle = String(input.meetingTitle || 'Live Meeting').trim().slice(0, 200);
  const safeProvider: MediaProviderType = ['livekit', 'agora', 'daily', 'webrtc'].includes(
    input.provider
  )
    ? input.provider
    : 'livekit';
  const safeParticipants = Math.max(1, Math.min(500, Math.round(input.participantCount || 1)));
  const safeDelta = Math.max(0, Math.min(120, Math.round(input.deltaSeconds || 0)));
  const deltaParticipantMins = Number(((safeDelta / 60) * safeParticipants).toFixed(3));
  const monthKey = currentMonthKey();
  const nowIso = new Date().toISOString();

  // Always update local fallback cache
  const local = readLocalRecords();
  const idx = local.findIndex((r) => r.meetingId === safeId);
  if (idx >= 0) {
    const prev = local[idx];
    local[idx] = {
      ...prev,
      meetingTitle: safeTitle || prev.meetingTitle,
      provider: safeProvider,
      maxParticipants: Math.max(prev.maxParticipants, safeParticipants),
      durationSeconds: prev.durationSeconds + safeDelta,
      participantMinutes: Number((prev.participantMinutes + deltaParticipantMins).toFixed(2)),
      lastHeartbeatAt: nowIso,
    };
  } else {
    local.unshift({
      meetingId: safeId,
      meetingTitle: safeTitle,
      provider: safeProvider,
      monthKey,
      maxParticipants: safeParticipants,
      durationSeconds: safeDelta,
      participantMinutes: Number(deltaParticipantMins.toFixed(2)),
      startedAt: nowIso,
      lastHeartbeatAt: nowIso,
    });
  }
  writeLocalRecords(local.slice(0, 300));

  // Persist to PostgreSQL if available
  try {
    if (await checkPrisma()) {
      await ensureUsageTable();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ProviderUsageLog"
          ("meetingId", "meetingTitle", "provider", "monthKey", "maxParticipants", "durationSeconds", "participantMinutes", "startedAt", "lastHeartbeatAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT ("meetingId")
         DO UPDATE SET
           "meetingTitle" = EXCLUDED."meetingTitle",
           "provider" = EXCLUDED."provider",
           "maxParticipants" = GREATEST("ProviderUsageLog"."maxParticipants", EXCLUDED."maxParticipants"),
           "durationSeconds" = "ProviderUsageLog"."durationSeconds" + EXCLUDED."durationSeconds",
           "participantMinutes" = ROUND(("ProviderUsageLog"."participantMinutes" + EXCLUDED."participantMinutes")::numeric, 2)::double precision,
           "lastHeartbeatAt" = CURRENT_TIMESTAMP`,
        safeId,
        safeTitle,
        safeProvider,
        monthKey,
        safeParticipants,
        safeDelta,
        deltaParticipantMins
      );
    }
  } catch (err) {
    console.warn('recordProviderHeartbeat DB notice:', err);
  }
}

export async function getProviderUsageSummary(): Promise<ProviderUsageSummary> {
  const monthKey = currentMonthKey();
  let records: ProviderUsageRecord[] = [];

  try {
    if (await checkPrisma()) {
      await ensureUsageTable();
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT "meetingId", "meetingTitle", "provider", "monthKey", "maxParticipants", "durationSeconds", "participantMinutes", "startedAt", "lastHeartbeatAt"
         FROM "ProviderUsageLog"
         ORDER BY "lastHeartbeatAt" DESC
         LIMIT 200`
      )) as Array<any>;

      records = rows.map((r) => ({
        meetingId: String(r.meetingId),
        meetingTitle: String(r.meetingTitle),
        provider: (r.provider as MediaProviderType) || 'livekit',
        monthKey: String(r.monthKey || monthKey),
        maxParticipants: Number(r.maxParticipants || 1),
        durationSeconds: Number(r.durationSeconds || 0),
        participantMinutes: Number(Number(r.participantMinutes || 0).toFixed(2)),
        startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : new Date().toISOString(),
        lastHeartbeatAt: r.lastHeartbeatAt
          ? new Date(r.lastHeartbeatAt).toISOString()
          : new Date().toISOString(),
      }));
    } else {
      records = readLocalRecords();
    }
  } catch {
    records = readLocalRecords();
  }

  const thisMonth = records.filter((r) => r.monthKey === monthKey);

  const calc = (prov: MediaProviderType) => {
    const matching = thisMonth.filter((r) => r.provider === prov);
    const used = Number(
      matching.reduce((sum, r) => sum + (r.participantMinutes || 0), 0).toFixed(1)
    );
    return { used, count: matching.length };
  };

  const lk = calc('livekit');
  const ag = calc('agora');
  const dl = calc('daily');
  const wr = calc('webrtc');

  return {
    monthKey,
    quotas: {
      livekit: {
        limitMinutes: null,
        usedMinutes: lk.used,
        remainingMinutes: null,
        meetingsCount: lk.count,
      },
      agora: {
        limitMinutes: 10000,
        usedMinutes: ag.used,
        remainingMinutes: Math.max(0, Number((10000 - ag.used).toFixed(1))),
        meetingsCount: ag.count,
      },
      daily: {
        limitMinutes: 10000,
        usedMinutes: dl.used,
        remainingMinutes: Math.max(0, Number((10000 - dl.used).toFixed(1))),
        meetingsCount: dl.count,
      },
      webrtc: {
        usedMinutes: wr.used,
        meetingsCount: wr.count,
      },
    },
    records,
  };
}
