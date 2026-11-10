'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Video,
  Shield,
  Zap,
  MonitorUp,
  ArrowRight,
  Mic,
  MicOff,
  Camera,
  MessageSquare,
  Users,
  CheckCircle2,
  Sparkles,
  Lock,
  Globe,
  Radio,
  Share2,
  Check,
  ChevronRight,
  Smile,
  Laptop,
  Layers,
  Cpu,
  Flame,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserProfile } from '@/types';
import { generateMeetingId } from '@/lib/utils';

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [meetingInput, setMeetingInput] = useState('');
  const [floatingReaction, setFloatingReaction] = useState<string | null>(null);
  const [isDemoMuted, setIsDemoMuted] = useState(false);
  const [isDemoCamOn, setIsDemoCamOn] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const handleStartInstant = () => {
    const id = generateMeetingId();
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
    router.push(`/meeting/${code}`);
  };

  const triggerReaction = (emoji: string) => {
    setFloatingReaction(emoji);
    setTimeout(() => setFloatingReaction(null), 2500);
  };

  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Aurora Ambient Mesh Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-96 -left-48 w-[450px] h-[450px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none animate-float" />
      <div className="absolute top-96 -right-48 w-[450px] h-[450px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none animate-float-slow" />

      <Navbar user={user} onQuickNewMeeting={handleStartInstant} />

      <main className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-24 relative z-10">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          {/* Top Pill with Glow */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.1] backdrop-blur-xl shadow-lg shadow-black/20 text-xs font-semibold text-indigo-300 hover:border-indigo-500/40 transition-colors cursor-pointer group">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="tracking-wide">Ultra Low-Latency WebRTC 2.0 Engine</span>
            <ChevronRight className="h-3.5 w-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
          </div>

          {/* World-Class Hero Heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08] max-w-4xl mx-auto">
            Video Meetings for Teams That Demand{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-200 text-glow">
              Zero Latency.
            </span>
          </h1>

          <p className="text-base sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed font-normal">
            Direct peer-to-peer WebRTC mesh streaming, crystal-clear 48kHz Opus audio, and 4K screen sharing built for high-performance collaboration.
          </p>

          {/* Quick Launch & Join Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 max-w-xl mx-auto w-full">
            <Button
              size="lg"
              className="w-full sm:w-auto shadow-2xl shadow-indigo-600/40 text-sm sm:text-base font-bold transition-all duration-300 hover:scale-[1.02] cursor-pointer"
              onClick={handleStartInstant}
            >
              <Video className="h-5 w-5" />
              Start Instant Meeting
            </Button>

            <form onSubmit={handleJoinInput} className="w-full sm:w-auto flex items-center gap-2 flex-1">
              <input
                type="text"
                placeholder="Enter room code (e.g. abc-defg-hij)"
                value={meetingInput}
                onChange={(e) => setMeetingInput(e.target.value)}
                className="w-full sm:w-64 bg-white/[0.05] border border-white/[0.1] rounded-2xl px-4 py-3 text-xs sm:text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-indigo-500 focus:bg-white/[0.08] transition-all font-mono"
              />
              <Button size="lg" variant="secondary" type="submit" disabled={!meetingInput.trim()} className="cursor-pointer">
                Join
              </Button>
            </form>
          </div>

          {/* Interactive Live Meeting Room Mockup Stage */}
          <div className="pt-10 max-w-5xl mx-auto relative animate-float-slow">
            {/* Floating reaction animation */}
            {floatingReaction && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-7xl animate-bounce z-40 pointer-events-none drop-shadow-2xl">
                {floatingReaction}
              </div>
            )}

            <div className="rounded-3xl border border-white/[0.12] bg-[#0c101c]/85 backdrop-blur-2xl p-4 sm:p-6 shadow-2xl shadow-indigo-950/50 relative overflow-hidden group">
              {/* Fake Chrome / Address Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block shadow-sm shadow-rose-500/50" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block shadow-sm shadow-amber-500/50" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block shadow-sm shadow-emerald-500/50" />
                  <span className="text-xs text-gray-400 font-mono ml-3 px-3 py-1 rounded-lg bg-black/40 border border-white/[0.06] hidden sm:inline">
                    https://meetflow.app/meeting/sync-daily-standup
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="success" dot>
                    1080p HD • 60 FPS
                  </Badge>
                  <span className="text-xs font-mono text-gray-400 hidden sm:inline">00:34:12</span>
                </div>
              </div>

              {/* Video Grid Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
                {/* Tile 1: Host Speaking with Active Sound Waves */}
                <div className="relative aspect-video rounded-2xl bg-gradient-to-br from-indigo-950/70 via-[#101528] to-[#0c101c] border-2 border-indigo-500/80 shadow-xl shadow-indigo-500/25 flex items-center justify-center overflow-hidden">
                  <div className="text-center space-y-3">
                    <div className="relative inline-block">
                      <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 border-2 border-indigo-400/50 flex items-center justify-center mx-auto text-white font-extrabold text-2xl shadow-xl shadow-indigo-600/40">
                        AJ
                      </div>
                      <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-emerald-400 border-2 border-[#101528]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Alex Johnson</p>
                      <p className="text-[11px] text-indigo-300 font-medium">Product Architect (Host)</p>
                    </div>
                  </div>

                  {/* Active Audio Waveform bars */}
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-lg">
                    <div className="flex items-center gap-1 h-5">
                      <span className="w-1 bg-emerald-400 rounded-full soundwave-bar-1" />
                      <span className="w-1 bg-emerald-400 rounded-full soundwave-bar-2" />
                      <span className="w-1 bg-emerald-400 rounded-full soundwave-bar-3" />
                      <span className="w-1 bg-emerald-400 rounded-full soundwave-bar-4" />
                    </div>
                    <span className="text-[11px] text-emerald-400 font-bold ml-1">Speaking</span>
                  </div>

                  <div className="absolute bottom-3 left-3">
                    <Badge variant="indigo" className="bg-black/60 backdrop-blur">
                      Screen Share Live
                    </Badge>
                  </div>
                </div>

                {/* Tile 2: Participant */}
                <div className="relative aspect-video rounded-2xl bg-gradient-to-br from-purple-950/40 via-[#131127] to-[#0c101c] border border-white/[0.08] flex items-center justify-center overflow-hidden">
                  <div className="text-center space-y-3">
                    <div className="relative inline-block">
                      <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 border-2 border-purple-400/50 flex items-center justify-center mx-auto text-white font-extrabold text-2xl shadow-xl shadow-purple-600/30">
                        SM
                      </div>
                      <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-emerald-400 border-2 border-[#131127]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Sarah Miller</p>
                      <p className="text-[11px] text-purple-300 font-medium">Senior Engineer</p>
                    </div>
                  </div>

                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10 text-xs font-mono text-gray-300 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span>38ms</span>
                  </div>

                  <div className="absolute bottom-3 left-3">
                    <Badge variant="default" className="bg-black/60 backdrop-blur">
                      Connected
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Floating Action Controls Bar with Interactive Controls */}
              <div className="flex items-center justify-between gap-3 p-3 bg-black/70 border border-white/[0.1] backdrop-blur-xl rounded-2xl max-w-xl mx-auto shadow-2xl">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsDemoMuted(!isDemoMuted)}
                    className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                      isDemoMuted ? 'bg-rose-600 text-white' : 'bg-white/[0.08] hover:bg-white/[0.14] text-emerald-400'
                    }`}
                    title={isDemoMuted ? 'Unmute' : 'Mute'}
                  >
                    {isDemoMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => setIsDemoCamOn(!isDemoCamOn)}
                    className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                      !isDemoCamOn ? 'bg-rose-600 text-white' : 'bg-white/[0.08] hover:bg-white/[0.14] text-emerald-400'
                    }`}
                    title={isDemoCamOn ? 'Turn camera off' : 'Turn camera on'}
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <button className="h-10 w-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-all cursor-pointer">
                    <MonitorUp className="h-4 w-4" />
                  </button>
                </div>

                {/* Reaction buttons */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/[0.04]">
                  {['👍', '❤️', '👏', '🎉', '🔥'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => triggerReaction(emoji)}
                      className="h-8 w-8 rounded-lg hover:bg-white/[0.1] text-base flex items-center justify-center transition-all hover:scale-125 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <div>
                  <button
                    onClick={handleStartInstant}
                    className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
                  >
                    Try Live Call
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Social Proof & Metrics Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-16 max-w-4xl mx-auto text-left">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-indigo-500/30 transition-colors">
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">&lt; 85ms</div>
              <p className="text-xs text-gray-400 mt-1">Glass-to-glass latency</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-indigo-500/30 transition-colors">
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">48 kHz</div>
              <p className="text-xs text-gray-400 mt-1">Studio Opus audio</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-indigo-500/30 transition-colors">
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">4K UHD</div>
              <p className="text-xs text-gray-400 mt-1">Screen sharing resolution</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-indigo-500/30 transition-colors">
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">100%</div>
              <p className="text-xs text-gray-400 mt-1">Peer-to-peer encrypted</p>
            </div>
          </div>

          {/* Bento Feature Grid */}
          <div className="pt-20 max-w-5xl mx-auto">
            <div className="text-center space-y-3 mb-12">
              <Badge variant="indigo">High Performance Architecture</Badge>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Designed for Teams That Never Settle for Lag.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              {/* Card 1 */}
              <div className="p-6 rounded-3xl bg-[#0c101c]/80 border border-white/[0.08] hover:border-indigo-500/40 transition-all duration-300 shadow-xl group">
                <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-5 group-hover:scale-110 transition-transform">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Zero-Relay P2P Streaming</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Video and audio stream directly between peers using Google STUN networks, eliminating slow intermediary proxies.
                </p>
              </div>

              {/* Card 2 */}
              <div className="p-6 rounded-3xl bg-[#0c101c]/80 border border-white/[0.08] hover:border-purple-500/40 transition-all duration-300 shadow-xl group">
                <div className="h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-5 group-hover:scale-110 transition-transform">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Active Speaker Waveforms</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Real-time Web Audio API energy detection highlights speakers with zero delay and rejects ambient room noise.
                </p>
              </div>

              {/* Card 3 */}
              <div className="p-6 rounded-3xl bg-[#0c101c]/80 border border-white/[0.08] hover:border-emerald-500/40 transition-all duration-300 shadow-xl group">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Security & Waiting Room</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Meeting passwords, waiting room gating, instant room lock, and salted JWT session authentication.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-white/[0.08] bg-[#070912] text-xs text-gray-400 text-center">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-indigo-400" />
            <span className="font-bold text-white">MeetFlow</span>
            <span>• Next-Gen Video Conferencing</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/register" className="hover:text-white transition-colors">
              Get Started
            </Link>
            <span className="text-gray-400">© 2026 MeetFlow Inc.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
