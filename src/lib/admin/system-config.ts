import fs from 'fs';
import path from 'path';
import { prisma, checkPrisma } from '@/lib/db';

export type RtcRoutingMode = 'auto' | 'livekit' | 'agora' | 'daily' | 'webrtc';

export interface SystemConfig {
  primaryEnabled: boolean;
  agoraEnabled: boolean;
  backupEnabled: boolean;
  routingMode: RtcRoutingMode;
  allowGuestJoin: boolean;
  defaultWaitingRoom: boolean;
  maxParticipantsPerRoom: number;
  maintenanceMode: boolean;
  globalAnnouncement: string;
  updatedAt: string;
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  primaryEnabled: true,
  agoraEnabled: true,
  backupEnabled: true,
  routingMode: 'auto',
  allowGuestJoin: true,
  defaultWaitingRoom: false,
  maxParticipantsPerRoom: 50,
  maintenanceMode: false,
  globalAnnouncement: '',
  updatedAt: new Date().toISOString(),
};

const DATA_DIR =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME ? '/tmp' : process.cwd();
const CONFIG_FILE = path.join(DATA_DIR, '.metromeet-admin-config.json');

let memoryCache: SystemConfig | null = null;
let tableInitialized = false;

async function ensureConfigTable() {
  if (tableInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SystemConfig" (
        "key" TEXT PRIMARY KEY,
        "value" TEXT NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    tableInitialized = true;
  } catch (err) {
    console.warn('SystemConfig table init notice:', err);
  }
}

function readLocalFileConfig(): SystemConfig | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return { ...DEFAULT_SYSTEM_CONFIG, ...parsed };
    }
  } catch {
    // ignore
  }
  return null;
}

function writeLocalFileConfig(cfg: SystemConfig) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

export async function getSystemConfig(): Promise<SystemConfig> {
  try {
    if (await checkPrisma()) {
      await ensureConfigTable();
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT "value" FROM "SystemConfig" WHERE "key" = 'rtc_system_config' LIMIT 1`
      )) as Array<{ value: string }>;
      if (rows && rows.length > 0 && rows[0].value) {
        const parsed = JSON.parse(rows[0].value);
        const merged: SystemConfig = { ...DEFAULT_SYSTEM_CONFIG, ...parsed };
        memoryCache = merged;
        return merged;
      }
    }
  } catch (err) {
    console.warn('getSystemConfig DB fallback:', err);
  }

  const fileCfg = readLocalFileConfig();
  if (fileCfg) {
    memoryCache = fileCfg;
    return fileCfg;
  }

  return memoryCache ? { ...DEFAULT_SYSTEM_CONFIG, ...memoryCache } : { ...DEFAULT_SYSTEM_CONFIG };
}

export async function updateSystemConfig(
  patch: Partial<SystemConfig>
): Promise<SystemConfig> {
  const current = await getSystemConfig();
  const next: SystemConfig = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  memoryCache = next;
  writeLocalFileConfig(next);

  try {
    if (await checkPrisma()) {
      await ensureConfigTable();
      const serialized = JSON.stringify(next);
      await prisma.$executeRawUnsafe(
        `INSERT INTO "SystemConfig" ("key", "value", "updatedAt")
         VALUES ('rtc_system_config', $1, CURRENT_TIMESTAMP)
         ON CONFLICT ("key")
         DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
        serialized
      );
    }
  } catch (err) {
    console.warn('updateSystemConfig DB save notice:', err);
  }

  return next;
}
