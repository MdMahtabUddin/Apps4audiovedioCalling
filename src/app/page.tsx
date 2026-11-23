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

  // Optional clean live camera check
  const [isCamPreviewOn, setIsCamPreviewOn] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

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
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-blue-600 selection:text-white">
      <Navbar user={user} onQuickNewMeeting={handleStartInstant} />

      {/* Main Clean Split Hero */}
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-24 pb-16 sm:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
            {/* Left Column: Typography & Actions */}
            <div className="lg:col-span-7 space-y-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-white/[0.08] text-xs font-medium text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>Self-Hosted HD Vedio Conferencing</span>
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-semibold tracking-[-0.035em] text-white leading-[1.08]">
                  Vedio meetings built for clarity and speed.
                </h1>
                <p className="text-base sm:text-lg text-zinc-400 max-w-xl leading-relaxed font-normal">
                  Connect with your team in crisp high definition with studio voice processing, screen sharing, and instant browser access.
                </p>
              </div>

              {/* Clean Google Meet-Style Action Row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1 max-w-xl">
                <button
                  onClick={handleStartInstant}
                  disabled={isCreating}
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <Video className="h-4 w-4" />
                  <span>{isCreating ? 'Creating...' : 'New meeting'}</span>
                </button>

                <form onSubmit={handleJoinInput} className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1">
                    <Keyboard className="h-4 w-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Enter a code or link"
                      value={meetingInput}
                      onChange={(e) => setMeetingInput(e.target.value)}
                      className="w-full h-11 rounded-lg bg-[#111114] border border-white/[0.1] pl-10 pr-14 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handlePasteCode}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      Paste
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={!meetingInput.trim()}
                    className="h-11 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-sm font-semibold text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    <span>Join</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>

              {/* Clean Trust Indicators */}
              <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  No downloads required
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-blue-400" />
                  Encrypted rooms
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-zinc-400" />
                  Works on Desktop &amp; Mobile
                </span>
              </div>
            </div>

            {/* Right Column: Clean Interactive Camera Check Card */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-white/[0.08] bg-[#111114] p-3 shadow-2xl shadow-black/60 space-y-3">
                <div className="relative aspect-[16/10] w-full rounded-xl bg-[#09090b] border border-white/[0.06] overflow-hidden flex items-center justify-center">
                  {isCamPreviewOn ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-center px-6 space-y-3">
                      <div className="h-14 w-14 rounded-full bg-zinc-900 border border-white/[0.08] flex items-center justify-center text-zinc-400">
                        <Camera className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-zinc-200">Ready when you are</p>
                        <p className="text-xs text-zinc-500">Test your camera before joining a room</p>
                      </div>
                    </div>
                  )}

                  {/* Subtle Status Tag */}
                  <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md border border-white/[0.08] text-[11px] font-medium text-zinc-300">
                    <span className={`h-1.5 w-1.5 rounded-full ${isCamPreviewOn ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                    {isCamPreviewOn ? 'Camera Active' : 'Preview Off'}
                  </div>
                </div>

                {/* Minimal Controls Bar */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsMicMuted((m) => !m)}
                      className={`h-9 w-9 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                        isMicMuted
                          ? 'bg-rose-600/15 border-rose-500/30 text-rose-400'
                          : 'bg-zinc-900 border-white/[0.08] text-zinc-300 hover:text-white hover:bg-zinc-800'
                      }`}
                      title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                    >
                      {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>

                    <button
                      onClick={handleToggleCamera}
                      className={`h-9 px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isCamPreviewOn
                          ? 'bg-blue-600/15 border-blue-500/30 text-blue-400'
                          : 'bg-zinc-900 border-white/[0.08] text-zinc-300 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      {isCamPreviewOn ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                      <span>{isCamPreviewOn ? 'Stop Preview' : 'Test Camera'}</span>
                    </button>
                  </div>

                  <Link
                    href="/login"
                    className="text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                  >
                    Sign in →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Clean 3-Column Feature Architecture */}
        <section className="border-t border-white/[0.08] bg-[#0c0c0f]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-6 space-y-3">
                <div className="h-9 w-9 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Video className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-sm font-semibold text-white">Adaptive HD Vedio</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Powered by low-latency SFU routing with paginated gallery views, screen sharing, and automatic bandwidth adaptation.
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-6 space-y-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Volume2 className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-sm font-semibold text-white">Studio Voice Clarity</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  48kHz Opus audio with built-in noise suppression, echo cancellation, and real-time voice clarity enhancement.
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-6 space-y-3">
                <div className="h-9 w-9 rounded-lg bg-zinc-800 border border-white/[0.08] flex items-center justify-center text-zinc-200">
                  <Shield className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-sm font-semibold text-white">Enterprise Room Controls</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Host waiting rooms, passcode protection, live polls, attendance exports, and dedicated admin infrastructure controls.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-white/[0.08] bg-[#09090b]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <BrandLogo size="sm" showTagline={false} href="/" />
          <div className="flex items-center gap-6 text-xs text-zinc-500">
            <Link href="/login" className="hover:text-zinc-200 transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-zinc-200 transition-colors">Create account</Link>
            <Link href="/admin" className="hover:text-zinc-200 transition-colors">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
