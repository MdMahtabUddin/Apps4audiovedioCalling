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
import { useToast } from '@/components/ui/toast';
import type { RtcRoutingMode, SystemConfig } from '@/lib/admin/system-config';

interface AdminOverviewData {
  admin: { name: string; email: string };
  config: SystemConfig;
  infrastructure: {
    databaseMode: string;
    livekitConfigured: boolean;
    livekitUrl: string;
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
  activeMeetings: Array<{
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
  }>;
  recentMeetings: Array<{
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
  }>;
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
  const [searchQuery, setSearchQuery] = useState('');

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
    if (config.routingMode === 'daily') {
      return config.backupEnabled && infrastructure.dailyConfigured
        ? 'Daily.co Backup Cloud (Forced)'
        : 'WebRTC Mesh (Daily key not set or Backup OFF)';
    }
    if (config.routingMode === 'livekit') {
      return config.primaryEnabled && infrastructure.livekitConfigured
        ? 'LiveKit Cloud Primary (Forced)'
        : 'WebRTC Mesh (Primary OFF)';
    }
    // Auto Failover
    if (config.primaryEnabled && infrastructure.livekitConfigured) {
      return config.backupEnabled && infrastructure.dailyConfigured
        ? 'LiveKit Primary → Auto-Failover to Daily.co Backup'
        : 'LiveKit Primary → Auto-Fallback to WebRTC Mesh';
    }
    if (config.backupEnabled && infrastructure.dailyConfigured) {
      return 'Daily.co Backup Cloud (Primary is OFF)';
    }
    return 'WebRTC P2P Mesh (Both Cloud Providers OFF)';
  }, [data]);

  const filteredMeetings = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return data.recentMeetings;
    return data.recentMeetings.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.hostName.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

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
      ['Meeting ID', 'Title', 'Host', 'Status', 'Participants', 'Created At'],
      ...data.recentMeetings.map((m) => [
        m.id,
        `"${(m.title || '').replace(/"/g, '""')}"`,
        `"${(m.hostName || '').replace(/"/g, '""')}"`,
        m.isActive ? 'Live' : 'Completed',
        String(m.participantCount),
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
      <div className="min-h-screen bg-[#050a14] text-white flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-[#0066FF]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[360px] h-[240px] bg-[#FF7A00]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md space-y-6 relative z-10">
          <div className="flex flex-col items-center text-center space-y-2.5">
            <BrandLogo size="lg" showTagline={true} href="/dashboard" />
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0066FF]/15 border border-[#0066FF]/35 text-[#60A5FA] text-[11px] font-extrabold uppercase tracking-wider">
              <Shield className="h-3.5 w-3.5" />
              Restricted Admin Portal
            </span>
          </div>

          <div className="rounded-3xl bg-[#091224]/92 border border-white/12 shadow-2xl backdrop-blur-2xl overflow-hidden">
            <div className="h-[3px] w-full bg-gradient-to-r from-[#0066FF] via-[#00A3FF] to-[#FF7A00]" />
            <form onSubmit={handleAdminLogin} className="p-6 space-y-4">
              <div>
                <h1 className="text-lg font-extrabold text-white">Admin Sign In</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter your administrator credentials to manage Primary &amp; Backup servers
                </p>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 font-semibold">
                  {loginError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Admin Username
                </label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Enter admin username"
                  required
                  autoComplete="username"
                  className="w-full rounded-xl bg-black/45 border border-white/12 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-[#00A3FF]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
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
                    className="w-full rounded-xl bg-black/45 border border-white/12 px-3.5 py-2.5 pr-10 text-sm text-white placeholder:text-slate-500 outline-none focus:border-[#00A3FF]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00A3FF] hover:opacity-95 text-white text-sm font-extrabold shadow-lg shadow-[#0066FF]/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {loggingIn ? 'Verifying...' : 'Unlock Admin Panel'}
              </button>

              <Link
                href="/dashboard"
                className="block text-center text-xs text-slate-400 hover:text-white pt-1"
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
      <div className="min-h-screen bg-[#050a14] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-[#0066FF]/20 border border-[#0066FF]/40 flex items-center justify-center">
            <Shield className="h-5 w-5 text-[#00A3FF] animate-pulse" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Loading Admin Control Center...
          </p>
        </div>
      </div>
    );
  }

  const { config, infrastructure, stats } = data;

  return (
    <div className="min-h-screen bg-[#050a14] text-slate-100 relative overflow-x-hidden">
      {/* Subtle Brand Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[520px] h-[320px] bg-[#0066FF]/12 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[440px] h-[280px] bg-[#FF7A00]/8 rounded-full blur-[120px]" />
      </div>

      {/* Top Executive Admin Navbar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#060d1c]/88 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              className="h-9 w-9 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="hidden sm:block">
              <BrandLogo size="sm" showTagline={false} href="/dashboard" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0066FF]/15 border border-[#0066FF]/35 text-[#60A5FA] text-[11px] font-extrabold tracking-wide">
              <Shield className="h-3.5 w-3.5" />
              <span>Admin Panel</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void fetchOverview(true)}
              disabled={refreshing}
              className="h-9 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={exportCsv}
              className="h-9 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[#FF7A00]" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={handleAdminLogout}
              className="h-9 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-bold text-rose-300 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Lock & Sign Out Admin Panel"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 relative z-10">
        {/* 1. Platform KPI Overview Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#091224]/90 border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>Total Users</span>
              <Users className="h-4 w-4 text-[#00A3FF]" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">{stats.totalUsers}</div>
            <p className="text-[11px] text-slate-400">Registered accounts</p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#091224]/90 border border-emerald-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>Live Active Rooms</span>
              <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">
              {stats.activeMeetingsCount}
            </div>
            <p className="text-[11px] text-slate-400">Running right now</p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#091224]/90 border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>Total Meetings</span>
              <Video className="h-4 w-4 text-[#FF7A00]" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">{stats.totalMeetings}</div>
            <p className="text-[11px] text-slate-400">{stats.totalParticipants} total joins</p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#091224]/90 border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>Environment</span>
              <Database className="h-4 w-4 text-violet-400" />
            </div>
            <div className="text-sm sm:text-base font-extrabold text-white truncate pt-1">
              {infrastructure.databaseMode}
            </div>
            <p className="text-[11px] text-slate-400 truncate">{infrastructure.environment}</p>
          </div>
        </div>

        {/* 2. MULTI-PROVIDER INFRASTRUCTURE CONTROL CENTER (PRIMARY & BACKUP ON/OFF) */}
        <section className="rounded-3xl bg-[#081122]/92 border border-[#0066FF]/25 shadow-2xl overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-[#0066FF] via-[#00A3FF] to-[#FF7A00]" />
          <div className="p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#00A3FF] text-white flex items-center justify-center shadow-lg shadow-[#0066FF]/30">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                    Voice &amp; Vedio Infrastructure Control
                  </h2>
                  <p className="text-xs text-slate-400">
                    Turn Primary (LiveKit) &amp; Backup (Daily.co) ON or OFF live without redeploying
                  </p>
                </div>
              </div>

              {/* Active Route Status Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/12 border border-emerald-500/30 text-[11px] font-bold text-emerald-300 self-start sm:self-auto">
                <Zap className="h-3.5 w-3.5 shrink-0" />
                <span>Active Route: {effectiveRoutePreview}</span>
              </div>
            </div>

            {/* Primary & Backup Provider Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* PRIMARY: LiveKit Cloud */}
              <div
                className={`p-5 rounded-2xl border transition-all space-y-4 ${
                  config.primaryEnabled
                    ? 'bg-[#0066FF]/[0.08] border-[#0066FF]/40 shadow-[0_0_24px_rgba(0,102,255,0.12)]'
                    : 'bg-white/[0.02] border-white/10 opacity-80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-11 w-11 rounded-2xl flex items-center justify-center border ${
                        config.primaryEnabled
                          ? 'bg-[#0066FF]/20 border-[#00A3FF]/40 text-[#00A3FF]'
                          : 'bg-white/5 border-white/10 text-slate-500'
                      }`}
                    >
                      {config.primaryEnabled ? <Cloud className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-white">Primary — LiveKit Cloud</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase ${
                            config.primaryEnabled
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {config.primaryEnabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        5,000 free participant-mins/mo · HD SFU Engine
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
                          ? 'Primary LiveKit Cloud turned ON'
                          : 'Primary LiveKit Cloud turned OFF — traffic routed to Backup'
                      )
                    }
                    className={`w-12 h-7 rounded-full transition-all relative cursor-pointer shrink-0 ${
                      config.primaryEnabled
                        ? 'bg-gradient-to-r from-[#0066FF] to-[#00A3FF] shadow-md shadow-[#0066FF]/40'
                        : 'bg-slate-700'
                    }`}
                    title="Toggle Primary LiveKit Cloud"
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        config.primaryEnabled ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

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

              {/* BACKUP: Daily.co Cloud */}
              <div
                className={`p-5 rounded-2xl border transition-all space-y-4 ${
                  config.backupEnabled
                    ? 'bg-[#FF7A00]/[0.07] border-[#FF7A00]/35 shadow-[0_0_24px_rgba(255,122,0,0.1)]'
                    : 'bg-white/[0.02] border-white/10 opacity-80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-11 w-11 rounded-2xl flex items-center justify-center border ${
                        config.backupEnabled
                          ? 'bg-[#FF7A00]/20 border-[#FF7A00]/40 text-[#FFA033]'
                          : 'bg-white/5 border-white/10 text-slate-500'
                      }`}
                    >
                      {config.backupEnabled ? <Cloud className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-white">Backup — Daily.co Cloud</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase ${
                            config.backupEnabled
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {config.backupEnabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        10,000 free participant-mins/mo · Auto Failover Cloud
                      </p>
                    </div>
                  </div>

                  {/* Backup ON/OFF Switch */}
                  <button
                    disabled={savingKey === 'backup'}
                    onClick={() =>
                      void updateConfig(
                        { backupEnabled: !config.backupEnabled },
                        'backup',
                        !config.backupEnabled
                          ? 'Backup Daily.co Cloud turned ON'
                          : 'Backup Daily.co Cloud turned OFF'
                      )
                    }
                    className={`w-12 h-7 rounded-full transition-all relative cursor-pointer shrink-0 ${
                      config.backupEnabled
                        ? 'bg-gradient-to-r from-[#FF7A00] to-[#FF4D2E] shadow-md shadow-[#FF7A00]/40'
                        : 'bg-slate-700'
                    }`}
                    title="Toggle Backup Daily.co Cloud"
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        config.backupEnabled ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/[0.08]">
                  <span className="text-slate-400">
                    Env Var: <code className="text-slate-200 font-mono">DAILY_API_KEY</code>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 font-bold shrink-0 ${
                      infrastructure.dailyConfigured ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {infrastructure.dailyConfigured ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Keys Connected
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Add Key in Vercel
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Traffic Routing Mode Selector */}
            <div className="space-y-2">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
                Traffic Routing Strategy
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {(
                  [
                    {
                      id: 'auto',
                      label: 'Auto Failover',
                      desc: 'LiveKit → Daily → Mesh',
                    },
                    {
                      id: 'livekit',
                      label: 'Force Primary',
                      desc: 'LiveKit Cloud only',
                    },
                    {
                      id: 'daily',
                      label: 'Force Backup',
                      desc: 'Daily.co Cloud directly',
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
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-[#0066FF]/20 border-[#00A3FF] text-white shadow-md shadow-[#0066FF]/20'
                          : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.07]'
                      }`}
                    >
                      <div className="text-xs font-extrabold">{mode.label}</div>
                      <div className="text-[10.5px] text-slate-400 mt-0.5">{mode.desc}</div>
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
          <div className="rounded-3xl bg-[#091224]/90 border border-white/[0.08] p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <Shield className="h-4.5 w-4.5 text-[#00A3FF]" />
              <h3 className="text-sm font-extrabold text-white">Security &amp; Room Policies</h3>
            </div>

            <div className="space-y-3">
              {/* Allow Guest Join */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div>
                  <p className="text-xs font-bold text-white">Allow Guest Join</p>
                  <p className="text-[10.5px] text-slate-400">Let users join without login</p>
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
              <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div>
                  <p className="text-xs font-bold text-white">Default Waiting Room</p>
                  <p className="text-[10.5px] text-slate-400">Require host approval by default</p>
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
                    config.defaultWaitingRoom ? 'bg-[#0066FF]' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                      config.defaultWaitingRoom ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Maintenance Mode */}
              <div
                className={`flex items-center justify-between gap-3 p-3 rounded-2xl border ${
                  config.maintenanceMode
                    ? 'bg-amber-500/15 border-amber-500/40'
                    : 'bg-white/[0.03] border-white/[0.06]'
                }`}
              >
                <div>
                  <p className="text-xs font-bold text-white">Maintenance Mode</p>
                  <p className="text-[10.5px] text-slate-400">Flag platform maintenance status</p>
                </div>
                <button
                  onClick={() =>
                    void updateConfig(
                      { maintenanceMode: !config.maintenanceMode },
                      'maintenance',
                      `Maintenance Mode ${!config.maintenanceMode ? 'Activated' : 'Deactivated'}`
                    )
                  }
                  className={`w-10 h-6 rounded-full relative transition-all cursor-pointer shrink-0 ${
                    config.maintenanceMode ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                      config.maintenanceMode ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>
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

              {/* Global System Announcement */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void updateConfig(
                    { globalAnnouncement: announcementDraft.trim() },
                    'announcement',
                    announcementDraft.trim()
                      ? 'Global system notice saved'
                      : 'Global system notice cleared'
                  );
                }}
                className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2"
              >
                <label className="text-xs font-bold text-white block">
                  Global System Notice
                </label>
                <input
                  type="text"
                  value={announcementDraft}
                  onChange={(e) => setAnnouncementDraft(e.target.value)}
                  placeholder="Optional banner message for users..."
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#00A3FF]"
                />
                <button
                  type="submit"
                  disabled={savingKey === 'announcement'}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00A3FF] text-white text-xs font-bold cursor-pointer hover:opacity-95"
                >
                  Save Notice
                </button>
              </form>
            </div>
          </div>

          {/* Right 2 Columns: Live Active Rooms Monitor */}
          <div className="lg:col-span-2 rounded-3xl bg-[#091224]/90 border border-white/[0.08] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Activity className="h-4.5 w-4.5 text-emerald-400" />
                <h3 className="text-sm font-extrabold text-white">
                  Live Active Rooms ({data.activeMeetings.length})
                </h3>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                Real-time Monitor
              </span>
            </div>

            {data.activeMeetings.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center border border-dashed border-white/10 rounded-2xl">
                <Radio className="h-8 w-8 text-slate-600 mb-2" />
                <p className="text-sm font-bold text-slate-300">No active meetings right now</p>
                <p className="text-xs text-slate-500 mt-1">
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
        <section className="rounded-3xl bg-[#091224]/90 border border-white/[0.08] p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveDirectoryTab('meetings')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeDirectoryTab === 'meetings'
                    ? 'bg-[#0066FF] text-white shadow-md shadow-[#0066FF]/30'
                    : 'bg-white/[0.05] text-slate-400 hover:text-white'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Recent Meetings ({data.recentMeetings.length})
              </button>
              <button
                onClick={() => setActiveDirectoryTab('users')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeDirectoryTab === 'users'
                    ? 'bg-[#0066FF] text-white shadow-md shadow-[#0066FF]/30'
                    : 'bg-white/[0.05] text-slate-400 hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Users Directory ({data.users.length})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeDirectoryTab === 'meetings' ? 'Search rooms...' : 'Search users...'}
                className="w-full rounded-xl bg-black/40 border border-white/10 pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#00A3FF]"
              />
            </div>
          </div>

          {activeDirectoryTab === 'meetings' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 pr-4">Meeting</th>
                    <th className="py-2.5 pr-4">Host</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">Joins</th>
                    <th className="py-2.5">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredMeetings.map((m) => (
                    <tr key={m.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 pr-4">
                        <div className="font-bold text-white max-w-[240px] truncate">{m.title}</div>
                        <div className="font-mono text-[10px] text-slate-500">{m.id}</div>
                      </td>
                      <td className="py-3 pr-4 text-slate-300">{m.hostName}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.isActive
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-slate-700/70 text-slate-300'
                          }`}
                        >
                          {m.isActive ? 'Live' : 'Ended'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-mono text-cyan-300 font-bold">
                        {m.participantCount}
                      </td>
                      <td className="py-3 text-slate-400 whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 pr-4">Name</th>
                    <th className="py-2.5 pr-4">Email</th>
                    <th className="py-2.5 pr-4">Hosted Calls</th>
                    <th className="py-2.5">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 pr-4 font-bold text-white">{u.name}</td>
                      <td className="py-3 pr-4 text-slate-300 font-mono">{u.email}</td>
                      <td className="py-3 pr-4 font-mono text-[#FFA033] font-bold">
                        {u.hostedCount}
                      </td>
                      <td className="py-3 text-slate-400 whitespace-nowrap">
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
