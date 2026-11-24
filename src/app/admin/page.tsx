'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Cloud,
  CloudOff,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  Radio,
  RefreshCw,
  Search,
  Server,
  Shield,
  SlidersHorizontal,
  StopCircle,
  Unlock,
  Users,
  Video,
  Wifi,
  Zap,
} from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { ThemeToggle } from '@/components/theme/theme-provider';
import { useToast } from '@/components/ui/toast';
import type { RtcRoutingMode, SystemConfig } from '@/lib/admin/system-config';
import type { MediaProviderType, ProviderUsageSummary } from '@/lib/admin/usage-tracker';

interface AdminMeetingRow {
  id: string;
  title: string;
  hostName: string;
  hostEmail: string;
  isActive: boolean;
  isLocked: boolean;
  waitingRoom: boolean;
  participantCount: number;
  startTime: string;
  endTime: string | null;
  createdAt: string;
  provider?: MediaProviderType;
  durationSeconds?: number;
  participantMinutes?: number;
}

interface AdminOverviewData {
  admin: { name: string; email: string };
  config: SystemConfig;
  usage?: ProviderUsageSummary;
  infrastructure: {
    databaseMode: string;
    livekitConfigured: boolean;
    livekitUrl: string;
    agoraConfigured: boolean;
    dailyConfigured: boolean;
    webrtcMeshAvailable: boolean;
    environment: string;
  };
  stats: {
    totalUsers: number;
    totalMeetings: number;
    activeMeetingsCount: number;
    scheduledMeetingsCount: number;
    totalParticipants: number;
  };
  activeMeetings: AdminMeetingRow[];
  recentMeetings: AdminMeetingRow[];
  users: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
    hostedCount: number;
  }>;
}

export default function AdminPanelPage() {
  const router = useRouter();
  const toast = useToast();

  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAdminLogin, setNeedsAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [roomActionLoading, setRoomActionLoading] = useState<string | null>(null);
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [activeDirectoryTab, setActiveDirectoryTab] = useState<'meetings' | 'users'>('meetings');
  const [providerFilter, setProviderFilter] = useState<'all' | 'livekit' | 'agora' | 'webrtc'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const formatSecs = (secs?: number) => {
    const s = Math.max(0, Math.round(secs || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${r}s`;
    return `${r}s`;
  };

  const fetchOverview = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const res = await fetch('/api/admin/overview', { cache: 'no-store' });
        if (res.status === 401 || res.status === 403) {
          setNeedsAdminLogin(true);
          setData(null);
          return;
        }
        if (!res.ok) throw new Error('Failed to load admin overview');
        const json: AdminOverviewData = await res.json();
        setNeedsAdminLogin(false);
        setData(json);
        setAnnouncementDraft(json.config.globalAnnouncement || '');
      } catch (err) {
        console.error(err);
        toast.error('Could not load admin telemetry');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast]
  );

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLoginError(json.error || 'Invalid admin credentials');
        return;
      }
      toast.success('Admin Panel unlocked!');
      setAdminPassword('');
      await fetchOverview(false);
    } catch {
      setLoginError('Unable to sign in right now');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleAdminLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    setData(null);
    setNeedsAdminLogin(true);
    toast.info('Admin Panel locked');
  };

  useEffect(() => {
    void fetchOverview(false);
  }, [fetchOverview]);

  const updateConfig = async (patch: Partial<SystemConfig>, keyLabel: string, successMsg: string) => {
    setSavingKey(keyLabel);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Update failed');
      const json = await res.json();
      setData((prev) => (prev ? { ...prev, config: json.config } : prev));
      toast.success(successMsg);
    } catch {
      toast.error('Failed to update system configuration');
    } finally {
      setSavingKey(null);
    }
  };

  const handleRoomAction = async (roomId: string, action: 'end' | 'toggle-lock') => {
    setRoomActionLoading(`${roomId}:${action}`);
    try {
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(roomId)}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('Action failed');
      toast.success(action === 'end' ? 'Meeting ended by Admin' : 'Room lock status updated');
      await fetchOverview(true);
    } catch {
      toast.error('Failed to execute room action');
    } finally {
      setRoomActionLoading(null);
    }
  };

  const effectiveRoutePreview = useMemo(() => {
    if (!data) return 'LiveKit Cloud';
    const { config, infrastructure } = data;
    if (config.routingMode === 'webrtc') return 'WebRTC P2P Mesh (Forced)';
    if (config.routingMode === 'agora') {
      return config.agoraEnabled && infrastructure.agoraConfigured
        ? 'Agora Backup Cloud (Forced)'
        : 'WebRTC Mesh (AGORA_APP_ID not set or Agora OFF)';
    }
    if (config.routingMode === 'daily') {
      return config.backupEnabled && infrastructure.dailyConfigured
        ? 'Daily.co Cloud (Forced)'
        : 'WebRTC Mesh (Daily key not set or OFF)';
    }
    if (config.routingMode === 'livekit') {
      return config.primaryEnabled && infrastructure.livekitConfigured
        ? 'LiveKit Cloud Primary (Forced)'
        : 'WebRTC Mesh (Primary OFF)';
    }
    // Auto Failover
    if (config.primaryEnabled && infrastructure.livekitConfigured) {
      if (config.agoraEnabled && infrastructure.agoraConfigured) {
        return 'LiveKit Primary → Auto-Failover to Agora Backup';
      }
      if (config.backupEnabled && infrastructure.dailyConfigured) {
        return 'LiveKit Primary → Auto-Failover to Daily Backup';
      }
      return 'LiveKit Primary → Auto-Fallback to WebRTC Mesh';
    }
    if (config.agoraEnabled && infrastructure.agoraConfigured) {
      return 'Agora Backup Cloud (Primary is OFF)';
    }
    if (config.backupEnabled && infrastructure.dailyConfigured) {
      return 'Daily.co Backup Cloud (Primary is OFF)';
    }
    return 'WebRTC P2P Mesh (All Cloud Providers OFF)';
  }, [data]);

  const filteredMeetings = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    return data.recentMeetings.filter((m) => {
      if (providerFilter !== 'all' && (m.provider || 'livekit') !== providerFilter) return false;
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.hostName.toLowerCase().includes(q)
      );
    });
  }, [data, searchQuery, providerFilter]);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return data.users;
    return data.users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ['Meeting ID', 'Title', 'Host', 'Provider', 'Status', 'Participants', 'Duration', 'Participant-Mins Used', 'Created At'],
      ...data.recentMeetings.map((m) => [
        m.id,
        `"${(m.title || '').replace(/"/g, '""')}"`,
        `"${(m.hostName || '').replace(/"/g, '""')}"`,
        (m.provider || 'livekit').toUpperCase(),
        m.isActive ? 'Live' : 'Completed',
        String(m.participantCount),
        formatSecs(m.durationSeconds),
        String(m.participantMinutes ?? 0),
        new Date(m.createdAt).toLocaleString(),
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MetroMeet-Admin-Report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Admin report exported as CSV');
  };

  if (needsAdminLogin) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-200">
        <div className="absolute inset-0 bg-dot-matrix [mask-image:radial-gradient(ellipse_65%_65%_at_50%_30%,#000_35%,transparent_100%)] pointer-events-none" />
        <div className="absolute top-4 right-4 z-20">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-[400px] space-y-6 relative z-10 animate-fade-up">
          <div className="flex flex-col items-center text-center space-y-2.5">
            <BrandLogo size="md" showTagline={true} href="/dashboard" />
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-600/15 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400 text-[11px] font-semibold">
              <Shield className="h-3.5 w-3.5" />
              Restricted Admin Console
            </span>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] shadow-xl shadow-slate-900/[0.06] dark:shadow-black/60 overflow-hidden">
            <form onSubmit={handleAdminLogin} className="p-6 space-y-4">
              <div>
                <h1 className="text-lg font-semibold text-slate-950 dark:text-white">Admin Sign In</h1>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Authenticate to manage infrastructure, rooms, and platform policies
                </p>
              </div>

              {loginError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-xs text-rose-600 dark:text-rose-300 font-medium">
                  {loginError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-zinc-300 block">
                  Admin Username
                </label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Enter admin username"
                  required
                  autoComplete="username"
                  className="w-full h-10 rounded-lg bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-white/[0.1] px-3.5 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-zinc-300 block">
                  Admin Password
                </label>
                <div className="relative">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full h-10 rounded-lg bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-white/[0.1] px-3.5 pr-10 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  >
                    {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white text-sm font-semibold shadow-sm shadow-blue-600/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                {loggingIn ? 'Verifying...' : 'Unlock Admin Console'}
              </button>

              <Link
                href="/dashboard"
                className="block text-center text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white pt-1 transition-colors"
              >
                ← Back to Dashboard
              </Link>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#09090b] text-slate-900 dark:text-white flex items-center justify-center transition-colors">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600/10 border border-blue-500/25 flex items-center justify-center">
            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-pulse" />
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            Loading Admin Console...
          </p>
        </div>
      </div>
    );
  }

  const { config, infrastructure, stats } = data;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 relative overflow-x-hidden transition-colors duration-200">
      {/* Top Executive Admin Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-white/[0.08] bg-white/85 dark:bg-[#09090b]/85 backdrop-blur-xl transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              className="h-9 w-9 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white transition-colors shrink-0"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="hidden sm:block">
              <BrandLogo size="sm" showTagline={false} href="/dashboard" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-600/15 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400 text-[11px] font-semibold">
              <Shield className="h-3.5 w-3.5" />
              <span>Admin Console</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            <button
              onClick={() => void fetchOverview(true)}
              disabled={refreshing}
              className="h-9 px-3 rounded-lg bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-white/[0.1] text-xs font-medium text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-blue-600 dark:text-blue-400 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={exportCsv}
              className="h-9 px-3 rounded-lg bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-white/[0.1] text-xs font-medium text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={handleAdminLogout}
              className="h-9 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 border border-rose-200 dark:border-rose-500/30 text-xs font-semibold text-rose-600 dark:text-rose-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Lock & Sign Out Admin Panel"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 relative z-10">
        {/* 1. Platform KPI Overview Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 animate-fade-up">
          <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-2 glass-panel-hover">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-medium">
              <span>Total Users</span>
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-semibold text-slate-950 dark:text-white tabular-nums">{stats.totalUsers}</div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-500">Registered accounts</p>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#111114] border border-emerald-200 dark:border-emerald-500/25 shadow-xs dark:shadow-none space-y-2 glass-panel-hover">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-medium">
              <span>Live Active Rooms</span>
              <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
            </div>
            <div className="text-2xl sm:text-3xl font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {stats.activeMeetingsCount}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-500">Running right now</p>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-2 glass-panel-hover">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-medium">
              <span>Total Meetings</span>
              <Video className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-semibold text-slate-950 dark:text-white tabular-nums">{stats.totalMeetings}</div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-500">{stats.totalParticipants} total joins</p>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-2 glass-panel-hover">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-medium">
              <span>Environment</span>
              <Database className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="text-sm sm:text-base font-semibold text-slate-950 dark:text-white truncate pt-1">
              {infrastructure.databaseMode}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-500 truncate">{infrastructure.environment}</p>
          </div>
        </div>

        {/* 2. MULTI-PROVIDER INFRASTRUCTURE CONTROL CENTER */}
        <section className="rounded-2xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] shadow-sm dark:shadow-none overflow-hidden animate-fade-up-1">
          <div className="p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-slate-950 dark:text-white tracking-tight">
                    Voice &amp; Vedio Infrastructure Control
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Turn Primary (LiveKit) &amp; Backup (Agora) ON or OFF live without redeploying
                  </p>
                </div>
              </div>

              {/* Active Route Status Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/12 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 self-start sm:self-auto">
                <Zap className="h-3.5 w-3.5 shrink-0" />
                <span>Active Route: {effectiveRoutePreview}</span>
              </div>
            </div>

            {/* Primary & Backup Provider Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* PRIMARY: LiveKit Cloud */}
              <div
                className={`p-5 rounded-xl border transition-all space-y-4 ${
                  config.primaryEnabled
                    ? 'bg-blue-50/60 dark:bg-blue-600/[0.08] border-blue-200 dark:border-blue-500/35'
                    : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 opacity-80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center border ${
                        config.primaryEnabled
                          ? 'bg-blue-100 dark:bg-blue-600/20 border-blue-200 dark:border-blue-500/35 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400'
                      }`}
                    >
                      {config.primaryEnabled ? <Cloud className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Primary — LiveKit</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            config.primaryEnabled
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                              : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {config.primaryEnabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                        Unlimited · No Minute Cap · HD SFU Engine
                      </p>
                    </div>
                  </div>

                  {/* Primary ON/OFF Switch */}
                  <button
                    disabled={savingKey === 'primary'}
                    onClick={() =>
                      void updateConfig(
                        { primaryEnabled: !config.primaryEnabled },
                        'primary',
                        !config.primaryEnabled
                          ? 'Primary LiveKit turned ON'
                          : 'Primary LiveKit turned OFF — traffic routed to Backup'
                      )
                    }
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      config.primaryEnabled
                        ? 'bg-blue-600'
                        : 'bg-slate-300 dark:bg-zinc-700'
                    }`}
                    title="Toggle Primary LiveKit"
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        config.primaryEnabled ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* LiveKit Monthly Usage (Unlimited / Open) */}
                {(() => {
                  const q = data.usage?.quotas.livekit;
                  const used = q?.usedMinutes ?? 0;
                  return (
                    <div className="p-3 rounded-lg bg-white dark:bg-[#09090b] border border-slate-200/80 dark:border-white/[0.07] space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 dark:text-zinc-300 font-semibold">
                          Used: <span className="text-blue-600 dark:text-blue-400 font-mono">{used} min</span>
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                          ∞ Unlimited (Open)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#0066FF] to-[#00D2FF] transition-all duration-500"
                          style={{ width: used > 0 ? '100%' : '0%', opacity: used > 0 ? 0.65 : 0 }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{q?.meetingsCount ?? 0} meetings this month ({data.usage?.monthKey || 'Current'})</span>
                        <span className="font-mono font-bold text-emerald-400">No Limit</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/[0.08]">
                  <span className="text-slate-400 font-mono truncate max-w-[220px]">
                    {infrastructure.livekitUrl}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 font-bold shrink-0 ${
                      infrastructure.livekitConfigured ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {infrastructure.livekitConfigured ? 'Keys Connected' : 'Keys Missing'}
                  </span>
                </div>
              </div>

              {/* BACKUP: Agora Cloud */}
              <div
                className={`p-5 rounded-xl border transition-all space-y-4 ${
                  config.agoraEnabled
                    ? 'bg-amber-50/60 dark:bg-orange-500/[0.07] border-amber-200 dark:border-orange-500/30'
                    : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 opacity-80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center border ${
                        config.agoraEnabled
                          ? 'bg-amber-100 dark:bg-orange-500/20 border-amber-200 dark:border-orange-500/35 text-amber-600 dark:text-orange-400'
                          : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400'
                      }`}
                    >
                      {config.agoraEnabled ? <Cloud className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Backup — Agora Cloud</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            config.agoraEnabled
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                              : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {config.agoraEnabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                        Unlimited · No Minute Cap · Native MetroMeet UI
                      </p>
                    </div>
                  </div>

                  {/* Agora Backup ON/OFF Switch */}
                  <button
                    disabled={savingKey === 'agora'}
                    onClick={() =>
                      void updateConfig(
                        { agoraEnabled: !config.agoraEnabled },
                        'agora',
                        !config.agoraEnabled
                          ? 'Backup Agora Cloud turned ON'
                          : 'Backup Agora Cloud turned OFF'
                      )
                    }
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      config.agoraEnabled
                        ? 'bg-amber-500'
                        : 'bg-slate-300 dark:bg-zinc-700'
                    }`}
                    title="Toggle Backup Agora Cloud"
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        config.agoraEnabled ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Agora Monthly Usage (Unlimited / Open) */}
                {(() => {
                  const q = data.usage?.quotas.agora;
                  const used = q?.usedMinutes ?? 0;
                  return (
                    <div className="p-3 rounded-lg bg-white dark:bg-[#09090b] border border-slate-200/80 dark:border-white/[0.07] space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 dark:text-zinc-300 font-semibold">
                          Used: <span className="text-amber-600 dark:text-orange-400 font-mono">{used} min</span>
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                          ∞ Unlimited (Open)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#FF7A00] to-[#FFB347] transition-all duration-500"
                          style={{ width: used > 0 ? '100%' : '0%', opacity: used > 0 ? 0.65 : 0 }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{q?.meetingsCount ?? 0} meetings this month ({data.usage?.monthKey || 'Current'})</span>
                        <span className="font-mono font-bold text-emerald-400">No Limit</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/[0.08]">
                  <span className="text-slate-400">
                    Env: <code className="text-slate-200 font-mono">AGORA_APP_ID</code>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 font-bold shrink-0 ${
                      infrastructure.agoraConfigured ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {infrastructure.agoraConfigured ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Keys Connected
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Add App ID in Vercel
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Traffic Routing Mode Selector */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                Traffic Routing Strategy
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {(
                  [
                    {
                      id: 'auto',
                      label: 'Auto Failover',
                      desc: 'LiveKit → Agora → Mesh',
                    },
                    {
                      id: 'livekit',
                      label: 'Force Primary',
                      desc: 'LiveKit Server only',
                    },
                    {
                      id: 'agora',
                      label: 'Force Backup (Agora)',
                      desc: 'Agora Cloud directly',
                    },
                    {
                      id: 'webrtc',
                      label: 'WebRTC Mesh',
                      desc: 'Direct P2P fallback',
                    },
                  ] as Array<{ id: RtcRoutingMode; label: string; desc: string }>
                ).map((mode) => {
                  const active = config.routingMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      disabled={savingKey === 'routing'}
                      onClick={() =>
                        void updateConfig(
                          { routingMode: mode.id },
                          'routing',
                          `Routing strategy changed to ${mode.label}`
                        )
                      }
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-blue-50 dark:bg-blue-600/20 border-blue-500 text-blue-950 dark:text-white'
                          : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 text-slate-800 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.07]'
                      }`}
                    >
                      <div className="text-xs font-semibold">{mode.label}</div>
                      <div className="text-[10.5px] text-slate-500 dark:text-zinc-400 mt-0.5">{mode.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 3. Platform Policy & Security Controls + Live Active Rooms */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Security & Policy Settings */}
          <div className="rounded-2xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] shadow-xs dark:shadow-none p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <Shield className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Security &amp; Room Policies</h3>
            </div>

            <div className="space-y-3">
              {/* Allow Guest Join */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06]">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">Allow Guest Join</p>
                  <p className="text-[10.5px] text-slate-500 dark:text-zinc-400">Let users join without login</p>
                </div>
                <button
                  onClick={() =>
                    void updateConfig(
                      { allowGuestJoin: !config.allowGuestJoin },
                      'guest',
                      `Guest Join ${!config.allowGuestJoin ? 'Enabled' : 'Disabled'}`
                    )
                  }
                  className={`w-10 h-6 rounded-full relative transition-all cursor-pointer shrink-0 ${
                    config.allowGuestJoin ? 'bg-[#0066FF]' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                      config.allowGuestJoin ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Default Waiting Room */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06]">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">Default Waiting Room</p>
                  <p className="text-[10.5px] text-slate-500 dark:text-zinc-400">Require host approval by default</p>
                </div>
                <button
                  onClick={() =>
                    void updateConfig(
                      { defaultWaitingRoom: !config.defaultWaitingRoom },
                      'waiting',
                      `Default Waiting Room ${!config.defaultWaitingRoom ? 'Enabled' : 'Disabled'}`
                    )
                  }
                  className={`w-10 h-6 rounded-full relative transition-all cursor-pointer shrink-0 ${
                    config.defaultWaitingRoom ? 'bg-blue-600' : 'bg-slate-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                      config.defaultWaitingRoom ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Maintenance Mode (Executive Toggle with Live Status) */}
              <div
                className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                  config.maintenanceMode
                    ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40'
                    : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200/70 dark:border-white/[0.06]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">Maintenance Mode</p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          config.maintenanceMode
                            ? 'bg-amber-500 text-slate-950 animate-pulse'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {config.maintenanceMode ? 'ACTIVE' : 'ONLINE'}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">
                      {config.maintenanceMode
                        ? 'Users see the full-screen Maintenance Notice (Admin stays unlocked)'
                        : 'Platform is live & open for all users'}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      void updateConfig(
                        { maintenanceMode: !config.maintenanceMode },
                        'maintenance',
                        `Maintenance Mode ${!config.maintenanceMode ? 'Activated' : 'Deactivated'}`
                      )
                    }
                    className={`w-11 h-6 rounded-full relative transition-all cursor-pointer shrink-0 ${
                      config.maintenanceMode ? 'bg-amber-500 shadow-md shadow-amber-500/40' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        config.maintenanceMode ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Max Participants Per Room */}
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Max Room Capacity</span>
                  <span className="font-mono font-bold text-cyan-400">
                    {config.maxParticipantsPerRoom} users
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[10, 25, 50, 100].map((cap) => (
                    <button
                      key={cap}
                      onClick={() =>
                        void updateConfig(
                          { maxParticipantsPerRoom: cap },
                          'capacity',
                          `Max room capacity set to ${cap}`
                        )
                      }
                      className={`py-1.5 rounded-lg text-[11px] font-bold font-mono cursor-pointer transition-all ${
                        config.maxParticipantsPerRoom === cap
                          ? 'bg-[#0066FF] text-white'
                          : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.12]'
                      }`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>

              {/* Global System Announcement with Quick Presets & Live Banner Preview */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void updateConfig(
                    { globalAnnouncement: announcementDraft.trim() },
                    'announcement',
                    announcementDraft.trim()
                      ? 'Global system notice published!'
                      : 'Global system notice cleared'
                  );
                }}
                className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-white">
                    Global System Notice
                  </label>
                  <span className="text-[10px] font-semibold text-cyan-300">
                    {config.globalAnnouncement ? 'Live on Site' : 'Hidden'}
                  </span>
                </div>

                {/* Quick 1-Tap Preset Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Upgrade', text: 'Scheduled server upgrade tonight at 11:00 PM (10 mins).' },
                    { label: 'HD Active', text: 'MetroMeet PRO HD Voice & Vedio Boost is now live!' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setAnnouncementDraft(preset.text)}
                      className="px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[10px] font-semibold text-slate-300 cursor-pointer"
                    >
                      + {preset.label}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={announcementDraft}
                  onChange={(e) => setAnnouncementDraft(e.target.value)}
                  placeholder="Write a live banner notice for all users..."
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#00A3FF]"
                />

                {/* Live Preview of how users will see the notice */}
                {announcementDraft.trim() && (
                  <div className="rounded-xl bg-gradient-to-r from-[#071631] via-[#0c1f44] to-[#1a1328] border border-[#00A3FF]/30 px-2.5 py-2 flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#FF7A00] to-[#FF4D2E] text-white text-[8.5px] font-black uppercase shrink-0">
                      Notice
                    </span>
                    <span className="text-[10.5px] text-white/95 font-medium truncate">
                      {announcementDraft.trim()}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={savingKey === 'announcement'}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00A3FF] text-white text-xs font-bold cursor-pointer hover:opacity-95"
                  >
                    Publish Notice
                  </button>
                  {(config.globalAnnouncement || announcementDraft) && (
                    <button
                      type="button"
                      disabled={savingKey === 'announcement'}
                      onClick={() => {
                        setAnnouncementDraft('');
                        void updateConfig(
                          { globalAnnouncement: '' },
                          'announcement',
                          'Global system notice cleared'
                        );
                      }}
                      className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Right 2 Columns: Live Active Rooms Monitor */}
          <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] shadow-xs dark:shadow-none p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Activity className="h-4.5 w-4.5 text-emerald-500" />
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                  Live Active Rooms ({data.activeMeetings.length})
                </h3>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                Real-time Monitor
              </span>
            </div>

            {data.activeMeetings.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-xl bg-slate-50/50 dark:bg-[#09090b]/50">
                <Radio className="h-7 w-7 text-slate-400 dark:text-zinc-600 mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">No active meetings right now</p>
                <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
                  Live rooms will appear here automatically with Force End &amp; Lock controls.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto max-h-[420px] pr-1">
                {data.activeMeetings.map((room) => (
                  <div
                    key={room.id}
                    className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        <h4 className="text-sm font-extrabold text-white truncate">
                          {room.title}
                        </h4>
                        <span className="px-2 py-0.5 rounded-md bg-white/[0.07] font-mono text-[10px] text-cyan-300">
                          {room.id}
                        </span>
                        {room.isLocked && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                            <Lock className="h-2.5 w-2.5" /> Locked
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Host: <strong className="text-slate-200">{room.hostName}</strong> ·{' '}
                        {room.participantCount} participant{room.participantCount === 1 ? '' : 's'} ·
                        Started {new Date(room.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/meeting/${room.id}`}
                        className="px-3 py-1.5 rounded-xl bg-[#0066FF]/20 hover:bg-[#0066FF]/35 border border-[#0066FF]/40 text-[#60A5FA] text-xs font-bold flex items-center gap-1"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Join
                      </Link>
                      <button
                        disabled={roomActionLoading === `${room.id}:toggle-lock`}
                        onClick={() => void handleRoomAction(room.id, 'toggle-lock')}
                        className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {room.isLocked ? <Unlock className="h-3.5 w-3.5 text-emerald-400" /> : <Lock className="h-3.5 w-3.5 text-amber-400" />}
                        {room.isLocked ? 'Unlock' : 'Lock'}
                      </button>
                      <button
                        disabled={roomActionLoading === `${room.id}:end`}
                        onClick={() => void handleRoomAction(room.id, 'end')}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <StopCircle className="h-3.5 w-3.5" />
                        End
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. Recent Meetings Log & Registered Users Directory */}
        <section className="rounded-2xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] shadow-xs dark:shadow-none p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveDirectoryTab('meetings')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeDirectoryTab === 'meetings'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Recent Meetings ({data.recentMeetings.length})
              </button>
              <button
                onClick={() => setActiveDirectoryTab('users')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeDirectoryTab === 'users'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Users Directory ({data.users.length})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeDirectoryTab === 'meetings' ? 'Search rooms...' : 'Search users...'}
                className="w-full rounded-lg bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-white/10 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {activeDirectoryTab === 'meetings' ? (
            <div className="space-y-3">
              {/* Provider Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: 'All Providers' },
                    { id: 'livekit', label: 'LiveKit' },
                    { id: 'agora', label: 'Agora' },
                    { id: 'webrtc', label: 'WebRTC Mesh' },
                  ] as const
                ).map((chip) => (
                  <button
                    key={chip.id}
                    onClick={() => setProviderFilter(chip.id)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer border ${
                      providerFilter === chip.id
                        ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/40'
                        : 'bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-white/10 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 pr-4">Meeting</th>
                      <th className="py-2.5 pr-4">Host</th>
                      <th className="py-2.5 pr-4">Provider</th>
                      <th className="py-2.5 pr-4">Duration</th>
                      <th className="py-2.5 pr-4">Mins Used</th>
                      <th className="py-2.5 pr-4">Status</th>
                      <th className="py-2.5">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {filteredMeetings.map((m) => {
                      const prov = m.provider || 'livekit';
                      const provBadge =
                        prov === 'agora'
                          ? 'bg-amber-50 dark:bg-orange-500/20 text-amber-700 dark:text-orange-300 border-amber-200 dark:border-orange-500/35'
                          : prov === 'webrtc'
                          ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/35';
                      const provLabel =
                        prov === 'agora'
                          ? 'Agora'
                          : prov === 'webrtc'
                          ? 'WebRTC'
                          : prov === 'daily'
                          ? 'Daily'
                          : 'LiveKit';
                      return (
                        <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                          <td className="py-3 pr-4">
                            <div className="font-semibold text-slate-900 dark:text-white max-w-[220px] truncate">{m.title}</div>
                            <div className="font-mono text-[10px] text-slate-500 dark:text-zinc-500">{m.id}</div>
                          </td>
                          <td className="py-3 pr-4 text-slate-700 dark:text-zinc-300">{m.hostName}</td>
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${provBadge}`}
                            >
                              {provLabel}
                            </span>
                          </td>
                          <td className="py-3 pr-4 font-mono text-slate-700 dark:text-zinc-200 whitespace-nowrap">
                            {formatSecs(m.durationSeconds)}
                          </td>
                          <td className="py-3 pr-4 font-mono font-semibold text-blue-600 dark:text-sky-400 whitespace-nowrap">
                            {(m.participantMinutes ?? 0).toFixed(1)} min
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                m.isActive
                                  ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                              }`}
                            >
                              {m.isActive ? 'Live' : 'Ended'}
                            </span>
                          </td>
                          <td className="py-3 text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                            {new Date(m.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 pr-4">Name</th>
                    <th className="py-2.5 pr-4">Email</th>
                    <th className="py-2.5 pr-4">Hosted Calls</th>
                    <th className="py-2.5">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                      <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-white">{u.name}</td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-zinc-300 font-mono">{u.email}</td>
                      <td className="py-3 pr-4 font-mono text-amber-600 dark:text-amber-400 font-semibold">
                        {u.hostedCount}
                      </td>
                      <td className="py-3 text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
