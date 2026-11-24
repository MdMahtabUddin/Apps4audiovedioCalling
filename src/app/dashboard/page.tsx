'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Video,
  LogIn,
  Calendar,
  Clock,
  Copy,
  Check,
  Users,
  Sparkles,
  ArrowRight,
  Search,
  Camera,
  Share2,
  CalendarDays,
  History,
  Radio,
  Zap,
  Lock,
  Timer,
  Download,
  RotateCcw,
  StopCircle,
  TrendingUp,
  FileText,
  Trash2,
  CheckCircle2,
  Shield,
  SlidersHorizontal,
  Award,
  Activity,
  ExternalLink,
  Home,
  Plus,
  Settings,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClockWidget } from '@/components/dashboard/clock-widget';
import { useToast } from '@/components/ui/toast';
import { UserProfile, MeetingItem, ScheduledMeetingItem } from '@/types';
import { generateMeetingId } from '@/lib/utils';

const NewMeetingModal = dynamic(
  () => import('@/components/dashboard/new-meeting-modal').then((m) => m.NewMeetingModal),
  { ssr: false }
);
const JoinMeetingModal = dynamic(
  () => import('@/components/dashboard/join-meeting-modal').then((m) => m.JoinMeetingModal),
  { ssr: false }
);
const ScheduleMeetingModal = dynamic(
  () => import('@/components/dashboard/schedule-meeting-modal').then((m) => m.ScheduleMeetingModal),
  { ssr: false }
);
const SettingsModal = dynamic(
  () => import('@/components/dashboard/settings-modal').then((m) => m.SettingsModal),
  { ssr: false }
);

type HistoryFilter = 'all' | 'active' | 'completed';
type HistorySort = 'newest' | 'longest' | 'participants';

function computeDurationSeconds(item: MeetingItem, nowMs: number): number {
  // Server computes real call time from participant join/leave. Only live calls tick locally.
  if (item.durationRecorded === false || item.hasStarted === false) return 0;
  const startMs = new Date(item.startTime || item.createdAt).getTime();
  if (item.isLive && !Number.isNaN(startMs)) {
    return Math.max(0, Math.round((nowMs - startMs) / 1000));
  }
  return item.durationSeconds || 0;
}

function formatDurationFor(item: MeetingItem, seconds: number): string {
  if (item.hasStarted === false) return 'Not started';
  if (item.durationRecorded === false) return 'Not recorded';
  return formatDurationDetailed(seconds);
}

function formatDurationDetailed(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '< 1 min';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes} min${minutes > 1 ? 's' : ''}`;
  }
  return `${seconds}s`;
}

function formatMeetingDate(dateString: string): string {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMeetingTime(dateString?: string | null): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatTimeWindow(startIso?: string | null, endIso?: string | null, isActive?: boolean): string {
  if (!startIso) return 'Not started';
  const startD = new Date(startIso);
  const startStr = formatMeetingTime(startIso);
  if (isActive || !endIso) {
    return `${startStr} – Ongoing`;
  }
  const endD = new Date(endIso);
  const endStr = formatMeetingTime(endIso);
  const sameDay =
    startD.getFullYear() === endD.getFullYear() &&
    startD.getMonth() === endD.getMonth() &&
    startD.getDate() === endD.getDate();

  if (sameDay) {
    return `${startStr} – ${endStr}`;
  }
  const shortEndDate = endD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startStr} – ${endStr} (${shortEndDate})`;
}

function buildScheduleStart(item: ScheduledMeetingItem): Date {
  const base = new Date(item.date);
  const [h, m] = (item.startTime || '00:00').split(':').map((n) => parseInt(n, 10));
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h || 0, m || 0, 0);
  return Number.isNaN(d.getTime()) ? base : d;
}

function toCalendarStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function getScheduleJoinUrl(item: ScheduledMeetingItem): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/meeting/${item.meetingId || item.id}`;
}

function getGoogleCalendarUrl(item: ScheduledMeetingItem): string {
  const start = buildScheduleStart(item);
  const end = new Date(start.getTime() + (item.duration || 30) * 60000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: item.title,
    dates: `${toCalendarStamp(start)}/${toCalendarStamp(end)}`,
    details: `Join MetroMeet: ${getScheduleJoinUrl(item)}`,
    location: getScheduleJoinUrl(item),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function downloadIcsFile(item: ScheduledMeetingItem) {
  const start = buildScheduleStart(item);
  const end = new Date(start.getTime() + (item.duration || 30) * 60000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MetroMeet//Meetings//EN',
    'BEGIN:VEVENT',
    `UID:${item.id}@metromeet`,
    `DTSTAMP:${toCalendarStamp(new Date())}`,
    `DTSTART:${toCalendarStamp(start)}`,
    `DTEND:${toCalendarStamp(end)}`,
    `SUMMARY:${item.title.replace(/[\r\n,;]/g, ' ')}`,
    `DESCRIPTION:Join MetroMeet: ${getScheduleJoinUrl(item)}`,
    `URL:${getScheduleJoinUrl(item)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${item.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'meeting'}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function getRelativeDayLabel(dateString: string): string {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfTarget) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 0) return 'Upcoming';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [recentMeetings, setRecentMeetings] = useState<MeetingItem[]>([]);
  const [scheduledMeetings, setScheduledMeetings] = useState<ScheduledMeetingItem[]>([]);
  const [activeTab, setActiveTab] = useState<'history' | 'upcoming'>('history');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historySort, setHistorySort] = useState<HistorySort>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [inlineCode, setInlineCode] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [repeatingId, setRepeatingId] = useState<string | null>(null);
  const [launchingTemplate, setLaunchingTemplate] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [visibleCount, setVisibleCount] = useState(10);

  // Studio quick scratchpad (persisted locally)
  const [scratchpad, setScratchpad] = useState('');
  const [deviceCount, setDeviceCount] = useState<{ audio: number; video: number }>({ audio: 1, video: 1 });

  // Modals
  const [isNewMeetingOpen, setIsNewMeetingOpen] = useState(false);
  const [isJoinMeetingOpen, setIsJoinMeetingOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Live ticker only runs when at least one meeting is actively live (zero idle CPU re-renders)
  const hasLiveMeeting = useMemo(() => recentMeetings.some((m) => m.isLive), [recentMeetings]);
  useEffect(() => {
    if (!hasLiveMeeting) return;
    const timer = setInterval(() => setNowMs(Date.now()), 10000);
    return () => clearInterval(timer);
  }, [hasLiveMeeting]);

  // Load local scratchpad if saved
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedNotes = localStorage.getItem('metromeet_dashboard_scratchpad');
      if (savedNotes) setScratchpad(savedNotes);
    }
  }, []);

  const handleScratchpadChange = (val: string) => {
    setScratchpad(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('metromeet_dashboard_scratchpad', val);
    }
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setUser(data.user);
      setRecentMeetings(data.recentMeetings || []);
      setScheduledMeetings(data.scheduledMeetings || []);
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleCopyLink = (meetingId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(meetingId);
    toast.success('Meeting link copied to clipboard');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleInlineJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineCode.trim()) return;
    let code = inlineCode.trim();
    if (code.includes('/meeting/')) {
      code = code.split('/meeting/')[1].split('?')[0];
    }
    code = code.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
    router.push(`/meeting/${code}`);
  };

  const handleEndActiveMeeting = async (meetingId: string) => {
    setEndingId(meetingId);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/end`, { method: 'POST' });
      if (res.ok) {
        toast.success('Meeting session ended and duration recorded in history');
        await fetchDashboardData();
      } else {
        toast.error('Could not end meeting session');
      }
    } catch {
      toast.error('Network error while ending meeting');
    } finally {
      setEndingId(null);
    }
  };

  const handleDeleteMeeting = async (meetingId: string, meetingTitle: string) => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Delete "${meetingTitle}" from your meeting history?`)
    ) {
      return;
    }
    setDeletingId(meetingId);
    try {
      const res = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setRecentMeetings((prev) => prev.filter((m) => m.id !== meetingId));
        toast.success('Meeting deleted permanently');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Could not delete meeting');
      }
    } catch {
      toast.error('Network error while deleting meeting');
    } finally {
      setDeletingId(null);
    }
  };

  const handleHostAgain = async (item: MeetingItem) => {
    setRepeatingId(item.id);
    const newId = generateMeetingId();
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newId,
          title: item.title || 'Instant Meeting',
          waitingRoom: item.waitingRoom,
        }),
      });
      if (res.ok && typeof window !== 'undefined') {
        localStorage.setItem(`metromeet_host_${newId}`, 'true');
      }
      router.push(`/meeting/${newId}`);
    } catch {
      router.push(`/meeting/${newId}`);
    } finally {
      setRepeatingId(null);
    }
  };

  const handleLaunchTemplate = async (templateTitle: string, waitingRoom: boolean) => {
    setLaunchingTemplate(templateTitle);
    const newId = generateMeetingId();
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newId,
          title: templateTitle,
          waitingRoom,
        }),
      });
      if (res.ok && typeof window !== 'undefined') {
        localStorage.setItem(`metromeet_host_${newId}`, 'true');
      }
      router.push(`/meeting/${newId}`);
    } catch {
      router.push(`/meeting/${newId}`);
    } finally {
      setLaunchingTemplate(null);
    }
  };

  const handleCopyFullInvite = (title: string, roomId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/meeting/${roomId}`;
    const inviteText = `📹 MetroMeet Invitation\nHost: ${user?.name || 'Host'}\nTopic: ${title}\nJoin Link: ${url}\nMeeting ID: ${roomId}`;
    navigator.clipboard.writeText(inviteText);
    toast.success('Full formatted invitation copied! Ready for WhatsApp / Email.');
  };

  const handleExportHistoryCSV = () => {
    if (recentMeetings.length === 0) {
      toast.info('No meeting history to export yet');
      return;
    }
    const headers = [
      'Meeting Title',
      'Meeting ID',
      'Status',
      'Date',
      'Start Time',
      'End Time',
      'Duration',
      'Participants',
    ];
    const rows = recentMeetings.map((m) => {
      const secs = computeDurationSeconds(m, nowMs);
      const startDate = formatMeetingDate(m.startTime || m.createdAt);
      const startT = formatMeetingTime(m.startTime || m.createdAt);
      const endT = m.endTime ? formatMeetingTime(m.endTime) : m.isActive ? 'Ongoing' : 'Completed';
      return [
        `"${(m.title || 'Untitled Meeting').replace(/"/g, '""')}"`,
        m.id,
        m.isActive ? 'Active' : 'Completed',
        `"${startDate}"`,
        `"${startT}"`,
        `"${endT}"`,
        `"${formatDurationFor(m, secs)}"`,
        m.participantCount || 1,
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MetroMeet-History-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Meeting history exported as CSV');
  };

  // Enrich meetings with computed live/recorded duration
  const enrichedHistory = useMemo(() => {
    return recentMeetings.map((m) => {
      const durationSec = computeDurationSeconds(m, nowMs);
      return {
        ...m,
        computedDurationSeconds: durationSec,
        formattedDuration: formatDurationFor(m, durationSec),
        formattedDate: formatMeetingDate(m.startTime || m.createdAt),
        formattedStartTime: formatMeetingTime(m.startTime || m.createdAt),
        formattedEndTime: m.endTime ? formatMeetingTime(m.endTime) : null,
        formattedTimeWindow: formatTimeWindow(m.startTime || m.createdAt, m.endTime, m.isActive),
        relativeDay: getRelativeDayLabel(m.startTime || m.createdAt),
      };
    });
  }, [recentMeetings, nowMs]);

  const filteredScheduled = useMemo(() => {
    if (!searchQuery.trim()) return scheduledMeetings;
    const q = searchQuery.toLowerCase();
    return scheduledMeetings.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.meetingId && m.meetingId.toLowerCase().includes(q))
    );
  }, [scheduledMeetings, searchQuery]);

  const filteredRecent = useMemo(() => {
    let list = enrichedHistory;

    if (historyFilter === 'active') {
      list = list.filter((m) => m.isActive);
    } else if (historyFilter === 'completed') {
      list = list.filter((m) => !m.isActive);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q)
      );
    }

    const sorted = [...list];
    if (historySort === 'longest') {
      sorted.sort((a, b) => b.computedDurationSeconds - a.computedDurationSeconds);
    } else if (historySort === 'participants') {
      sorted.sort((a, b) => (b.participantCount || 1) - (a.participantCount || 1));
    } else {
      sorted.sort(
        (a, b) =>
          new Date(b.startTime || b.createdAt).getTime() -
          new Date(a.startTime || a.createdAt).getTime()
      );
    }
    return sorted;
  }, [enrichedHistory, historyFilter, historySort, searchQuery]);

  // Aggregate Analytics & KPIs
  const analytics = useMemo(() => {
    const totalMeetings = enrichedHistory.length;
    const activeMeetings = enrichedHistory.filter((m) => m.isActive).length;
    const completedMeetings = totalMeetings - activeMeetings;
    const totalSeconds = enrichedHistory.reduce((acc, m) => acc + m.computedDurationSeconds, 0);
    const avgSeconds = totalMeetings > 0 ? Math.round(totalSeconds / totalMeetings) : 0;
    const totalParticipants = enrichedHistory.reduce((acc, m) => acc + (m.participantCount || 1), 0);

    const longestMeeting =
      enrichedHistory.length > 0
        ? [...enrichedHistory].sort((a, b) => b.computedDurationSeconds - a.computedDurationSeconds)[0]
        : null;

    const shortCalls = enrichedHistory.filter((m) => m.computedDurationSeconds < 900).length;
    const mediumCalls = enrichedHistory.filter(
      (m) => m.computedDurationSeconds >= 900 && m.computedDurationSeconds < 2700
    ).length;
    const longCalls = enrichedHistory.filter((m) => m.computedDurationSeconds >= 2700).length;

    // Last 7 days daily meeting count chart
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - i));
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
      const count = enrichedHistory.filter((m) => {
        const md = new Date(m.startTime || m.createdAt);
        return (
          md.getFullYear() === d.getFullYear() &&
          md.getMonth() === d.getMonth() &&
          md.getDate() === d.getDate()
        );
      }).length;
      return { label: dayLabel, count };
    });
    const maxDailyCount = Math.max(1, ...last7Days.map((d) => d.count));

    return {
      totalMeetings,
      activeMeetings,
      completedMeetings,
      totalSeconds,
      formattedTotalTime: totalSeconds > 0 ? formatDurationDetailed(totalSeconds) : '0m',
      formattedAvgTime: avgSeconds > 0 ? formatDurationDetailed(avgSeconds) : '0m',
      totalParticipants,
      longestMeeting,
      shortCalls,
      mediumCalls,
      longCalls,
      last7Days,
      maxDailyCount,
    };
  }, [enrichedHistory]);

  const personalRoomId = useMemo(() => {
    if (!user?.id) return 'my-personal-room';
    const clean = user.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `${clean.substring(0, 3)}-${clean.substring(3, 7) || 'room'}-${clean.substring(7, 10) || 'hub'}`;
  }, [user?.id]);

  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  // Helper to highlight search matches inside already-highlighted meeting titles
  const renderHighlightedTitle = (title: string) => {
    const cleanTitle = title || 'Untitled Meeting';
    if (!searchQuery.trim()) return cleanTitle;
    const q = searchQuery.trim();
    const idx = cleanTitle.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return cleanTitle;
    const before = cleanTitle.slice(0, idx);
    const match = cleanTitle.slice(idx, idx + q.length);
    const after = cleanTitle.slice(idx + q.length);
    return (
      <>
        {before}
        <mark className="bg-[#FF7A00] text-black px-1 rounded font-black">{match}</mark>
        {after}
      </>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#09090b] flex items-center justify-center transition-colors">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <Video className="h-5 w-5 text-white animate-pulse" />
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 flex flex-col selection:bg-blue-600 selection:text-white relative overflow-x-hidden transition-colors duration-200">
      <Navbar
        user={user}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onQuickNewMeeting={() => setIsNewMeetingOpen(true)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 pb-28 md:py-8 space-y-6 relative z-10">
        {/* ================================================================= */}
        {/* MOBILE APP HOME LAYOUT (Clean Native App Feel on < md)            */}
        {/* ================================================================= */}
        <div className="md:hidden space-y-4 animate-fade-up">
          {/* Compact Greeting Row */}
          <div className="flex items-center justify-between gap-2 px-0.5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">{greetingText}</p>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white truncate">
                {user?.name || 'Host'}
              </h1>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] text-[11px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {analytics.activeMeetings > 0 ? `${analytics.activeMeetings} Live` : 'Online'}
            </span>
          </div>

          {/* 4 Symmetrical Native App Action Icons */}
          <div className="grid grid-cols-4 gap-2.5">
            <button
              onClick={() => setIsNewMeetingOpen(true)}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
            >
              <div className="h-13 w-13 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-600/25">
                <Video className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 dark:text-zinc-300">New</span>
            </button>

            <button
              onClick={() => setIsJoinMeetingOpen(true)}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
            >
              <div className="h-13 w-13 rounded-xl bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.1] text-slate-800 dark:text-zinc-100 flex items-center justify-center shadow-xs">
                <LogIn className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 dark:text-zinc-300">Join</span>
            </button>

            <button
              onClick={() => setIsScheduleOpen(true)}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
            >
              <div className="h-13 w-13 rounded-xl bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.1] text-slate-800 dark:text-zinc-100 flex items-center justify-center shadow-xs">
                <Calendar className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 dark:text-zinc-300">Schedule</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
            >
              <div className="h-13 w-13 rounded-xl bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.1] text-slate-800 dark:text-zinc-100 flex items-center justify-center shadow-xs">
                <Camera className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 dark:text-zinc-300">Studio</span>
            </button>
          </div>

          {/* Compact 3-Stat App Summary Strip */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] text-center shadow-xs">
              <div className="text-base font-semibold text-slate-900 dark:text-white leading-none">{analytics.totalMeetings}</div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mt-1">Meetings</div>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] text-center shadow-xs">
              <div className="text-base font-semibold text-slate-900 dark:text-white leading-none">{analytics.formattedTotalTime}</div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mt-1">Talk Time</div>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] text-center shadow-xs">
              <div className="text-base font-semibold text-slate-900 dark:text-white leading-none">{scheduledMeetings.length}</div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mt-1">Scheduled</div>
            </div>
          </div>

          {/* Compact 1-Line Instant Join Bar */}
          <form
            onSubmit={handleInlineJoin}
            className="p-1.5 rounded-xl bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.1] flex items-center gap-2 shadow-xs"
          >
            <input
              type="text"
              placeholder="Enter meeting code or link..."
              value={inlineCode}
              onChange={(e) => setInlineCode(e.target.value)}
              className="flex-1 bg-transparent px-2.5 py-1.5 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none font-mono min-w-0"
            />
            <button
              type="submit"
              disabled={!inlineCode.trim()}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0 disabled:opacity-40 cursor-pointer"
            >
              Join
            </button>
          </form>
        </div>

        {/* 1. Clean 2026 Executive Workspace Header + Unified Command Dock (Desktop) */}
        <div className="hidden md:block relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#111114] shadow-sm shadow-slate-900/[0.04] dark:shadow-none animate-fade-up">
          <div className="absolute inset-0 bg-dot-matrix [mask-image:radial-gradient(ellipse_70%_70%_at_80%_20%,#000_30%,transparent_100%)] pointer-events-none" />

          <div className="relative z-10 p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] text-[11px] font-medium text-slate-700 dark:text-zinc-300">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    Workspace Online
                  </span>
                  {analytics.activeMeetings > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-600/15 border border-blue-200 dark:border-blue-500/25 text-[11px] font-medium text-blue-700 dark:text-blue-400">
                      {analytics.activeMeetings} Live Session{analytics.activeMeetings > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  {greetingText}, {user?.name || 'Host'}
                </h1>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  Launch an instant HD conference, join via code, or review your team sessions.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <ClockWidget />
                <button
                  onClick={handleExportHistoryCSV}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-white/[0.1] text-xs font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer"
                  title="Download meeting history (CSV)"
                >
                  <Download className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Unified 2026 Command Dock */}
            <div className="pt-5 border-t border-slate-200/80 dark:border-white/[0.07] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setIsNewMeetingOpen(true)}
                  className="inline-flex items-center gap-2 h-10 px-4.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-blue-600/25 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Video className="h-4 w-4" />
                  <span>New Meeting</span>
                </button>

                <button
                  onClick={() => setIsScheduleOpen(true)}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-white/[0.08] text-slate-800 dark:text-zinc-200 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
                >
                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>Schedule</span>
                </button>

                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-white/[0.08] text-slate-800 dark:text-zinc-200 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
                >
                  <Camera className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Device Studio</span>
                </button>
              </div>

              <form onSubmit={handleInlineJoin} className="flex items-center gap-2 lg:max-w-sm w-full">
                <div className="relative flex-1">
                  <LogIn className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Enter room code or link..."
                    value={inlineCode}
                    onChange={(e) => setInlineCode(e.target.value)}
                    className="w-full h-10 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-white/[0.1] rounded-xl pl-9 pr-3 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors font-mono"
                  />
                </div>
                <Button size="md" variant="orange" type="submit" disabled={!inlineCode.trim()} className="h-10 rounded-xl px-4 shrink-0">
                  Join
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* 2. Clean 4-Column KPI Strip (Desktop) */}
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up-1">
          <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] shadow-xs dark:shadow-none flex flex-col justify-between gap-3 glass-panel-hover">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Total Meetings</span>
              <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-600/10 border border-blue-200/70 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Video className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-slate-950 dark:text-white tracking-tight tabular-nums">
                {analytics.totalMeetings}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
                {analytics.completedMeetings} completed · {analytics.activeMeetings} live
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] shadow-xs dark:shadow-none flex flex-col justify-between gap-3 glass-panel-hover">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Total Talk Time</span>
              <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Timer className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-slate-950 dark:text-white tracking-tight tabular-nums">
                {analytics.formattedTotalTime}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
                Avg. {analytics.formattedAvgTime} / call
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] shadow-xs dark:shadow-none flex flex-col justify-between gap-3 glass-panel-hover">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Total Attendees</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-slate-950 dark:text-white tracking-tight tabular-nums">
                {analytics.totalParticipants}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
                Across hosted &amp; joined rooms
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] shadow-xs dark:shadow-none flex flex-col justify-between gap-3 glass-panel-hover">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Scheduled</span>
              <div className="h-8 w-8 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200/70 dark:border-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <CalendarDays className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-slate-950 dark:text-white tracking-tight tabular-nums">
                {scheduledMeetings.length}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1 truncate">
                {scheduledMeetings.length > 0
                  ? `Next: ${scheduledMeetings[0].title}`
                  : 'No upcoming calls'}
              </p>
            </div>
          </div>
        </div>

        {/* 5. Main Content Grid: Meeting History & Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Meeting History Log & Upcoming Schedule */}
          <div className="lg:col-span-2 space-y-4">
            {/* Control Header: Primary Tabs + Search + Filter & Sort */}
            <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#09090b] border border-slate-200/80 dark:border-white/[0.08]">
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      activeTab === 'history'
                        ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    <History className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">History ({recentMeetings.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('upcoming')}
                    className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      activeTab === 'upcoming'
                        ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Upcoming ({scheduledMeetings.length})</span>
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search title or meeting ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-white/[0.1] rounded-lg pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none focus:border-blue-500 transition-colors w-full"
                  />
                </div>
              </div>

              {/* Sub-bar for History Filtering & Sorting */}
              {activeTab === 'history' && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.07]">
                  <div className="flex items-center gap-1.5">
                    {(
                      [
                        { key: 'all', label: `All (${recentMeetings.length})` },
                        { key: 'active', label: `Live Now (${analytics.activeMeetings})` },
                        { key: 'completed', label: `Completed (${analytics.completedMeetings})` },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setHistoryFilter(tab.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          historyFilter === tab.key
                            ? 'bg-[#0066FF]/20 text-[#388BFF] border border-[#0066FF]/40'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-[11px] text-gray-400 font-medium">Sort by:</span>
                    <select
                      value={historySort}
                      onChange={(e) => setHistorySort(e.target.value as HistorySort)}
                      className="bg-black/50 border border-white/[0.12] rounded-xl px-2.5 py-1 text-xs text-gray-200 outline-none focus:border-[#0066FF] cursor-pointer"
                    >
                      <option value="newest">Newest First</option>
                      <option value="longest">Longest Duration</option>
                      <option value="participants">Most Participants</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* TAB 1: Complete Meeting History List */}
            {activeTab === 'history' && (
              <div className="space-y-3.5">
                {filteredRecent.length === 0 ? (
                  <div className="p-12 rounded-3xl border border-dashed border-white/[0.12] bg-[#091222]/50 text-center space-y-3.5">
                    <div className="h-14 w-14 rounded-2xl bg-[#0066FF]/10 border border-[#0066FF]/25 text-[#388BFF] flex items-center justify-center mx-auto">
                      <History className="h-7 w-7" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-bold text-white">
                        {searchQuery || historyFilter !== 'all'
                          ? 'No meetings match your current filter'
                          : 'No meeting history recorded yet'}
                      </p>
                      <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                        Every meeting you host or join is automatically logged here with its highlighted title, exact date & start/end time, and total call duration.
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setIsNewMeetingOpen(true)}>
                      <Video className="h-4 w-4 mr-1.5" />
                      Start Your First Meeting
                    </Button>
                  </div>
                ) : (
                  filteredRecent.slice(0, visibleCount).map((item, index) => {
                    const isUserHost = !user || item.hostId === user.id;
                    return (
                      <div
                        key={item.id}
                        className="group relative overflow-hidden rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#111114] hover:border-slate-300 dark:hover:border-white/[0.16] transition-all duration-200 p-5 shadow-xs dark:shadow-none"
                      >
                        <div className="flex flex-col gap-4">
                          {/* Top Row: Clean Meeting Title + Status & Duration Pill */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="h-6 px-2 rounded-md bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-mono font-semibold text-slate-500 dark:text-zinc-400 flex items-center justify-center">
                                #{filteredRecent.length - index}
                              </span>

                              <h4 className="text-sm sm:text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                                {renderHighlightedTitle(item.title)}
                              </h4>

                              {/* Live or Completed Status Badge */}
                              {item.isActive ? (
                                <Badge variant="success" dot>
                                  LIVE
                                </Badge>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-900 text-[11px] font-medium text-slate-600 dark:text-zinc-400 border border-slate-200/80 dark:border-white/[0.08]">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                  Completed
                                </span>
                              )}

                              {/* Role Badge */}
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-600/10 text-[11px] font-medium text-blue-700 dark:text-blue-400 border border-blue-200/70 dark:border-blue-500/20">
                                {isUserHost ? 'Host' : 'Participant'}
                              </span>
                            </div>

                            {/* Clean Duration Pill */}
                            <div
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold shrink-0 self-start sm:self-auto ${
                                item.isActive
                                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-zinc-300'
                              }`}
                              title="Total meeting duration"
                            >
                              <Timer className="h-3.5 w-3.5 shrink-0" />
                              <span>
                                {item.isActive
                                  ? `Live · ${item.formattedDuration}`
                                  : item.formattedDuration}
                              </span>
                            </div>
                          </div>

                          {/* Middle Row: Clean Telemetry Strip */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-[#09090b] border border-slate-200/70 dark:border-white/[0.06]">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/[0.08] text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                <Calendar className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-semibold">
                                  Date ({item.relativeDay})
                                </p>
                                <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">
                                  {item.formattedDate}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-zinc-300 flex items-center justify-center shrink-0">
                                <Clock className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-semibold">
                                  Time Window
                                </p>
                                <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">
                                  {item.formattedTimeWindow}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/[0.08] text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <Users className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-semibold">
                                  Attendance &amp; ID
                                </p>
                                <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">
                                  {item.participantCount || 1} participant
                                  {(item.participantCount || 1) !== 1 ? 's' : ''} ·{' '}
                                  <span className="font-mono text-blue-600 dark:text-blue-400">{item.id}</span>
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Bottom Row: Security Indicators & Action Buttons */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                              {item.waitingRoom && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                  <Shield className="h-3 w-3" /> Waiting Room
                                </span>
                              )}
                              {item.isLocked && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                  <Lock className="h-3 w-3" /> Locked
                                </span>
                              )}
                              <span className="text-gray-500">
                                Room ID: <code className="text-gray-300 font-mono">{item.id}</code>
                              </span>
                            </div>

                            <div className="flex items-center gap-2 ml-auto">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleCopyLink(item.id)}
                                title="Copy room link"
                              >
                                {copiedId === item.id ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" />
                                    <span>Copy Link</span>
                                  </>
                                )}
                              </Button>

                              {item.isActive ? (
                                <>
                                  {isUserHost && (
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      isLoading={endingId === item.id}
                                      onClick={() => handleEndActiveMeeting(item.id)}
                                      title="End this active session and finalize duration"
                                    >
                                      <StopCircle className="h-3.5 w-3.5" />
                                      <span>End Session</span>
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    onClick={() => router.push(`/meeting/${item.id}`)}
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    <span>Rejoin Live</span>
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  isLoading={repeatingId === item.id}
                                  onClick={() => handleHostAgain(item)}
                                  title="Start a new meeting session with this same title"
                                >
                                  <RotateCcw className="h-3.5 w-3.5 text-[#388BFF]" />
                                  <span>Host Again</span>
                                </Button>
                              )}

                              {isUserHost && (
                                <button
                                  type="button"
                                  disabled={deletingId === item.id}
                                  onClick={() => handleDeleteMeeting(item.id, item.title)}
                                  className="h-8 w-8 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/25 hover:border-rose-500/50 text-rose-400 hover:text-rose-200 flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-40"
                                  title="Delete meeting from history"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {filteredRecent.length > visibleCount && (
                  <div className="flex justify-center pt-2">
                    <Button variant="secondary" size="sm" onClick={() => setVisibleCount((c) => c + 10)}>
                      Show more ({filteredRecent.length - visibleCount} older meetings)
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Upcoming Scheduled Meetings List */}
            {activeTab === 'upcoming' && (
              <div className="space-y-3.5">
                {filteredScheduled.length === 0 ? (
                  <div className="p-12 rounded-3xl border border-dashed border-white/[0.12] bg-[#091222]/50 text-center space-y-3.5">
                    <div className="h-14 w-14 rounded-2xl bg-violet-500/10 border border-violet-500/25 text-violet-400 flex items-center justify-center mx-auto">
                      <Calendar className="h-7 w-7" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-bold text-white">
                        {searchQuery ? 'No scheduled meetings match your filter' : 'No upcoming scheduled meetings'}
                      </p>
                      <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                        Plan ahead, set passcodes, and prepare meetings with waiting room controls for your team.
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setIsScheduleOpen(true)}>
                      <Calendar className="h-4 w-4 mr-1.5" />
                      Schedule a Meeting
                    </Button>
                  </div>
                ) : (
                  filteredScheduled.map((item) => (
                    <div
                      key={item.id}
                      className="relative overflow-hidden p-5 sm:p-6 rounded-3xl border border-white/[0.09] bg-gradient-to-br from-[#0b1528]/95 via-[#091222]/95 to-[#070e1b]/95 hover:border-violet-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-violet-500 to-[#0066FF]" />

                      <div className="space-y-2.5 pl-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                          {/* Highlighted Scheduled Meeting Title */}
                          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-violet-500/25 via-[#0066FF]/20 to-indigo-500/15 border border-violet-400/50 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
                            <Sparkles className="h-4 w-4 text-violet-300 shrink-0" />
                            <h4 className="text-sm sm:text-base font-black text-white">
                              {renderHighlightedTitle(item.title)}
                            </h4>
                          </div>
                          {item.waitingRoom && <Badge variant="warning">Waiting Room</Badge>}
                          <Badge variant="indigo">Planned • {item.duration} mins</Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
                          <span className="flex items-center gap-1.5 text-violet-300 font-semibold">
                            <Clock className="h-3.5 w-3.5 text-violet-400" />
                            {formatMeetingDate(item.date)} at {item.startTime}
                          </span>
                          <span>•</span>
                          <span className="text-amber-300 font-semibold">
                            Allocated Duration: {item.duration} mins
                          </span>
                          <span>•</span>
                          <span className="font-mono text-gray-400">
                            ID: {item.meetingId || item.id}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadIcsFile(item)}
                          title="Download .ics for Outlook / Apple Calendar"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>.ics</span>
                        </Button>
                        <a
                          href={getGoogleCalendarUrl(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-gray-200 transition-colors"
                          title="Add to Google Calendar"
                        >
                          <CalendarDays className="h-3.5 w-3.5 text-[#388BFF]" />
                          <span>Google Calendar</span>
                        </a>
                        {item.meetingId && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleCopyLink(item.meetingId!)}
                            title="Copy link"
                          >
                            {copiedId === item.meetingId ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => router.push(`/meeting/${item.meetingId || item.id}`)}
                        >
                          Start Call
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Right 1 Column: Enterprise Tools & Insights (User Profile Card Removed) */}
          <div className="space-y-6">
            {/* 1. Personal Meeting Room */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Personal Meeting Room
                  </CardTitle>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                    Ready
                  </span>
                </div>
                <CardDescription className="text-xs text-slate-500 dark:text-zinc-400">
                  Your permanent room link for quick team syncs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#09090b] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-semibold">
                      Personal Room ID
                    </p>
                    <span className="text-xs font-mono font-semibold text-slate-800 dark:text-zinc-200 truncate block">
                      {personalRoomId}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 shrink-0"
                    onClick={() => handleCopyLink(personalRoomId)}
                    title="Copy Personal Room Link"
                  >
                    {copiedId === personalRoomId ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="flex-1 text-xs font-bold"
                    onClick={() => router.push(`/meeting/${personalRoomId}`)}
                  >
                    <Video className="h-3.5 w-3.5 mr-1.5" />
                    Launch Room
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs font-bold"
                    onClick={() =>
                      handleCopyFullInvite(
                        `${user?.name || 'Host'}'s Personal Room`,
                        personalRoomId
                      )
                    }
                    title="Copy full formatted invitation for WhatsApp / Email"
                  >
                    <Share2 className="h-3.5 w-3.5 mr-1" />
                    Invite
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 2. Duration & Collaboration Analytics Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                    <TrendingUp className="h-4 w-4 text-amber-500" />
                    Duration &amp; Call Analytics
                  </CardTitle>
                  <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    Telemetry
                  </span>
                </div>
                <CardDescription className="text-xs text-slate-500 dark:text-zinc-400">
                  Breakdown of your meeting lengths and longest session highlight
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Longest Meeting Highlight Box */}
                {analytics.longestMeeting ? (
                  <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-500/[0.08] border border-amber-200/80 dark:border-amber-500/25 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      <span className="flex items-center gap-1">
                        <Award className="h-3.5 w-3.5" /> Longest Session
                      </span>
                      <span className="font-mono">{analytics.longestMeeting.formattedDuration}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {analytics.longestMeeting.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      {analytics.longestMeeting.formattedDate} at{' '}
                      {analytics.longestMeeting.formattedStartTime}
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09090b] border border-slate-200/80 dark:border-white/[0.06] text-xs text-slate-500 dark:text-zinc-400 text-center">
                    Host a meeting to unlock duration breakdown insights.
                  </div>
                )}

                {/* Weekly Activity Mini Bar Chart (Last 7 Days) */}
                <div className="pt-3 border-t border-slate-200/80 dark:border-white/[0.07] space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">Last 7 Days Activity</span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-500">Sessions / Day</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 items-end h-16 pt-2">
                    {analytics.last7Days.map((day, idx) => {
                      const heightPct =
                        day.count > 0
                          ? Math.max(24, Math.round((day.count / analytics.maxDailyCount) * 100))
                          : 12;
                      return (
                        <div key={idx} className="flex flex-col items-center gap-1 h-full justify-end">
                          <div className="w-full flex-1 flex items-end justify-center">
                            <div
                              title={`${day.label}: ${day.count} meeting${day.count !== 1 ? 's' : ''}`}
                              className={`w-full rounded-t-md transition-all duration-500 ${
                                day.count > 0
                                  ? 'bg-gradient-to-t from-blue-600 to-sky-400'
                                  : 'bg-slate-200/80 dark:bg-white/[0.07]'
                              }`}
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400">
                            {day.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Duration Distribution Bars */}
                <div className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-600 dark:text-zinc-400">Quick Syncs (&lt; 15 mins)</span>
                      <span className="font-semibold text-slate-900 dark:text-zinc-200 tabular-nums">{analytics.shortCalls} calls</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/[0.07] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-500"
                        style={{
                          width: `${
                            analytics.totalMeetings > 0 && analytics.shortCalls > 0
                              ? Math.max(8, Math.round((analytics.shortCalls / analytics.totalMeetings) * 100))
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-600 dark:text-zinc-400">Standard Sessions (15–45 mins)</span>
                      <span className="font-semibold text-slate-900 dark:text-zinc-200 tabular-nums">{analytics.mediumCalls} calls</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/[0.07] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{
                          width: `${
                            analytics.totalMeetings > 0 && analytics.mediumCalls > 0
                              ? Math.max(8, Math.round((analytics.mediumCalls / analytics.totalMeetings) * 100))
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-600 dark:text-zinc-400">Deep Dives (45+ mins)</span>
                      <span className="font-semibold text-slate-900 dark:text-zinc-200 tabular-nums">{analytics.longCalls} calls</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/[0.07] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-500"
                        style={{
                          width: `${
                            analytics.totalMeetings > 0 && analytics.longCalls > 0
                              ? Math.max(8, Math.round((analytics.longCalls / analytics.totalMeetings) * 100))
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Native Mobile App Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/[0.08] shadow-lg shadow-slate-900/[0.05] dark:shadow-black/60 pb-[env(safe-area-inset-bottom)] transition-colors">
        <div className="grid grid-cols-5 items-end px-2 pt-2 pb-2.5 max-w-md mx-auto">
          <button
            onClick={() => {
              setActiveTab('history');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center gap-1 py-1 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'history' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-zinc-400'
            }`}
          >
            <Home className="h-5 w-5" strokeWidth={activeTab === 'history' ? 2.2 : 1.8} />
            <span className="text-[10px] font-medium">Home</span>
          </button>

          <button
            onClick={() => setIsJoinMeetingOpen(true)}
            className="flex flex-col items-center gap-1 py-1 rounded-xl text-slate-500 dark:text-zinc-400 transition-colors cursor-pointer"
          >
            <LogIn className="h-5 w-5" strokeWidth={1.8} />
            <span className="text-[10px] font-medium">Join</span>
          </button>

          {/* Center Floating Native Action Button: New Meeting */}
          <div className="flex flex-col items-center -mt-5">
            <button
              onClick={() => setIsNewMeetingOpen(true)}
              className="h-12 w-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 active:scale-95 transition-transform cursor-pointer"
              title="New Meeting"
            >
              <Plus className="h-6 w-6" strokeWidth={2.4} />
            </button>
            <span className="text-[10px] font-semibold text-slate-900 dark:text-zinc-200 mt-1">New</span>
          </div>

          <button
            onClick={() => setIsScheduleOpen(true)}
            className={`flex flex-col items-center gap-1 py-1 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'upcoming' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-zinc-400'
            }`}
          >
            <Calendar className="h-5 w-5" strokeWidth={activeTab === 'upcoming' ? 2.2 : 1.8} />
            <span className="text-[10px] font-medium">Schedule</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex flex-col items-center gap-1 py-1 rounded-xl text-slate-500 dark:text-zinc-400 transition-colors cursor-pointer"
          >
            <Settings className="h-5 w-5" strokeWidth={1.8} />
            <span className="text-[10px] font-medium">Settings</span>
          </button>
        </div>
      </nav>

      {/* Lazy-Loaded Modals (only downloaded & mounted when opened) */}
      {isNewMeetingOpen && (
        <NewMeetingModal
          isOpen={isNewMeetingOpen}
          onClose={() => setIsNewMeetingOpen(false)}
          onMeetingCreated={fetchDashboardData}
        />
      )}
      {isJoinMeetingOpen && (
        <JoinMeetingModal
          isOpen={isJoinMeetingOpen}
          onClose={() => setIsJoinMeetingOpen(false)}
        />
      )}
      {isScheduleOpen && (
        <ScheduleMeetingModal
          isOpen={isScheduleOpen}
          onClose={() => setIsScheduleOpen(false)}
          onScheduled={fetchDashboardData}
        />
      )}
      {user && isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          user={user}
          onUserUpdated={(updated) => setUser(updated)}
        />
      )}
    </div>
  );
}
