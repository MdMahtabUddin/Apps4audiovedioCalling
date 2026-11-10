import { prisma } from './prisma';

let initPromise: Promise<boolean> | null = null;

const DDL_STATEMENTS = [
  // 1. Enum
  `DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('HOST', 'CO_HOST', 'PARTICIPANT');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;`,

  // 2. User table
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatar" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
  );`,

  // 3. Meeting table
  `CREATE TABLE IF NOT EXISTS "Meeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "password" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "waitingRoom" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
  );`,

  // 4. MeetingParticipant table
  `CREATE TABLE IF NOT EXISTS "MeetingParticipant" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PARTICIPANT',
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
  );`,

  // 5. ScheduledMeeting table
  `CREATE TABLE IF NOT EXISTS "ScheduledMeeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "password" TEXT,
    "waitingRoom" BOOLEAN NOT NULL DEFAULT false,
    "meetingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduledMeeting_pkey" PRIMARY KEY ("id")
  );`,

  // 6. MeetingMessage table
  `CREATE TABLE IF NOT EXISTS "MeetingMessage" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "senderId" TEXT,
    "senderName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetingMessage_pkey" PRIMARY KEY ("id")
  );`,

  // 7. MeetingSettings table
  `CREATE TABLE IF NOT EXISTS "MeetingSettings" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "allowChat" BOOLEAN NOT NULL DEFAULT true,
    "allowScreenShare" BOOLEAN NOT NULL DEFAULT true,
    "muteOnEntry" BOOLEAN NOT NULL DEFAULT false,
    "allowReactions" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "MeetingSettings_pkey" PRIMARY KEY ("id")
  );`,

  // 8. Indexes
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");`,
  `CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");`,
  `CREATE INDEX IF NOT EXISTS "Meeting_hostId_idx" ON "Meeting"("hostId");`,
  `CREATE INDEX IF NOT EXISTS "Meeting_isActive_idx" ON "Meeting"("isActive");`,
  `CREATE INDEX IF NOT EXISTS "MeetingParticipant_meetingId_idx" ON "MeetingParticipant"("meetingId");`,
  `CREATE INDEX IF NOT EXISTS "MeetingParticipant_userId_idx" ON "MeetingParticipant"("userId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ScheduledMeeting_meetingId_key" ON "ScheduledMeeting"("meetingId");`,
  `CREATE INDEX IF NOT EXISTS "ScheduledMeeting_hostId_idx" ON "ScheduledMeeting"("hostId");`,
  `CREATE INDEX IF NOT EXISTS "ScheduledMeeting_date_idx" ON "ScheduledMeeting"("date");`,
  `CREATE INDEX IF NOT EXISTS "MeetingMessage_meetingId_idx" ON "MeetingMessage"("meetingId");`,
  `CREATE INDEX IF NOT EXISTS "MeetingMessage_createdAt_idx" ON "MeetingMessage"("createdAt");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "MeetingSettings_meetingId_key" ON "MeetingSettings"("meetingId");`,

  // 9. Foreign Keys with duplicate check
  `DO $$ BEGIN
    ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;`,

  `DO $$ BEGIN
    ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;`,

  `DO $$ BEGIN
    ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;`,

  `DO $$ BEGIN
    ALTER TABLE "ScheduledMeeting" ADD CONSTRAINT "ScheduledMeeting_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;`,

  `DO $$ BEGIN
    ALTER TABLE "MeetingMessage" ADD CONSTRAINT "MeetingMessage_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;`,

  `DO $$ BEGIN
    ALTER TABLE "MeetingMessage" ADD CONSTRAINT "MeetingMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;`,

  `DO $$ BEGIN
    ALTER TABLE "MeetingSettings" ADD CONSTRAINT "MeetingSettings_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;`
];

export async function ensureDatabaseSchema(): Promise<boolean> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // First quick test: Can we select from User?
      await prisma.user.count();
      return true;
    } catch (checkErr: any) {
      console.warn('User table not detected or inaccessible. Initializing PostgreSQL schema...', checkErr?.message);
    }

    try {
      // Execute each DDL statement sequentially
      for (const sql of DDL_STATEMENTS) {
        await prisma.$executeRawUnsafe(sql);
      }
      console.log('PostgreSQL schema auto-initialized successfully.');
      return true;
    } catch (initErr: any) {
      console.error('Failed to auto-initialize PostgreSQL schema:', initErr);
      return false;
    }
  })();

  return initPromise;
}
