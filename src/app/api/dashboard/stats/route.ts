import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { meetingService, userService } from '@/lib/db';

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await userService.findById(session.userId);
  const user = dbUser || {
    id: session.userId,
    name: session.name || 'User',
    email: session.email,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(session.name || 'User')}`,
    emailVerified: true,
  };

  const [recentMeetings, scheduledMeetings] = await Promise.all([
    meetingService.getRecentAndHistory(session.userId),
    meetingService.getScheduledMeetings(session.userId),
  ]);

  const totalDurationSeconds = recentMeetings.reduce(
    (sum, m) => sum + (m.durationSeconds || 0),
    0
  );
  const totalParticipants = recentMeetings.reduce(
    (sum, m) => sum + (m.participantCount || 1),
    0
  );
  const activeCount = recentMeetings.filter((m) => m.isActive).length;
  const completedCount = recentMeetings.filter((m) => !m.isActive).length;

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      emailVerified: user.emailVerified,
    },
    recentMeetings,
    scheduledMeetings,
    stats: {
      totalHosted: recentMeetings.length,
      upcomingCount: scheduledMeetings.length,
      activeCount,
      completedCount,
      totalDurationSeconds,
      totalParticipants,
    },
  });
}
