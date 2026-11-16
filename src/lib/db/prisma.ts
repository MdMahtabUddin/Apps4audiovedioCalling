import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Candidate database URLs in order of preference
const rawUrls = [
  process.env.POSTGRES_PRISMA_URL,
  process.env.POSTGRES_URL,
  process.env.STORAGE_URL,
  process.env.DATABASE_URL,
];

// Pick the first URL that is not a dead sample URL like db.prisma.io or localhost in production
const resolvedDbUrl =
  rawUrls.find(
    (u) =>
      u &&
      !u.includes('db.prisma.io') &&
      (!u.includes('localhost:5432') || process.env.NODE_ENV !== 'production')
  ) || process.env.DATABASE_URL;

if (resolvedDbUrl) {
  process.env.DATABASE_URL = resolvedDbUrl;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: resolvedDbUrl ? { db: { url: resolvedDbUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
