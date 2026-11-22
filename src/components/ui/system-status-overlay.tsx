'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Megaphone, RefreshCw, Shield, Wrench, X } from 'lucide-react';
import { BrandLogo } from './brand-logo';

interface PublicSystemStatus {
  maintenanceMode: boolean;
  globalAnnouncement: string;
}

export function SystemStatusOverlay() {
  const pathname = usePathname();
  const [status, setStatus] = useState<PublicSystemStatus | null>(null);
  const [dismissedNotice, setDismissedNotice] = useState<string>('');
  const [checking, setChecking] = useState(false);

  const isAdminRoute = pathname?.startsWith('/admin');
  const isMeetingRoute = pathname?.startsWith('/meeting/');

  const fetchStatus = async (manual = false) => {
    if (manual) setChecking(true);
    try {
      const res = await fetch('/api/system/status', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setStatus({
        maintenanceMode: Boolean(data.maintenanceMode),
        globalAnnouncement: typeof data.globalAnnouncement === 'string' ? data.globalAnnouncement.trim() : '',
      });
    } catch {
      // ignore transient network errors
    } finally {
      if (manual) setChecking(false);
    }
  };

  useEffect(() => {
    void fetchStatus(false);
    const interval = setInterval(() => void fetchStatus(false), 30000);
    return () => clearInterval(interval);
  }, [pathname]);

  // Never block or clutter the Admin Panel itself
  if (isAdminRoute || !status) return null;

  // 1. FULL-SCREEN EXECUTIVE MAINTENANCE MODE OVERLAY
  if (status.maintenanceMode) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#050a14] text-white flex items-center justify-center p-5 overflow-hidden">
        {/* Animated MetroMeet Brand Aurora Glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 left-1/4 w-[520px] h-[360px] rounded-full bg-[#0066FF]/16 blur-[130px] animate-pulse" />
          <div
            className="absolute -bottom-32 right-1/4 w-[480px] h-[340px] rounded-full bg-[#FF7A00]/14 blur-[130px] animate-pulse"
            style={{ animationDelay: '1.2s', animationDuration: '4.5s' }}
          />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #388BFF 1px, transparent 1px), linear-gradient(to bottom, #388BFF 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-lg rounded-3xl bg-[#081124]/92 border border-white/12 shadow-[0_28px_80px_rgba(0,0,0,0.75)] backdrop-blur-2xl overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-[#0066FF] via-[#00A3FF] to-[#FF7A00]" />

          <div className="p-7 sm:p-9 text-center space-y-6">
            <div className="flex flex-col items-center gap-4">
              <BrandLogo size="lg" showTagline={false} href="" />
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[11px] font-extrabold uppercase tracking-[0.14em]">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                Scheduled Maintenance
              </span>
            </div>

            <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-[#FF7A00]/20 to-[#0066FF]/20 border border-white/15 flex items-center justify-center shadow-lg">
              <Wrench className="h-8 w-8 text-[#FFA033]" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                We&apos;ll Be Right Back
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
                MetroMeet PRO is currently undergoing a quick infrastructure upgrade to deliver even
                faster, crystal-clear HD vedio &amp; audio conferencing.
              </p>
            </div>

            {status.globalAnnouncement && (
              <div className="rounded-2xl bg-white/[0.04] border border-[#00A3FF]/25 px-4 py-3 text-left flex items-start gap-3">
                <Megaphone className="h-4 w-4 text-[#FFA033] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-300">
                    Admin Update
                  </p>
                  <p className="text-xs text-slate-200 font-medium mt-0.5 leading-relaxed">
                    {status.globalAnnouncement}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
              <button
                onClick={() => void fetchStatus(true)}
                disabled={checking}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00A3FF] hover:opacity-95 text-white text-xs font-extrabold shadow-lg shadow-[#0066FF]/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
                <span>{checking ? 'Checking Status...' : 'Check Live Status'}</span>
              </button>

              <Link
                href="/admin"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Shield className="h-3.5 w-3.5 text-cyan-400" />
                <span>Admin Login</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. SLEEK FLOATING GLOBAL SYSTEM NOTICE RIBBON (Shown on Dashboard, Login, Home — not distracting active meetings)
  if (
    status.globalAnnouncement &&
    status.globalAnnouncement !== dismissedNotice &&
    !isMeetingRoute
  ) {
    return (
      <div className="sticky top-0 z-[90] w-full bg-gradient-to-r from-[#071631] via-[#0c1f44] to-[#1a1328] border-b border-[#00A3FF]/30 shadow-[0_6px_24px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#FF7A00] to-[#FF4D2E] text-white text-[9.5px] font-black uppercase tracking-[0.14em] shrink-0 shadow-sm shadow-[#FF7A00]/30">
              <Megaphone className="h-3 w-3 animate-pulse" />
              <span>Notice</span>
            </span>
            <p className="text-xs sm:text-[13px] font-semibold text-white/95 truncate sm:whitespace-normal">
              {status.globalAnnouncement}
            </p>
          </div>
          <button
            onClick={() => setDismissedNotice(status.globalAnnouncement)}
            className="h-6 w-6 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer transition-colors"
            title="Dismiss Notice"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
