'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { NewMeetingModal } from '@/components/dashboard/new-meeting-modal';
import { JoinMeetingModal } from '@/components/dashboard/join-meeting-modal';
import { ScheduleMeetingModal } from '@/components/dashboard/schedule-meeting-modal';
import { SettingsModal } from '@/components/dashboard/settings-modal';
import { useToast } from '@/components/ui/toast';
import { UserProfile, MeetingItem, ScheduledMeetingItem } from '@/types';
import { generateMeetingId } from '@/lib/utils';

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

  // Live ticker for active meeting duration updates
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Load local scratchpad & inspect connected media hardware count
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedNotes = localStorage.getItem('metromeet_dashboard_scratchpad');
      if (savedNotes) setScratchpad(savedNotes);

      if (navigator.mediaDevices?.enumerateDevices) {
        navigator.mediaDevices
          .enumerateDevices()
          .then((devices) => {
            const audio = devices.filter((d) => d.kind === 'audioinput').length || 1;
            const video = devices.filter((d) => d.kind === 'videoinput').length || 1;
            setDeviceCount({ audio, video });
          })
          .catch(() => {});
      }
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
      <div className="min-h-screen bg-[#050a14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-[#0066FF]/30 border border-[#0066FF]/40 animate-ping absolute inset-0" />
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-[#0066FF] to-[#FF7A00] flex items-center justify-center relative z-10 shadow-2xl shadow-[#0066FF]/50">
              <Video className="h-7 w-7 text-white animate-pulse" />
            </div>
          </div>
          <p className="text-xs text-gray-400 font-bold tracking-widest uppercase">
            Initializing MetroMeet Workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050a14] text-slate-100 flex flex-col selection:bg-[#0066FF] selection:text-white relative overflow-x-hidden">
      {/* Ambient Executive Background Orbs & Grid */}
      <div className="fixed inset-0 bg-grid-pattern opacity-35 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[650px] h-[380px] bg-[#0066FF]/12 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-80 left-0 w-[520px] h-[340px] bg-[#FF7A00]/8 rounded-full blur-3xl pointer-events-none" />

      <Navbar
        user={user}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onQuickNewMeeting={() => setIsNewMeetingOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-28 md:py-7 space-y-7 relative z-10">
        {/* 1. Executive Studio Command Header */}
        <div className="relative overflow-hidden rounded-3xl border border-[#0066FF]/25 bg-gradient-to-r from-[#091326]/95 via-[#0d1b35]/90 to-[#091220]/95 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl shadow-black/60">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#0066FF]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 left-1/3 w-80 h-80 bg-[#FF7A00]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge variant="success" dot>
                  Enterprise Studio Online
                </Badge>
                {analytics.activeMeetings > 0 && (
                  <Badge variant="orange" dot>
                    {analytics.activeMeetings} Live Session{analytics.activeMeetings > 1 ? 's' : ''} Active
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                {greetingText},{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#388BFF] via-cyan-300 to-[#FF7A00]">
                  {user?.name || 'Host'}
                </span>
              </h1>

              <p className="text-xs sm:text-sm text-gray-300/90 max-w-2xl font-normal leading-relaxed">
                Manage your global vedio conferences, monitor complete session history with real-time duration telemetry, and launch high-definition rooms in one click.
              </p>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-4 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/[0.08]">
              <ClockWidget />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportHistoryCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-semibold text-gray-300 hover:text-white transition-all cursor-pointer"
                  title="Download complete meeting history report (CSV)"
                >
                  <Download className="h-3.5 w-3.5 text-[#388BFF]" />
                  <span>Export CSV Log</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. International-Standard Executive Telemetry & KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
          {/* KPI 1: Total Meetings Conducted */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#091222]/85 border border-[#0066FF]/20 backdrop-blur-xl shadow-xl flex flex-col justify-between gap-3 hover:border-[#0066FF]/45 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">
                Total Meetings
              </span>
              <div className="h-9 w-9 rounded-2xl bg-[#0066FF]/15 border border-[#0066FF]/30 text-[#388BFF] flex items-center justify-center">
                <Video className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {analytics.totalMeetings}
              </div>
              <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1.5">
                <span className="text-emerald-400 font-semibold">{analytics.completedMeetings} completed</span>
                <span>•</span>
                <span className="text-[#FFA033] font-semibold">{analytics.activeMeetings} live</span>
              </p>
            </div>
          </div>

          {/* KPI 2: Total Collaboration Time & Duration */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#091222]/85 border border-[#FF7A00]/20 backdrop-blur-xl shadow-xl flex flex-col justify-between gap-3 hover:border-[#FF7A00]/45 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">
                Total Meeting Time
              </span>
              <div className="h-9 w-9 rounded-2xl bg-[#FF7A00]/15 border border-[#FF7A00]/30 text-[#FFA033] flex items-center justify-center">
                <Timer className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {analytics.formattedTotalTime}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Avg. duration:{' '}
                <span className="text-amber-300 font-semibold">{analytics.formattedAvgTime}</span> / call
              </p>
            </div>
          </div>

          {/* KPI 3: Total Participants Connected */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#091222]/85 border border-emerald-500/20 backdrop-blur-xl shadow-xl flex flex-col justify-between gap-3 hover:border-emerald-500/45 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">
                Total Attendees
              </span>
              <div className="h-9 w-9 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {analytics.totalParticipants}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Across all hosted & joined rooms
              </p>
            </div>
          </div>

          {/* KPI 4: Upcoming Scheduled Syncs */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#091222]/85 border border-violet-500/20 backdrop-blur-xl shadow-xl flex flex-col justify-between gap-3 hover:border-violet-500/45 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">
                Scheduled Agenda
              </span>
              <div className="h-9 w-9 rounded-2xl bg-violet-500/15 border border-violet-500/30 text-violet-400 flex items-center justify-center">
                <CalendarDays className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {scheduledMeetings.length}
              </div>
              <p className="text-[11px] text-gray-400 mt-1 truncate">
                {scheduledMeetings.length > 0
                  ? `Next: ${scheduledMeetings[0].title}`
                  : 'No upcoming calls scheduled'}
              </p>
            </div>
          </div>
        </div>

        {/* 3. 4 Signature Quick-Launch Studio Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: New Meeting */}
          <button
            onClick={() => setIsNewMeetingOpen(true)}
            className="group text-left p-6 rounded-3xl bg-gradient-to-br from-[#FF7A00]/20 via-orange-600/10 to-[#091222] border border-[#FF7A00]/30 hover:border-[#FF7A00]/70 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#FF7A00]/20 cursor-pointer relative overflow-hidden flex flex-col justify-between h-44"
          >
            <div className="flex items-center justify-between w-full">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#FF7A00] to-amber-500 text-white flex items-center justify-center shadow-lg shadow-[#FF7A00]/30 group-hover:scale-110 transition-transform">
                <Video className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#FF7A00]/15 text-[#FFA033] border border-[#FF7A00]/30">
                Instant HD
              </span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-white group-hover:text-[#FFA033] transition-colors">
                New Meeting
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Start an instant room or shareable link</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#FFA033] group-hover:translate-x-1 transition-transform">
              Launch studio room <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </button>

          {/* Card 2: Join Meeting */}
          <button
            onClick={() => setIsJoinMeetingOpen(true)}
            className="group text-left p-6 rounded-3xl bg-gradient-to-br from-[#0066FF]/20 via-blue-600/10 to-[#091222] border border-[#0066FF]/30 hover:border-[#0066FF]/70 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#0066FF]/20 cursor-pointer relative overflow-hidden flex flex-col justify-between h-44"
          >
            <div className="flex items-center justify-between w-full">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#0066FF] to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-[#0066FF]/30 group-hover:scale-110 transition-transform">
                <LogIn className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#0066FF]/15 text-[#388BFF] border border-[#0066FF]/30">
                Direct Code
              </span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-white group-hover:text-[#388BFF] transition-colors">
                Join Meeting
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Connect via room code or invitation link</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#388BFF] group-hover:translate-x-1 transition-transform">
              Enter room lobby <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </button>

          {/* Card 3: Schedule */}
          <button
            onClick={() => setIsScheduleOpen(true)}
            className="group text-left p-6 rounded-3xl bg-gradient-to-br from-violet-500/20 via-purple-600/10 to-[#091222] border border-violet-500/30 hover:border-violet-500/70 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-violet-500/20 cursor-pointer relative overflow-hidden flex flex-col justify-between h-44"
          >
            <div className="flex items-center justify-between w-full">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-purple-500 text-white flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform">
                <Calendar className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                Calendar
              </span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-white group-hover:text-violet-300 transition-colors">
                Schedule Call
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Plan future sessions with passcodes</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-violet-400 group-hover:translate-x-1 transition-transform">
              Book time slot <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </button>

          {/* Card 4: Audio/Video Device Studio */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="group text-left p-6 rounded-3xl bg-gradient-to-br from-emerald-500/20 via-teal-600/10 to-[#091222] border border-emerald-500/30 hover:border-emerald-500/70 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/20 cursor-pointer relative overflow-hidden flex flex-col justify-between h-44"
          >
            <div className="flex items-center justify-between w-full">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                <Camera className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                AV Check
              </span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                Device Studio
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Test microphone level & HD camera</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
              Configure hardware <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </button>
        </div>

        {/* 3.5 One-Click Quick Meeting Templates */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[#FFA033]" />
              One-Click Meeting Templates
            </h3>
            <span className="text-[11px] text-gray-500">Instant room launch with preset security</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                title: 'Daily Standup',
                subtitle: 'Quick 15m team sync',
                waitingRoom: false,
                accent: 'border-[#0066FF]/30 hover:border-[#0066FF]/70 text-[#388BFF]',
                tag: 'Open Room',
              },
              {
                title: 'Executive Boardroom',
                subtitle: 'Protected leadership call',
                waitingRoom: true,
                accent: 'border-[#FF7A00]/30 hover:border-[#FF7A00]/70 text-[#FFA033]',
                tag: 'Waiting Room',
              },
              {
                title: 'Whiteboard Brainstorm',
                subtitle: 'Sketch & collaborate live',
                waitingRoom: false,
                accent: 'border-violet-500/30 hover:border-violet-500/70 text-violet-300',
                tag: 'Draw Ready',
              },
              {
                title: '1-on-1 Interview',
                subtitle: 'Private candidate lobby',
                waitingRoom: true,
                accent: 'border-emerald-500/30 hover:border-emerald-500/70 text-emerald-300',
                tag: 'Waiting Room',
              },
            ].map((tpl) => (
              <button
                key={tpl.title}
                disabled={launchingTemplate === tpl.title}
                onClick={() => handleLaunchTemplate(tpl.title, tpl.waitingRoom)}
                className={`group text-left p-4 rounded-2xl bg-[#091222]/85 border transition-all hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between gap-2 ${tpl.accent}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                    {tpl.title}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="flex items-center justify-between gap-1 text-[10px]">
                  <span className="text-gray-400 truncate">{tpl.subtitle}</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/[0.06] font-bold shrink-0">
                    {launchingTemplate === tpl.title ? 'Starting...' : tpl.tag}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 4. Quick Meeting Code Entry Bar */}
        <div className="p-4 sm:p-5 rounded-3xl bg-[#091222]/90 border border-[#0066FF]/20 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-[#0066FF]/15 text-[#388BFF] flex items-center justify-center border border-[#0066FF]/30 shrink-0">
              <LogIn className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Instant Room Connect</h4>
              <p className="text-xs text-gray-400">
                Paste any meeting code or full URL to jump straight into the conference
              </p>
            </div>
          </div>

          <form onSubmit={handleInlineJoin} className="flex items-center gap-2.5 max-w-md w-full">
            <input
              type="text"
              placeholder="e.g. abc-defg-hij or full link"
              value={inlineCode}
              onChange={(e) => setInlineCode(e.target.value)}
              className="flex-1 bg-black/50 border border-white/[0.12] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-[#0066FF] transition-all font-mono"
            />
            <Button size="md" type="submit" disabled={!inlineCode.trim()}>
              Join Room
            </Button>
          </form>
        </div>

        {/* 5. Main Content Grid: Complete Meeting History & Analytics Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
          {/* Left 2 Columns: Meeting History Log & Upcoming Schedule */}
          <div className="lg:col-span-2 space-y-5">
            {/* Control Header: Primary Tabs + Search + Filter & Sort */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[#091222]/85 border border-white/[0.08] backdrop-blur-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      activeTab === 'history'
                        ? 'bg-gradient-to-r from-[#0066FF] to-[#0052CC] text-white shadow-lg shadow-[#0066FF]/30 border border-[#388BFF]/40'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.06] border border-transparent'
                    }`}
                  >
                    <History className="h-4 w-4" />
                    <span>Meeting History ({recentMeetings.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('upcoming')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      activeTab === 'upcoming'
                        ? 'bg-gradient-to-r from-[#0066FF] to-[#0052CC] text-white shadow-lg shadow-[#0066FF]/30 border border-[#388BFF]/40'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.06] border border-transparent'
                    }`}
                  >
                    <CalendarDays className="h-4 w-4" />
                    <span>Upcoming Schedule ({scheduledMeetings.length})</span>
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search title or meeting ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-black/50 border border-white/[0.12] rounded-2xl pl-9 pr-4 py-2 text-xs text-gray-100 placeholder:text-gray-500 outline-none focus:border-[#0066FF] transition-colors w-full"
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
                        className="group relative overflow-hidden rounded-3xl border border-white/[0.09] bg-gradient-to-br from-[#0b1528]/95 via-[#091222]/95 to-[#070e1b]/95 hover:border-[#0066FF]/50 transition-all duration-200 p-5 sm:p-6 shadow-xl hover:shadow-[#0066FF]/10"
                      >
                        {/* Left Highlight Accent Bar */}
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                            item.isActive
                              ? 'bg-gradient-to-b from-emerald-400 via-teal-400 to-cyan-500'
                              : 'bg-gradient-to-b from-[#0066FF] via-indigo-500 to-[#FF7A00]'
                          }`}
                        />

                        <div className="flex flex-col gap-4 pl-2">
                          {/* Top Row: HIGHLIGHTED Meeting Title Banner + Status & Duration Pill */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2.5">
                              {/* Session Index Badge */}
                              <span className="h-7 px-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-[11px] font-mono font-bold text-gray-400 flex items-center justify-center">
                    #{filteredRecent.length - index}
                              </span>

                              {/* HIGHLIGHTED MEETING TITLE */}
                              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-[#0066FF]/25 via-indigo-500/20 to-[#FF7A00]/15 border border-[#388BFF]/50 shadow-[0_0_24px_rgba(0,102,255,0.22)]">
                                <Sparkles className="h-4 w-4 text-[#FFA033] shrink-0" />
                                <h4 className="text-sm sm:text-base font-black tracking-tight text-white">
                                  {renderHighlightedTitle(item.title)}
                                </h4>
                              </div>

                              {/* Live or Completed Status Badge */}
                              {item.isActive ? (
                                <Badge variant="success" dot>
                                  LIVE ROOM
                                </Badge>
                              ) : (
                                <Badge variant="default">
                                  <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-400" />
                                  Completed
                                </Badge>
                              )}

                              {/* Role Badge */}
                              <Badge variant={isUserHost ? 'blue' : 'outline'}>
                                {isUserHost ? 'Host' : 'Participant'}
                              </Badge>
                            </div>

                            {/* Prominent Duration Highlight Pill (KOTOKHON) */}
                            <div
                              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border text-xs font-extrabold shrink-0 self-start sm:self-auto ${
                                item.isActive
                                  ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                                  : 'bg-[#FF7A00]/15 border-[#FF7A00]/40 text-[#FFA033] shadow-sm shadow-[#FF7A00]/10'
                              }`}
                              title="Total meeting duration"
                            >
                              <Timer className="h-4 w-4 shrink-0" />
                              <span>
                                {item.isActive
                                  ? `Live • ${item.formattedDuration}`
                                  : `Duration: ${item.formattedDuration}`}
                              </span>
                            </div>
                          </div>

                          {/* Middle Row: Detailed When (KOKHON) & Telemetry Pills */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-black/40 border border-white/[0.06]">
                            {/* 1. Date & Relative Day (Kokhon - Date) */}
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-xl bg-[#0066FF]/15 text-[#388BFF] flex items-center justify-center shrink-0">
                                <Calendar className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                                  Meeting Date ({item.relativeDay})
                                </p>
                                <p className="text-xs font-bold text-gray-100 truncate">
                                  {item.formattedDate}
                                </p>
                              </div>
                            </div>

                            {/* 2. Start & End Time Window (Kokhon - Time) */}
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center shrink-0">
                                <Clock className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                                  Time Window
                                </p>
                                <p className="text-xs font-bold text-gray-100 truncate">
                                  {item.formattedTimeWindow}
                                </p>
                              </div>
                            </div>

                            {/* 3. Participants & Room Code */}
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                                <Users className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                                  Attendance & ID
                                </p>
                                <p className="text-xs font-bold text-gray-100 truncate">
                                  {item.participantCount || 1} participant
                                  {(item.participantCount || 1) !== 1 ? 's' : ''} •{' '}
                                  <span className="font-mono text-[#388BFF]">{item.id}</span>
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
            {/* 1. Personal Meeting Room (PMI) VIP Hub */}
            <Card className="bg-gradient-to-br from-[#0d1b38]/90 via-[#091222] to-[#060b16] border-[#0066FF]/35 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#0066FF]/15 rounded-full blur-2xl pointer-events-none" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-[#388BFF]" />
                    Personal Meeting Room
                  </CardTitle>
                  <Badge variant="indigo">Always Ready</Badge>
                </div>
                <CardDescription className="text-xs">
                  Your permanent instant bridge for daily standups and quick executive syncs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5">
                <div className="p-3.5 rounded-2xl bg-black/50 border border-white/[0.1] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                      Personal Room ID
                    </p>
                    <span className="text-xs font-mono font-bold text-[#388BFF] truncate block">
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
            <Card className="bg-[#091222]/90 border-white/[0.08]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#FFA033]" />
                    Duration & Call Analytics
                  </CardTitle>
                  <Badge variant="orange">Telemetry</Badge>
                </div>
                <CardDescription className="text-xs">
                  Breakdown of your meeting lengths and longest session highlight
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Longest Meeting Highlight Box */}
                {analytics.longestMeeting ? (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#FF7A00]/15 via-[#0066FF]/10 to-transparent border border-[#FF7A00]/30 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#FFA033]">
                      <span className="flex items-center gap-1">
                        <Award className="h-3.5 w-3.5" /> Longest Session Highlight
                      </span>
                      <span>{analytics.longestMeeting.formattedDuration}</span>
                    </div>
                    <p className="text-xs sm:text-sm font-black text-white truncate">
                      {analytics.longestMeeting.title}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {analytics.longestMeeting.formattedDate} at{' '}
                      {analytics.longestMeeting.formattedStartTime}
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs text-gray-400 text-center">
                    Host a meeting to unlock duration breakdown insights.
                  </div>
                )}

                {/* Weekly Activity Mini Bar Chart (Last 7 Days) */}
                <div className="pt-2 border-t border-white/[0.07] space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-gray-300">Last 7 Days Activity</span>
                    <span className="text-[10px] text-gray-500">Sessions / Day</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 items-end h-16 pt-2">
                    {analytics.last7Days.map((day, idx) => {
                      const heightPct =
                        day.count > 0
                          ? Math.max(22, Math.round((day.count / analytics.maxDailyCount) * 100))
                          : 10;
                      return (
                        <div key={idx} className="flex flex-col items-center gap-1 h-full justify-end">
                          <div className="w-full flex-1 flex items-end justify-center">
                            <div
                              title={`${day.label}: ${day.count} meeting${day.count !== 1 ? 's' : ''}`}
                              className={`w-full rounded-t-md transition-all duration-500 ${
                                day.count > 0
                                  ? 'bg-gradient-to-t from-[#0066FF] to-[#FF7A00]'
                                  : 'bg-white/[0.07]'
                              }`}
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-semibold text-gray-400">
                            {day.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Duration Distribution Bars */}
                <div className="space-y-2.5 pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400">Quick Syncs (&lt; 15 mins)</span>
                      <span className="font-bold text-gray-200">{analytics.shortCalls} calls</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#388BFF] transition-all duration-500"
                        style={{
                          width: `${
                            analytics.totalMeetings > 0
                              ? Math.max(8, Math.round((analytics.shortCalls / analytics.totalMeetings) * 100))
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400">Standard Sessions (15–45 mins)</span>
                      <span className="font-bold text-gray-200">{analytics.mediumCalls} calls</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                        style={{
                          width: `${
                            analytics.totalMeetings > 0
                              ? Math.max(8, Math.round((analytics.mediumCalls / analytics.totalMeetings) * 100))
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400">Deep Dives (45+ mins)</span>
                      <span className="font-bold text-gray-200">{analytics.longCalls} calls</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#FF7A00] transition-all duration-500"
                        style={{
                          width: `${
                            analytics.totalMeetings > 0
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

            {/* 3. Quick Meeting Agenda & Host Scratchpad */}
            <Card className="bg-[#091222]/90 border-white/[0.08]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-400" />
                    Host Agenda Scratchpad
                  </CardTitle>
                  <Badge variant="success">Auto-Saved</Badge>
                </div>
                <CardDescription className="text-xs">
                  Jot down key talking points or action items before starting your next meeting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  rows={4}
                  value={scratchpad}
                  onChange={(e) => handleScratchpadChange(e.target.value)}
                  placeholder="• Review sprint deliverables&#10;• Discuss Q4 architecture milestones&#10;• Action items & follow-ups..."
                  className="w-full rounded-2xl bg-black/50 border border-white/[0.1] p-3 text-xs text-gray-200 placeholder:text-gray-500 outline-none focus:border-[#0066FF] resize-none leading-relaxed"
                />
                <div className="flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 text-xs"
                    disabled={!scratchpad.trim()}
                    onClick={() => {
                      navigator.clipboard.writeText(scratchpad);
                      toast.success('Agenda notes copied to clipboard');
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy Notes
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-gray-400 hover:text-rose-400"
                    disabled={!scratchpad.trim()}
                    onClick={() => {
                      handleScratchpadChange('');
                      toast.info('Scratchpad cleared');
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 4. Studio System & Media Readiness */}
            <Card className="bg-[#091222]/90 border-white/[0.08]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#388BFF]" />
                    Studio Media Readiness
                  </CardTitle>
                  <Badge variant="success" dot>
                    Optimal
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-gray-400 flex items-center gap-2">
                    <Radio className="h-3.5 w-3.5 text-emerald-400" /> WebRTC & SFU Engine
                  </span>
                  <span className="font-bold text-emerald-400">Ready (Opus 48kHz)</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-gray-400 flex items-center gap-2">
                    <Camera className="h-3.5 w-3.5 text-[#388BFF]" /> Detected AV Inputs
                  </span>
                  <span className="font-bold text-gray-200">
                    {deviceCount.video} Cam • {deviceCount.audio} Mic
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-gray-400 flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-[#FFA033]" /> Connection Status
                  </span>
                  <span className="font-semibold text-emerald-400">Encrypted &amp; Ready</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Native Mobile App Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#060d1d]/92 backdrop-blur-2xl border-t border-white/10 shadow-[0_-10px_32px_rgba(0,0,0,0.6)] pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 items-end px-2 pt-2 pb-2.5 max-w-md mx-auto">
          <button
            onClick={() => {
              setActiveTab('history');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center gap-1 py-1 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'history' ? 'text-[#00A3FF]' : 'text-slate-400 active:text-white'
            }`}
          >
            <Home className="h-5 w-5" strokeWidth={activeTab === 'history' ? 2.3 : 1.8} />
            <span className="text-[10px] font-semibold">Home</span>
          </button>

          <button
            onClick={() => setIsJoinMeetingOpen(true)}
            className="flex flex-col items-center gap-1 py-1 rounded-xl text-slate-400 active:text-white transition-colors cursor-pointer"
          >
            <LogIn className="h-5 w-5" strokeWidth={1.8} />
            <span className="text-[10px] font-semibold">Join</span>
          </button>

          {/* Center Floating Native Action Button: New Meeting */}
          <div className="flex flex-col items-center -mt-6">
            <button
              onClick={() => setIsNewMeetingOpen(true)}
              className="h-13 w-13 rounded-2xl bg-gradient-to-br from-[#0066FF] via-[#0088FF] to-[#FF7A00] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(0,102,255,0.5)] border-2 border-[#060d1d] active:scale-95 transition-transform cursor-pointer"
              title="New Meeting"
            >
              <Plus className="h-6 w-6" strokeWidth={2.6} />
            </button>
            <span className="text-[10px] font-bold text-white mt-1">New</span>
          </div>

          <button
            onClick={() => setIsScheduleOpen(true)}
            className={`flex flex-col items-center gap-1 py-1 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'upcoming' ? 'text-[#00A3FF]' : 'text-slate-400 active:text-white'
            }`}
          >
            <Calendar className="h-5 w-5" strokeWidth={activeTab === 'upcoming' ? 2.3 : 1.8} />
            <span className="text-[10px] font-semibold">Schedule</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex flex-col items-center gap-1 py-1 rounded-xl text-slate-400 active:text-white transition-colors cursor-pointer"
          >
            <Settings className="h-5 w-5" strokeWidth={1.8} />
            <span className="text-[10px] font-semibold">Settings</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      <NewMeetingModal
        isOpen={isNewMeetingOpen}
        onClose={() => setIsNewMeetingOpen(false)}
        onMeetingCreated={fetchDashboardData}
      />
      <JoinMeetingModal
        isOpen={isJoinMeetingOpen}
        onClose={() => setIsJoinMeetingOpen(false)}
      />
      <ScheduleMeetingModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        onScheduled={fetchDashboardData}
      />
      {user && (
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
