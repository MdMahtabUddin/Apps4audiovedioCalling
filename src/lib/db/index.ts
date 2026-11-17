import { prisma } from './prisma';
import { ensureDatabaseSchema } from './init-db';
import fs from 'fs';
import path from 'path';

export { prisma };

// Development local persistence fallback when PostgreSQL is not yet running
const DATA_DIR = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME ? '/tmp' : process.cwd();
const DATA_FILE = path.join(DATA_DIR, '.metromeet-dev-data.json');

interface DevStore {
  users: Array<{
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    avatar?: string | null;
    emailVerified: boolean;
    resetToken?: string | null;
    resetTokenExpiry?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  meetings: Array<{
    id: string;
    title: string;
    hostId: string;
    password?: string | null;
    isLocked: boolean;
    waitingRoom: boolean;
    isActive: boolean;
    startTime: string;
    endTime?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  participants: Array<{
    id: string;
    meetingId: string;
    userId?: string | null;
    guestName?: string | null;
    role: 'HOST' | 'CO_HOST' | 'PARTICIPANT';
    isApproved: boolean;
    joinedAt: string;
    leftAt?: string | null;
  }>;
  scheduledMeetings: Array<{
    id: string;
    title: string;
    hostId: string;
    date: string;
    startTime: string;
    duration: number;
    timeZone: string;
    password?: string | null;
    waitingRoom: boolean;
    meetingId?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

function loadDevStore(): DevStore {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (!parsed.participants) parsed.participants = [];
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load local dev store:', e);
  }
  return { users: [], meetings: [], participants: [], scheduledMeetings: [] };
}

function saveDevStore(data: DevStore) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save local dev store:', e);
  }
}

// Check if PostgreSQL is available and Prisma models exist
let isPrismaAvailable: boolean | null = null;
export async function checkPrisma(): Promise<boolean> {
  if (isPrismaAvailable === true) return true;
  try {
    await prisma.user.count();
    isPrismaAvailable = true;
    return true;
  } catch (err) {
    console.warn('Prisma check failed, attempting auto schema initialization...', err);
    try {
      const initialized = await ensureDatabaseSchema();
      if (initialized) {
        await prisma.user.count();
        isPrismaAvailable = true;
        return true;
      }
    } catch (schemaErr) {
      console.error('Schema auto-init failed:', schemaErr);
    }
    console.warn('Prisma check failed, falling back to local store for this request');
    return false;
  }
}

export const userService = {
  async findByEmail(email: string) {
    const usePg = await checkPrisma();
    if (usePg) {
      return prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    }
    const store = loadDevStore();
    return store.users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
  },

  async findById(id: string) {
    const usePg = await checkPrisma();
    if (usePg) {
      return prisma.user.findUnique({ where: { id } });
    }
    const store = loadDevStore();
    return store.users.find((u) => u.id === id) || null;
  },

  async getOrCreateGuestHost() {
    const GUEST_HOST_ID = 'usr_guest_host_system';
    const GUEST_EMAIL = 'guest@metromeet.internal';
    const usePg = await checkPrisma();
    if (usePg) {
      try {
        const existing = await prisma.user.findFirst({
          where: { OR: [{ id: GUEST_HOST_ID }, { email: GUEST_EMAIL }] },
        });
        if (existing) return existing;
        return await prisma.user.create({
          data: {
            id: GUEST_HOST_ID,
            name: 'Meeting Host',
            email: GUEST_EMAIL,
            passwordHash: 'guest-disabled-password',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Host',
            emailVerified: true,
          },
        });
      } catch (err) {
        console.warn('PostgreSQL guest host create warning, using fallback user:', err);
      }
    }
    const store = loadDevStore();
    let guestUser = store.users.find((u) => u.id === GUEST_HOST_ID || u.email === GUEST_EMAIL);
    if (!guestUser) {
      guestUser = {
        id: GUEST_HOST_ID,
        name: 'Meeting Host',
        email: GUEST_EMAIL,
        passwordHash: 'guest-disabled-password',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Host',
        emailVerified: true,
        resetToken: null,
        resetTokenExpiry: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.users.push(guestUser);
      saveDevStore(store);
    }
    return guestUser;
  },

  async create(data: { name: string; email: string; passwordHash: string; avatar?: string }) {
    const usePg = await checkPrisma();
    if (usePg) {
      return prisma.user.create({
        data: {
          name: data.name,
          email: data.email.toLowerCase().trim(),
          passwordHash: data.passwordHash,
          avatar: data.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.name)}`,
          emailVerified: true,
        },
      });
    }
    const store = loadDevStore();
    const newUser = {
      id: 'usr_' + Math.random().toString(36).substring(2, 11),
      name: data.name,
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash,
      avatar: data.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.name)}`,
      emailVerified: true,
      resetToken: null,
      resetTokenExpiry: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.users.push(newUser);
    saveDevStore(store);
    return newUser;
  },

  async updateProfile(id: string, data: { name?: string; avatar?: string; emailVerified?: boolean }) {
    const usePg = await checkPrisma();
    if (usePg) {
      return prisma.user.update({
        where: { id },
        data,
      });
    }
    const store = loadDevStore();
    const idx = store.users.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('User not found');
    store.users[idx] = {
      ...store.users[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    saveDevStore(store);
    return store.users[idx];
  },

  async updatePassword(id: string, passwordHash: string) {
    const usePg = await checkPrisma();
    if (usePg) {
      return prisma.user.update({
        where: { id },
        data: { passwordHash },
      });
    }
    const store = loadDevStore();
    const idx = store.users.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('User not found');
    store.users[idx].passwordHash = passwordHash;
    store.users[idx].updatedAt = new Date().toISOString();
    saveDevStore(store);
    return store.users[idx];
  },

  async setResetToken(email: string, token: string, expiry: Date) {
    const usePg = await checkPrisma();
    if (usePg) {
      return prisma.user.update({
        where: { email: email.toLowerCase().trim() },
        data: { resetToken: token, resetTokenExpiry: expiry },
      });
    }
    const store = loadDevStore();
    const user = store.users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
    if (user) {
      user.resetToken = token;
      user.resetTokenExpiry = expiry.toISOString();
      saveDevStore(store);
    }
    return user;
  },

  async findByResetToken(token: string) {
    const usePg = await checkPrisma();
    if (usePg) {
      return prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: { gt: new Date() },
        },
      });
    }
    const store = loadDevStore();
    const now = new Date().toISOString();
    return (
      store.users.find((u) => u.resetToken === token && u.resetTokenExpiry && u.resetTokenExpiry > now) ||
      null
    );
  },
};

export const meetingService = {
  async getById(id: string) {
    const usePg = await checkPrisma();
    if (usePg) {
      const meeting = await prisma.meeting.findUnique({
        where: { id },
        include: {
          host: { select: { id: true, name: true, email: true, avatar: true } },
          settings: true,
          _count: { select: { participants: true } },
        },
      });
      if (!meeting) return null;
      return {
        id: meeting.id,
        title: meeting.title,
        hostId: meeting.hostId,
        hostName: meeting.host.name,
        hostEmail: meeting.host.email,
        hostAvatar: meeting.host.avatar,
        password: meeting.password,
        hasPassword: !!meeting.password,
        isLocked: meeting.isLocked,
        waitingRoom: meeting.waitingRoom,
        isActive: meeting.isActive,
        startTime: meeting.startTime.toISOString(),
        endTime: meeting.endTime ? meeting.endTime.toISOString() : null,
        participantCount: meeting._count.participants,
        settings: meeting.settings,
        createdAt: meeting.createdAt.toISOString(),
      };
    }

    const store = loadDevStore();
    const m = store.meetings.find((x) => x.id === id);
    if (!m) return null;
    const host = store.users.find((u) => u.id === m.hostId);
    return {
      ...m,
      hostName: host ? host.name : 'Meeting Host',
      hostEmail: host ? host.email : '',
      hostAvatar: host ? host.avatar : null,
      hasPassword: !!m.password,
      participantCount: store.participants.filter((p) => p.meetingId === id).length,
      settings: {
        allowChat: true,
        allowScreenShare: true,
        muteOnEntry: false,
        allowReactions: true,
      },
    };
  },

  async getRecentAndHistory(userId: string) {
    const usePg = await checkPrisma();
    if (usePg) {
      const meetings = await prisma.meeting.findMany({
        where: {
          OR: [
            { hostId: userId },
            { participants: { some: { userId } } },
          ],
        },
        orderBy: { startTime: 'desc' },
        take: 10,
        include: {
          host: { select: { id: true, name: true, email: true } },
          _count: { select: { participants: true } },
        },
      });
      return meetings.map((m) => ({
        id: m.id,
        title: m.title,
        hostId: m.hostId,
        hostName: m.host.name,
        hostEmail: m.host.email,
        password: m.password,
        isLocked: m.isLocked,
        waitingRoom: m.waitingRoom,
        isActive: m.isActive,
        startTime: m.startTime.toISOString(),
        endTime: m.endTime ? m.endTime.toISOString() : null,
        participantCount: m._count.participants,
        createdAt: m.createdAt.toISOString(),
      }));
    }

    const store = loadDevStore();
    return store.meetings
      .filter((m) => m.hostId === userId)
      .slice(-10)
      .reverse()
      .map((m) => ({
        ...m,
        hostName: 'Host',
        participantCount: store.participants.filter((p) => p.meetingId === m.id).length || 1,
      }));
  },

  async getScheduledMeetings(userId: string) {
    const usePg = await checkPrisma();
    if (usePg) {
      return prisma.scheduledMeeting.findMany({
        where: { hostId: userId },
        orderBy: { date: 'asc' },
        take: 10,
      });
    }
    const store = loadDevStore();
    return store.scheduledMeetings.filter((s) => s.hostId === userId);
  },

  async create(data: {
    id: string;
    title: string;
    hostId: string;
    password?: string | null;
    waitingRoom?: boolean;
  }) {
    const usePg = await checkPrisma();
    if (usePg) {
      try {
        const hostExists = await prisma.user.findUnique({ where: { id: data.hostId } });
        if (!hostExists) {
          await prisma.user.upsert({
            where: { id: data.hostId },
            update: {},
            create: {
              id: data.hostId,
              name: 'Meeting Host',
              email: `host_${data.hostId.replace(/[^a-zA-Z0-9]/g, '') || 'default'}@metromeet.internal`,
              passwordHash: 'auto-provisioned-host',
              emailVerified: true,
            },
          });
        }
      } catch (userErr) {
        console.warn('Host user ensure error:', userErr);
      }

      return prisma.meeting.upsert({
        where: { id: data.id },
        update: {
          title: data.title,
          hostId: data.hostId,
          password: data.password || null,
          waitingRoom: data.waitingRoom || false,
          isActive: true,
        },
        create: {
          id: data.id,
          title: data.title,
          hostId: data.hostId,
          password: data.password || null,
          waitingRoom: data.waitingRoom || false,
          settings: {
            create: {
              allowChat: true,
              allowScreenShare: true,
              muteOnEntry: false,
              allowReactions: true,
            },
          },
        },
      });
    }
    const store = loadDevStore();
    const existing = store.meetings.find((m) => m.id === data.id);
    if (existing) {
      existing.isActive = true;
      existing.title = data.title;
      existing.hostId = data.hostId;
      existing.password = data.password || null;
      existing.waitingRoom = data.waitingRoom || false;
      saveDevStore(store);
      return existing;
    }
    const newMeeting = {
      id: data.id,
      title: data.title,
      hostId: data.hostId,
      password: data.password || null,
      isLocked: false,
      waitingRoom: data.waitingRoom || false,
      isActive: true,
      startTime: new Date().toISOString(),
      endTime: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.meetings.push(newMeeting);
    saveDevStore(store);
    return newMeeting;
  },

  async joinMeeting(data: {
    meetingId: string;
    userId?: string | null;
    name: string;
    role?: 'HOST' | 'CO_HOST' | 'PARTICIPANT';
    isApproved?: boolean;
  }) {
    const role = data.role || 'PARTICIPANT';
    const isApproved = data.isApproved !== undefined ? data.isApproved : true;

    const usePg = await checkPrisma();
    if (usePg) {
      let validUserId = data.userId || null;
      if (validUserId) {
        try {
          const u = await prisma.user.findUnique({ where: { id: validUserId } });
          if (!u) validUserId = null;
        } catch {
          validUserId = null;
        }
      }

      try {
        const m = await prisma.meeting.findUnique({ where: { id: data.meetingId } });
        if (!m) {
          const guestHost = await userService.getOrCreateGuestHost();
          await prisma.meeting.create({
            data: {
              id: data.meetingId,
              title: 'Instant Meeting',
              hostId: guestHost.id,
            },
          });
        }
      } catch (meetErr) {
        console.warn('Meeting ensure in joinMeeting note:', meetErr);
      }

      return prisma.meetingParticipant.create({
        data: {
          meetingId: data.meetingId,
          userId: validUserId,
          guestName: data.name,
          role,
          isApproved,
        },
      });
    }

    const store = loadDevStore();
    const participant = {
      id: 'part_' + Math.random().toString(36).substring(2, 11),
      meetingId: data.meetingId,
      userId: data.userId || null,
      guestName: data.name,
      role,
      isApproved,
      joinedAt: new Date().toISOString(),
      leftAt: null,
    };
    store.participants.push(participant);
    saveDevStore(store);
    return participant;
  },

  async getParticipants(meetingId: string) {
    const usePg = await checkPrisma();
    if (usePg) {
      return prisma.meetingParticipant.findMany({
        where: { meetingId, leftAt: null },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
      });
    }

    const store = loadDevStore();
    return store.participants.filter((p) => p.meetingId === meetingId && !p.leftAt);
  },

  async getWaitingParticipants(meetingId: string) {
    const usePg = await checkPrisma();
    if (usePg) {
      return prisma.meetingParticipant.findMany({
        where: { meetingId, isApproved: false, leftAt: null },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: { joinedAt: 'asc' },
      });
    }
    const store = loadDevStore();
    return store.participants.filter(
      (p) => p.meetingId === meetingId && !p.isApproved && !p.leftAt
    );
  },

  async getParticipantById(id: string) {
    const usePg = await checkPrisma();
    if (usePg) {
      return prisma.meetingParticipant.findUnique({
        where: { id },
      });
    }
    const store = loadDevStore();
    return store.participants.find((p) => p.id === id) || null;
  },

  async admitParticipant(participantId: string) {
    const usePg = await checkPrisma();
    if (usePg) {
      return prisma.meetingParticipant.update({
        where: { id: participantId },
        data: { isApproved: true },
      });
    }
    const store = loadDevStore();
    const p = store.participants.find((x) => x.id === participantId);
    if (p) {
      p.isApproved = true;
      saveDevStore(store);
    }
    return p;
  },

  async denyParticipant(participantId: string) {
    const usePg = await checkPrisma();
    if (usePg) {
      return prisma.meetingParticipant.update({
        where: { id: participantId },
        data: { leftAt: new Date() },
      });
    }
    const store = loadDevStore();
    const p = store.participants.find((x) => x.id === participantId);
    if (p) {
      p.leftAt = new Date().toISOString();
      saveDevStore(store);
    }
    return p;
  },

  async admitAllWaiting(meetingId: string) {
    const usePg = await checkPrisma();
    if (usePg) {
      return prisma.meetingParticipant.updateMany({
        where: { meetingId, isApproved: false, leftAt: null },
        data: { isApproved: true },
      });
    }
    const store = loadDevStore();
    store.participants.forEach((p) => {
      if (p.meetingId === meetingId && !p.isApproved && !p.leftAt) {
        p.isApproved = true;
      }
    });
    saveDevStore(store);
    return true;
  },

  async endMeeting(id: string, hostId: string) {
    const usePg = await checkPrisma();
    if (usePg) {
      return prisma.meeting.updateMany({
        where: { id, hostId },
        data: { isActive: false, endTime: new Date() },
      });
    }

    const store = loadDevStore();
    const meeting = store.meetings.find((m) => m.id === id && m.hostId === hostId);
    if (meeting) {
      meeting.isActive = false;
      meeting.endTime = new Date().toISOString();
      saveDevStore(store);
    }
    return meeting;
  },

  async lockMeeting(id: string, hostId: string, isLocked: boolean) {
    const usePg = await checkPrisma();
    if (usePg) {
      return prisma.meeting.updateMany({
        where: { id, hostId },
        data: { isLocked },
      });
    }

    const store = loadDevStore();
    const meeting = store.meetings.find((m) => m.id === id && m.hostId === hostId);
    if (meeting) {
      meeting.isLocked = isLocked;
      saveDevStore(store);
    }
    return meeting;
  },

  async schedule(data: {
    title: string;
    hostId: string;
    date: Date;
    startTime: string;
    duration: number;
    timeZone: string;
    password?: string | null;
    waitingRoom?: boolean;
    meetingId?: string;
  }) {
    const usePg = await checkPrisma();
    if (usePg) {
      return prisma.scheduledMeeting.create({
        data: {
          title: data.title,
          hostId: data.hostId,
          date: data.date,
          startTime: data.startTime,
          duration: data.duration,
          timeZone: data.timeZone,
          password: data.password || null,
          waitingRoom: data.waitingRoom || false,
          meetingId: data.meetingId || null,
        },
      });
    }
    const store = loadDevStore();
    const newScheduled = {
      id: 'sch_' + Math.random().toString(36).substring(2, 11),
      title: data.title,
      hostId: data.hostId,
      date: data.date.toISOString(),
      startTime: data.startTime,
      duration: data.duration,
      timeZone: data.timeZone,
      password: data.password || null,
      waitingRoom: data.waitingRoom || false,
      meetingId: data.meetingId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.scheduledMeetings.push(newScheduled);
    saveDevStore(store);
    return newScheduled;
  },
};
