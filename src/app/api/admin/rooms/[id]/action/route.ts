import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin/admin-auth';
import { prisma, checkPrisma } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminSession = await getAdminSession();
    if (!adminSession) {
      return NextResponse.json({ error: 'Admin login required' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const action = body?.action as 'end' | 'toggle-lock' | undefined;

    if (!id || !action || !['end', 'toggle-lock'].includes(action)) {
      return NextResponse.json({ error: 'Invalid room action' }, { status: 400 });
    }

    if (await checkPrisma()) {
      const existing = await prisma.meeting.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
      }

      if (action === 'end') {
        await prisma.meeting.update({
          where: { id },
          data: { isActive: false, endTime: new Date() },
        });
        return NextResponse.json({ ok: true, action: 'end', id });
      } else {
        const updated = await prisma.meeting.update({
          where: { id },
          data: { isLocked: !existing.isLocked },
        });
        return NextResponse.json({
          ok: true,
          action: 'toggle-lock',
          id,
          isLocked: updated.isLocked,
        });
      }
    }

    // Local fallback store
    const dataDir =
      process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME ? '/tmp' : process.cwd();
    const filePath = path.join(dataDir, '.metromeet-dev-data.json');
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const meeting = Array.isArray(raw.meetings)
        ? raw.meetings.find((m: any) => m.id === id)
        : null;
      if (!meeting) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
      }
      if (action === 'end') {
        meeting.isActive = false;
        meeting.endTime = new Date().toISOString();
      } else {
        meeting.isLocked = !meeting.isLocked;
      }
      fs.writeFileSync(filePath, JSON.stringify(raw, null, 2), 'utf-8');
      return NextResponse.json({ ok: true, action, id, isLocked: meeting.isLocked });
    }

    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  } catch (err) {
    console.error('Admin room action error:', err);
    return NextResponse.json({ error: 'Failed to execute room action' }, { status: 500 });
  }
}
