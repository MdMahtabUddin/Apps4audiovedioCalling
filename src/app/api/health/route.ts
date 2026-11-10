import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureDatabaseSchema } from '@/lib/db/init-db';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1 as test`;
    try {
      await prisma.user.count();
    } catch {
      await ensureDatabaseSchema();
    }
    const userCount = await prisma.user.count();
    const meetingCount = await prisma.meeting.count();
    return NextResponse.json({ status: 'ok', pg: true, userCount, meetingCount });
  } catch (err: any) {
    return NextResponse.json({ status: 'pg_error', error: err.message }, { status: 200 });
  }
}
