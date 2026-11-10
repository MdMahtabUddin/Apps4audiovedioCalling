'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Video,
  Plus,
  LogIn,
  Calendar,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Users,
  ShieldCheck,
  Sparkles,
  Settings,
  ArrowRight,
  Search,
  Camera,
  Share2,
  CalendarDays,
  History,
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
import { formatDate } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [recentMeetings, setRecentMeetings] = useState<MeetingItem[]>([]);
  const [scheduledMeetings, setScheduledMeetings] = useState<ScheduledMeetingItem[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [inlineCode, setInlineCode] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isNewMeetingOpen, setIsNewMeetingOpen] = useState(false);
  const [isJoinMeetingOpen, setIsJoinMeetingOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  // Filtered upcoming meetings based on search
  const filteredScheduled = useMemo(() => {
    if (!searchQuery.trim()) return scheduledMeetings;
    const q = searchQuery.toLowerCase();
    return scheduledMeetings.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.meetingId && m.meetingId.toLowerCase().includes(q))
    );
  }, [scheduledMeetings, searchQuery]);

  // Filtered past meetings based on search
  const filteredRecent = useMemo(() => {
    if (!searchQuery.trim()) return recentMeetings;
    const q = searchQuery.toLowerCase();
    return recentMeetings.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q)
    );
  }, [recentMeetings, searchQuery]);

  // User's personal meeting ID (PMI) derived consistently from their ID
  const personalRoomId = useMemo(() => {
    if (!user?.id) return 'my-personal-room';
    const clean = user.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `${clean.substring(0, 3)}-${clean.substring(3, 7) || 'room'}-${clean.substring(7, 10) || 'hub'}`;
  }, [user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-xs text-gray-400 font-medium">Loading MeetFlow dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col">
      <Navbar
        user={user}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onQuickNewMeeting={() => setIsNewMeetingOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Header & Live Clock Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-gray-800/80 bg-gradient-to-r from-gray-900/90 via-[#11182c]/80 to-gray-900/90 p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-black/40">
          <div className="absolute top-0 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2">
                <Badge variant="success" dot>
                  Host Account Active
                </Badge>
                <span className="text-xs text-gray-400">• WebRTC HD Ready</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                Good day, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-300">{user?.name || 'there'}</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 max-w-xl">
                Ready to connect? Launch an instant video room, schedule your next team sprint, or test your audio/video devices before joining.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-4">
              <ClockWidget />
            </div>
          </div>
        </div>

        {/* 4 Action Cards Grid (Zoom + Google Meet hybrid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Action 1: New Meeting */}
          <button
            onClick={() => setIsNewMeetingOpen(true)}
            className="group text-left p-5 rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-600/10 to-gray-900 border border-orange-500/30 hover:border-orange-500/60 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/10 cursor-pointer relative overflow-hidden flex flex-col justify-between h-44"
          >
            <div className="h-12 w-12 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform">
              <Video className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-orange-300 transition-colors">
                New Meeting
              </h3>
              <p className="text-xs text-gray-400 mt-1">Start now or create link for later</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-orange-400 group-hover:translate-x-1 transition-transform">
              Launch room <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </button>

          {/* Action 2: Join Meeting */}
          <button
            onClick={() => setIsJoinMeetingOpen(true)}
            className="group text-left p-5 rounded-2xl bg-gradient-to-br from-blue-500/20 via-indigo-600/10 to-gray-900 border border-blue-500/30 hover:border-blue-500/60 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/10 cursor-pointer relative overflow-hidden flex flex-col justify-between h-44"
          >
            <div className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
              <LogIn className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">
                Join Meeting
              </h3>
              <p className="text-xs text-gray-400 mt-1">Via meeting code or room URL</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-blue-400 group-hover:translate-x-1 transition-transform">
              Enter room <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </button>

          {/* Action 3: Schedule */}
          <button
            onClick={() => setIsScheduleOpen(true)}
            className="group text-left p-5 rounded-2xl bg-gradient-to-br from-violet-500/20 via-purple-600/10 to-gray-900 border border-violet-500/30 hover:border-violet-500/60 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/10 cursor-pointer relative overflow-hidden flex flex-col justify-between h-44"
          >
            <div className="h-12 w-12 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors">
                Schedule
              </h3>
              <p className="text-xs text-gray-400 mt-1">Plan future conferences</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-violet-400 group-hover:translate-x-1 transition-transform">
              Add to calendar <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </button>

          {/* Action 4: Hardware & Devices */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="group text-left p-5 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-600/10 to-gray-900 border border-emerald-500/30 hover:border-emerald-500/60 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-500/10 cursor-pointer relative overflow-hidden flex flex-col justify-between h-44"
          >
            <div className="h-12 w-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
              <Camera className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                Camera & Mic Test
              </h3>
              <p className="text-xs text-gray-400 mt-1">Live audio meter & webcam check</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
              Test hardware <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </button>
        </div>

        {/* Quick Join Input Pill */}
        <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
              <LogIn className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white">Quick Meeting Entry</h4>
              <p className="text-[11px] text-gray-400">Type or paste any meeting code to jump straight in</p>
            </div>
          </div>

          <form onSubmit={handleInlineJoin} className="flex items-center gap-2 max-w-md w-full">
            <input
              type="text"
              placeholder="e.g. abc-defg-hij"
              value={inlineCode}
              onChange={(e) => setInlineCode(e.target.value)}
              className="flex-1 bg-gray-950/80 border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-gray-100 placeholder:text-gray-500 outline-none focus:border-indigo-500 transition-colors font-mono"
            />
            <Button size="sm" type="submit" disabled={!inlineCode.trim()}>
              Join Call
            </Button>
          </form>
        </div>

        {/* Main Content: Meetings Section & Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main 2 Cols: Tabs & List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Tab Controls & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('upcoming')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'upcoming'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                  }`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Upcoming ({scheduledMeetings.length})
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'history'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  Recent & History ({recentMeetings.length})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Filter meetings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-950/80 border border-gray-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder:text-gray-500 outline-none focus:border-indigo-500 transition-colors w-full sm:w-48"
                />
              </div>
            </div>

            {/* Upcoming Tab Content */}
            {activeTab === 'upcoming' && (
              <div className="space-y-3">
                {filteredScheduled.length === 0 ? (
                  <div className="p-10 rounded-2xl border border-dashed border-gray-800 bg-gray-900/30 text-center space-y-3">
                    <Calendar className="h-10 w-10 text-gray-600 mx-auto" />
                    <p className="text-sm font-semibold text-gray-300">
                      {searchQuery ? 'No meetings matched your search' : 'No scheduled meetings'}
                    </p>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      Schedule a conference in advance to set agendas, durations, passcodes, and waiting rooms.
                    </p>
                    <Button size="sm" variant="secondary" onClick={() => setIsScheduleOpen(true)}>
                      Schedule a Meeting
                    </Button>
                  </div>
                ) : (
                  filteredScheduled.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl border border-gray-800 bg-gray-900/50 hover:bg-gray-900/80 hover:border-gray-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{item.title}</h4>
                          {item.waitingRoom && (
                            <Badge variant="warning">Waiting Room</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1 text-indigo-300">
                            <Clock className="h-3.5 w-3.5 text-indigo-400" />
                            {new Date(item.date).toLocaleDateString()} at {item.startTime}
                          </span>
                          <span>•</span>
                          <span>{item.duration} mins</span>
                          <span>•</span>
                          <span className="font-mono text-gray-500">ID: {item.meetingId || item.id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.meetingId && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleCopyLink(item.meetingId!)}
                            title="Copy meeting link"
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

            {/* History Tab Content */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                {filteredRecent.length === 0 ? (
                  <div className="p-10 rounded-2xl border border-dashed border-gray-800 bg-gray-900/30 text-center space-y-3">
                    <History className="h-10 w-10 text-gray-600 mx-auto" />
                    <p className="text-sm font-semibold text-gray-300">
                      {searchQuery ? 'No meetings matched your search' : 'No past meetings recorded'}
                    </p>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      Calls you host or join will appear here with participant records and timestamps.
                    </p>
                  </div>
                ) : (
                  filteredRecent.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl border border-gray-800 bg-gray-900/50 hover:bg-gray-900/80 hover:border-gray-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{item.title}</h4>
                          <span className="text-xs text-gray-400 font-mono">({item.id})</span>
                          {item.isActive ? (
                            <Badge variant="success" dot>Active Room</Badge>
                          ) : (
                            <Badge variant="default">Completed</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                          <span>{formatDate(item.createdAt)}</span>
                          {item.participantCount !== undefined && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-gray-300">
                                <Users className="h-3 w-3 text-indigo-400" />
                                {item.participantCount} participant{item.participantCount !== 1 ? 's' : ''}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleCopyLink(item.id)}
                          title="Copy meeting link"
                        >
                          {copiedId === item.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/meeting/${item.id}`)}
                        >
                          Rejoin
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Right 1 Col: User Personal Room & Engine Overview */}
          <div className="space-y-6">
            {/* Personal Meeting Room (PMI) Card */}
            <Card className="bg-gradient-to-br from-indigo-950/40 via-gray-900 to-gray-950 border-indigo-500/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-indigo-400" />
                    Personal Meeting Room
                  </CardTitle>
                  <Badge variant="indigo">Permanent</Badge>
                </div>
                <CardDescription className="text-xs">
                  Your dedicated room for one-on-one syncs and standups
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-indigo-300 truncate">{personalRoomId}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
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

                <Button
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => router.push(`/meeting/${personalRoomId}`)}
                >
                  Start Personal Room Call
                </Button>
              </CardContent>
            </Card>

            {/* Profile Overview Card */}
            {user && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-sm">User Profile</CardTitle>
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'}
                      alt={user.name}
                      className="h-12 w-12 rounded-full border border-indigo-500/40 object-cover bg-gray-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{user.name}</h4>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      <Badge variant="success" dot className="mt-1">
                        Verified Host
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-800/80 space-y-2 text-xs">
                    <div className="flex justify-between text-gray-400">
                      <span>Total Meetings Hosted</span>
                      <span className="font-semibold text-gray-200">{recentMeetings.length}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Upcoming Calendar Syncs</span>
                      <span className="font-semibold text-gray-200">{scheduledMeetings.length}</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setIsSettingsOpen(true)}
                  >
                    Profile & Hardware Settings
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Platform Feature Status */}
            <Card className="bg-gradient-to-br from-gray-900/60 to-[#121829] border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-2 text-indigo-300">
                  <ShieldCheck className="h-4 w-4 text-indigo-400" />
                  WebRTC Infrastructure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-[11px] text-gray-400">
                <div className="flex items-center justify-between">
                  <span>Signaling Gateway</span>
                  <span className="text-emerald-400 font-semibold">Socket.IO Ready</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>NAT Traversal</span>
                  <span className="text-emerald-400 font-semibold">STUN Configured</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Media Streams</span>
                  <span className="text-emerald-400 font-semibold">Opus + VP8/H.264</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

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
