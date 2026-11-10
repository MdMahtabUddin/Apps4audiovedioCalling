import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1 as test`;
    const userCount = await prisma.user.count();
    const meetingCount = await prisma.meeting.count();
    return NextResponse.json({ status: 'ok', pg: true, userCount, meetingCount });
  } catch (err: any) {
    return NextResponse.json({ status: 'pg_error', error: err.message }, { status: 200 });
  }
}
