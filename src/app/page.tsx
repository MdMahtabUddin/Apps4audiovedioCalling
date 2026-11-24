'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Video,
  Shield,
  ArrowRight,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Lock,
  Globe,
  Volume2,
  CheckCircle2,
  Keyboard,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { BrandLogo } from '@/components/ui/brand-logo';
import { UserProfile } from '@/types';
import { generateMeetingId } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

export default function HomePage() {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [meetingInput, setMeetingInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Clean live camera preview + subtle animated studio stage
  const [isCamPreviewOn, setIsCamPreviewOn] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [activeSpeakerIdx, setActiveSpeakerIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (isCamPreviewOn) return;
    const timer = setInterval(() => {
      setActiveSpeakerIdx((prev) => (prev + 1) % 3);
    }, 2800);
    return () => clearInterval(timer);
  }, [isCamPreviewOn]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          router.replace('/dashboard');
        }
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream]);

  useEffect(() => {
    if (isCamPreviewOn && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [isCamPreviewOn, stream]);

  const handleStartInstant = async () => {
    setIsCreating(true);
    const id = generateMeetingId();
    if (typeof window !== 'undefined') {
      localStorage.setItem(`metromeet_host_${id}`, 'true');
    }
    try {
      await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title: 'Instant Meeting' }),
      });
    } catch {
      // Proceed to room even if metadata pre-create fails
    } finally {
      setIsCreating(false);
    }
    router.push(`/meeting/${id}`);
  };

  const handleJoinInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingInput.trim()) return;
    let code = meetingInput.trim();
    if (code.includes('/meeting/')) {
      code = code.split('/meeting/')[1].split('?')[0];
    }
    code = code.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
    if (!code) return;
    router.push(`/meeting/${code}`);
  };

  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        let code = text.trim();
        if (code.includes('/meeting/')) {
          code = code.split('/meeting/')[1].split('?')[0];
        }
        setMeetingInput(code);
        toast.info('Meeting code pasted');
      }
    } catch {
      toast.warning('Clipboard access denied');
    }
  };

  const handleToggleCamera = async () => {
    if (isCamPreviewOn) {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        setStream(null);
      }
      setIsCamPreviewOn(false);
    } else {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setStream(media);
        setIsCamPreviewOn(true);
      } catch {
        toast.warning('Camera permission was blocked or unavailable.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 flex flex-col transition-colors duration-200 selection:bg-blue-600 selection:text-white">
      <Navbar user={user} onQuickNewMeeting={handleStartInstant} />

      {/* Main 2026 Clean Split Hero */}
      <main className="flex-1">
        <section className="relative overflow-hidden">
          {/* Subtle Fading Dot Matrix Backdrop */}
          <div className="absolute inset-0 bg-dot-matrix [mask-image:radial-gradient(ellipse_75%_65%_at_50%_20%,#000_40%,transparent_100%)] pointer-events-none" />

          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 sm:pb-24 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Typography & Actions */}
            <div className="lg:col-span-7 space-y-7">
              <div className="animate-fade-up inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] shadow-xs text-xs font-medium text-slate-700 dark:text-zinc-300">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>Next-Gen HD Vedio Conferencing</span>
              </div>

              <div className="space-y-4 animate-fade-up-1">
                <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-semibold tracking-[-0.035em] text-slate-950 dark:text-white leading-[1.06]">
                  Vedio meetings built for{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 dark:from-blue-400 dark:via-sky-300 dark:to-indigo-400">
                    clarity and speed.
                  </span>
                </h1>
                <p className="text-base sm:text-lg text-slate-600 dark:text-zinc-400 max-w-xl leading-relaxed font-normal">
                  Connect with your team in crisp 1080p high definition with 48kHz studio voice clarity, instant screen sharing, and zero downloads.
                </p>
              </div>

              {/* Elevated Unified Action Bar */}
              <div className="animate-fade-up-2 p-2 rounded-2xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] shadow-lg shadow-slate-900/[0.05] dark:shadow-black/50 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-xl">
                <button
                  onClick={handleStartInstant}
                  disabled={isCreating}
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white text-sm font-semibold shadow-sm shadow-blue-600/25 transition-all duration-150 active:scale-[0.98] cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <Video className="h-4 w-4" />
                  <span>{isCreating ? 'Creating...' : 'New meeting'}</span>
                </button>

                <form onSubmit={handleJoinInput} className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1">
                    <Keyboard className="h-4 w-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Enter a code or link"
                      value={meetingInput}
                      onChange={(e) => setMeetingInput(e.target.value)}
                      className="w-full h-11 rounded-xl bg-slate-50 dark:bg-[#09090b] border border-slate-200/80 dark:border-white/[0.08] pl-10 pr-14 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={handlePasteCode}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[11px] font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                    >
                      Paste
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={!meetingInput.trim()}
                    className="h-11 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-sm font-semibold text-white dark:text-zinc-950 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    <span>Join</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>

              {/* Clean Trust Indicators */}
              <div className="animate-fade-up-3 pt-4 border-t border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  No downloads required
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Encrypted rooms
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
                  Desktop &amp; Mobile ready
                </span>
              </div>
            </div>

            {/* Right Column: Animated Studio Preview & Interactive Camera Card */}
            <div className="lg:col-span-5 animate-fade-up-2">
              <div className="rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#111114] p-3.5 shadow-2xl shadow-slate-900/[0.08] dark:shadow-black/70 space-y-3 transition-all duration-300">
                {/* Top Minimal Window Bar */}
                <div className="flex items-center justify-between px-1 pb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-200 dark:bg-zinc-700" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-200 dark:bg-zinc-700" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-200 dark:bg-zinc-700" />
                    <span className="ml-2 text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                      Studio · HD 1080p
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-500/20 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    <span>{isCamPreviewOn ? 'Live Camera' : '48kHz Live'}</span>
                  </div>
                </div>

                {/* Main Stage Area */}
                <div className="relative aspect-[16/11] w-full rounded-xl bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/60 dark:from-[#0c0c10] dark:via-[#09090b] dark:to-blue-950/20 border border-slate-200/80 dark:border-white/[0.06] overflow-hidden p-2.5">
                  {isCamPreviewOn ? (
                    <div className="relative w-full h-full rounded-lg overflow-hidden bg-black">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                      <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-md bg-black/65 backdrop-blur-md text-[11px] font-medium text-white">
                        You (Live Preview)
                      </div>
                      {!isMicMuted && (
                        <div className="absolute bottom-2.5 right-2.5 inline-flex items-end gap-0.5 h-6 px-2 py-1.5 rounded-md bg-black/65 backdrop-blur-md">
                          <span className="w-0.5 bg-emerald-400 rounded-full soundwave-bar-1" />
                          <span className="w-0.5 bg-emerald-400 rounded-full soundwave-bar-2" />
                          <span className="w-0.5 bg-emerald-400 rounded-full soundwave-bar-3" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 grid-rows-2 gap-2 h-full w-full">
                      {[
                        {
                          initials: 'MH',
                          name: 'Mahtab',
                          role: 'Host',
                          bg: 'from-blue-600 to-indigo-600',
                          tint: 'bg-blue-50/70 dark:bg-blue-950/25',
                        },
                        {
                          initials: 'SR',
                          name: 'Sarah',
                          role: 'Design',
                          bg: 'from-violet-600 to-fuchsia-600',
                          tint: 'bg-violet-50/70 dark:bg-violet-950/25',
                        },
                        {
                          initials: 'AK',
                          name: 'Alex',
                          role: 'Product',
                          bg: 'from-emerald-600 to-teal-600',
                          tint: 'bg-emerald-50/70 dark:bg-emerald-950/25',
                        },
                      ].map((person, idx) => {
                        const isSpeaking = activeSpeakerIdx === idx;
                        return (
                          <div
                            key={person.name}
                            className={`relative rounded-lg border transition-all duration-500 flex flex-col items-center justify-center overflow-hidden ${
                              person.tint
                            } ${
                              isSpeaking
                                ? 'border-blue-500/80 dark:border-blue-400/80 shadow-md shadow-blue-500/15 scale-[1.01]'
                                : 'border-slate-200/80 dark:border-white/[0.07]'
                            }`}
                          >
                            {/* Soft Breathing Speaker Halo */}
                            <div className="relative flex items-center justify-center">
                              {isSpeaking && (
                                <span className="absolute inset-0 -m-1.5 rounded-full border-2 border-blue-500/40 dark:border-blue-400/40 animate-ping" />
                              )}
                              <div
                                className={`h-11 w-11 rounded-full bg-gradient-to-br ${person.bg} text-white text-xs font-bold flex items-center justify-center shadow-sm transition-transform duration-500 ${
                                  isSpeaking ? 'scale-105' : 'scale-100'
                                }`}
                              >
                                {person.initials}
                              </div>
                            </div>

                            {/* Bottom Nameplate + Live Equalizer */}
                            <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded bg-white/85 dark:bg-black/60 backdrop-blur-sm text-[10px] font-semibold text-slate-800 dark:text-zinc-200 border border-slate-200/60 dark:border-white/[0.06] truncate">
                                {person.name}
                              </span>
                              {isSpeaking ? (
                                <span className="inline-flex items-end gap-0.5 h-4 px-1.5 py-0.5 rounded bg-blue-600 text-white">
                                  <span className="w-0.5 bg-white rounded-full soundwave-bar-1" />
                                  <span className="w-0.5 bg-white rounded-full soundwave-bar-2" />
                                  <span className="w-0.5 bg-white rounded-full soundwave-bar-3" />
                                </span>
                              ) : (
                                <span className="h-4 w-4 rounded bg-white/80 dark:bg-black/50 flex items-center justify-center text-slate-400 dark:text-zinc-500">
                                  <Mic className="h-2.5 w-2.5" />
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* 4th Tile: Interactive "You" Camera Preview Trigger */}
                      <button
                        type="button"
                        onClick={handleToggleCamera}
                        className="group relative rounded-lg border border-dashed border-slate-300 dark:border-white/[0.15] bg-white/80 dark:bg-zinc-900/60 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all duration-200 flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <div className="relative">
                          <span className="absolute inset-0 rounded-full bg-blue-500/20 group-hover:animate-ping" />
                          <div className="relative h-9 w-9 rounded-full bg-blue-600/10 dark:bg-blue-500/15 border border-blue-500/25 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Camera className="h-4 w-4" />
                          </div>
                        </div>
                        <span className="text-[10.5px] font-semibold text-slate-700 dark:text-zinc-200">
                          Try Camera
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Minimal Controls Bar */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsMicMuted((m) => !m)}
                      className={`h-9 w-9 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                        isMicMuted
                          ? 'bg-rose-50 dark:bg-rose-600/15 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400'
                          : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                      title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                    >
                      {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>

                    <button
                      onClick={handleToggleCamera}
                      className={`h-9 px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isCamPreviewOn
                          ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                          : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {isCamPreviewOn ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                      <span>{isCamPreviewOn ? 'Stop Preview' : 'Test Camera'}</span>
                    </button>
                  </div>

                  <Link
                    href="/login"
                    className="text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    Sign in →
                  </Link>
                </div>
              </div>
            </div>
          </div>
          </div>
        </section>

        {/* Modern 2026 Bento Feature Grid */}
        <section className="border-t border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0c0c0f] transition-colors duration-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 space-y-10">
            <div className="max-w-xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Engineered for Teams
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                Everything you need for effortless collaboration.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
              {/* Wide Bento 1 */}
              <div className="md:col-span-4 rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-[#f8fafc] dark:bg-[#111114] p-6 sm:p-7 flex flex-col justify-between gap-6 glass-panel-hover">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 max-w-md">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-600/10 border border-blue-200/70 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Video className="h-4.5 w-4.5" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      Adaptive HD SFU &amp; Smart Gallery
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                      Low-latency multi-party routing with automatic bandwidth optimization, paginated gallery views, and instant screen sharing.
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] text-[11px] font-mono font-medium text-slate-600 dark:text-zinc-300 shrink-0">
                    1080p · 60fps
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06] text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                  <span className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/[0.06]">Live Auto Captions</span>
                  <span className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/[0.06]">Screen Presentation</span>
                  <span className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/[0.06]">Live Polls &amp; Chat</span>
                </div>
              </div>

              {/* Compact Bento 2 */}
              <div className="md:col-span-2 rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-[#f8fafc] dark:bg-[#111114] p-6 sm:p-7 flex flex-col justify-between gap-5 glass-panel-hover">
                <div className="space-y-2.5">
                  <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Volume2 className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    48kHz Studio Voice
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                    Noise suppression, echo cancellation, and built-in voice clarity boost.
                  </p>
                </div>
                <div className="inline-flex items-end gap-1 h-7 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/[0.06] w-fit">
                  <span className="w-1 bg-emerald-500 rounded-full soundwave-bar-1" />
                  <span className="w-1 bg-emerald-500 rounded-full soundwave-bar-2" />
                  <span className="w-1 bg-emerald-500 rounded-full soundwave-bar-3" />
                  <span className="w-1 bg-emerald-500 rounded-full soundwave-bar-4" />
                  <span className="ml-2 text-[10px] font-mono text-slate-500 dark:text-zinc-400 self-center">Opus HD</span>
                </div>
              </div>

              {/* Compact Bento 3 */}
              <div className="md:col-span-2 rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-[#f8fafc] dark:bg-[#111114] p-6 sm:p-7 space-y-2.5 glass-panel-hover">
                <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-700 dark:text-zinc-200">
                  <Shield className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Host Room Security
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Waiting rooms, room passcodes, host lock controls, and instant participant management.
                </p>
              </div>

              {/* Wide Bento 4 */}
              <div className="md:col-span-4 rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-[#f8fafc] dark:bg-[#111114] p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5 glass-panel-hover">
                <div className="space-y-2 max-w-md">
                  <div className="h-9 w-9 rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-200/70 dark:border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
                    <Globe className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Unlimited Self-Hosted Infrastructure
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                    Run unlimited meetings with zero time caps, instant browser PWA install on mobile, and a dedicated Admin Control Center.
                  </p>
                </div>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold transition-colors shrink-0"
                >
                  <span>Create workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-slate-200/80 dark:border-white/[0.08] bg-[#f8fafc] dark:bg-[#09090b] transition-colors duration-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <BrandLogo size="sm" showTagline={false} href="/" />
          <div className="flex items-center gap-6 text-xs text-slate-500 dark:text-zinc-500">
            <Link href="/login" className="hover:text-slate-900 dark:hover:text-zinc-200 transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-slate-900 dark:hover:text-zinc-200 transition-colors">Create account</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
