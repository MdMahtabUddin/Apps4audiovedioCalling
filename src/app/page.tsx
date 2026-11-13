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
  Volume2,
  PhoneCall,
  Flame,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/ui/brand-logo';
import { soundEngine } from '@/lib/audio/sound-engine';
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
    soundEngine.playIntroChime();
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
    soundEngine.playIntroChime();
    router.push(`/meeting/${code}`);
  };

  const triggerReaction = (emoji: string) => {
    setFloatingReaction(emoji);
    setTimeout(() => setFloatingReaction(null), 2500);
  };

  return (
    <div className="min-h-screen bg-[#050a14] text-slate-100 flex flex-col selection:bg-[#0066FF] selection:text-white relative overflow-hidden">
      {/* MetroNet Aurora Ambient Mesh Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-b from-[#0066FF]/20 via-[#FF7A00]/12 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-96 -left-48 w-[450px] h-[450px] bg-[#0066FF]/15 rounded-full blur-3xl pointer-events-none animate-float" />
      <div className="absolute top-96 -right-48 w-[450px] h-[450px] bg-[#FF7A00]/15 rounded-full blur-3xl pointer-events-none animate-float-slow" />

      <Navbar user={user} onQuickNewMeeting={handleStartInstant} />

      <main className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-24 relative z-10">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          {/* Top Pill with MetroNet Glow */}
          <div
            onClick={() => soundEngine.playIntroChime()}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.04] border border-[#0066FF]/30 backdrop-blur-xl shadow-lg shadow-black/30 text-xs font-semibold text-[#388BFF] hover:border-[#FF7A00]/50 transition-colors cursor-pointer group select-none"
            title="Click to hear MetroNet sonic branding"
          >
            <span className="flex h-2 w-2 rounded-full bg-[#FF7A00] animate-ping" />
            <span className="tracking-wide">MetroNet Enterprise WebRTC 2.0 Engine</span>
            <Volume2 className="h-3.5 w-3.5 text-[#FFA033] group-hover:scale-110 transition-transform" />
          </div>

          {/* World-Class Hero Heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08] max-w-4xl mx-auto">
            Enterprise Video Meetings with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0066FF] via-[#388BFF] to-[#FF7A00] text-glow-blue">
              Zero Latency.
            </span>
          </h1>

          <p className="text-base sm:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed font-normal">
            Direct peer-to-peer WebRTC mesh streaming, crystal-clear 48kHz Opus audio, waiting room admission approval, and 4K screen sharing built for mission-critical enterprise teams.
          </p>

          {/* Quick Launch & Join Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 max-w-xl mx-auto w-full">
            <Button
              variant="orange"
              size="lg"
              className="w-full sm:w-auto text-sm sm:text-base cursor-pointer"
              onClick={handleStartInstant}
            >
              <Video className="h-5 w-5" />
              Start Instant Meeting
            </Button>

            <form onSubmit={handleJoinInput} className="w-full sm:w-auto flex items-center gap-2 flex-1">
              <input
                type="text"
                placeholder="Enter room code (e.g. uws-puhf-gwc)"
                value={meetingInput}
                onChange={(e) => setMeetingInput(e.target.value)}
                className="w-full sm:w-64 bg-white/[0.05] border border-[#0066FF]/30 rounded-2xl px-4 py-3 text-xs sm:text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-[#FF7A00] focus:bg-white/[0.08] transition-all font-mono"
              />
              <Button size="lg" variant="primary" type="submit" disabled={!meetingInput.trim()} className="cursor-pointer">
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

            <div className="rounded-3xl border border-[#0066FF]/25 bg-[#091222]/85 backdrop-blur-2xl p-4 sm:p-6 shadow-2xl shadow-[#001030]/80 relative overflow-hidden group glow-border">
              {/* Fake Chrome / Address Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block shadow-sm shadow-rose-500/50" />
                  <span className="h-3 w-3 rounded-full bg-[#FF7A00]/80 inline-block shadow-sm shadow-orange-500/50" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block shadow-sm shadow-emerald-500/50" />
                  <span className="text-xs text-gray-400 font-mono ml-3 px-3 py-1 rounded-lg bg-black/40 border border-white/[0.06] hidden sm:inline">
                    https://metromeet.metronet.internal/meeting/executive-boardroom
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="blue" dot>
                    1080p HD • 60 FPS
                  </Badge>
                  <span className="text-xs font-mono text-gray-400 hidden sm:inline">00:34:12</span>
                </div>
              </div>

              {/* Video Grid Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
                {/* Tile 1: Host Speaking with Active Sound Waves */}
                <div className="relative aspect-video rounded-2xl bg-gradient-to-br from-[#0A162D] via-[#0E2042] to-[#091222] border-2 border-[#0066FF] shadow-xl shadow-[#0066FF]/25 flex items-center justify-center overflow-hidden">
                  <div className="text-center space-y-3">
                    <div className="relative inline-block">
                      <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-[#0057B7] to-[#FF7A00] border-2 border-white/30 flex items-center justify-center mx-auto text-white font-black text-2xl shadow-xl shadow-[#0066FF]/40">
                        MN
                      </div>
                      <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-emerald-400 border-2 border-[#0E2042]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">MetroNet Host</p>
                      <p className="text-[11px] text-[#388BFF] font-medium">Infrastructure Architect (Host)</p>
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
                    <Badge variant="orange" className="bg-black/60 backdrop-blur">
                      Screen Share Live
                    </Badge>
                  </div>
                </div>

                {/* Tile 2: Participant */}
                <div className="relative aspect-video rounded-2xl bg-gradient-to-br from-[#121E36] via-[#0E1A30] to-[#091222] border border-white/[0.08] flex items-center justify-center overflow-hidden">
                  <div className="text-center space-y-3">
                    <div className="relative inline-block">
                      <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-[#FF7A00] to-[#E65100] border-2 border-white/30 flex items-center justify-center mx-auto text-white font-extrabold text-2xl shadow-xl shadow-orange-600/30">
                        SM
                      </div>
                      <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-emerald-400 border-2 border-[#0E1A30]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Sarah Miller</p>
                      <p className="text-[11px] text-gray-400">Head of Operations</p>
                    </div>
                  </div>

                  <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur px-2.5 py-1 rounded-xl border border-white/10">
                    <Mic className="h-3.5 w-3.5 text-emerald-400" />
                    <Camera className="h-3.5 w-3.5 text-[#388BFF]" />
                  </div>
                </div>
              </div>

              {/* Fake Meeting Controls Toolbar */}
              <div className="pt-2 flex items-center justify-between border-t border-white/[0.08]">
                <div className="hidden sm:flex items-center gap-2">
                  <Badge variant="blue" dot>
                    Waiting Room Secure
                  </Badge>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 mx-auto">
                  <button
                    onClick={() => setIsDemoMuted(!isDemoMuted)}
                    className={`h-10 w-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                      isDemoMuted
                        ? 'bg-rose-600 text-white'
                        : 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
                    }`}
                  >
                    {isDemoMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>

                  <button
                    onClick={() => setIsDemoCamOn(!isDemoCamOn)}
                    className={`h-10 w-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                      !isDemoCamOn
                        ? 'bg-rose-600 text-white'
                        : 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
                    }`}
                  >
                    {isDemoCamOn ? <Camera className="h-4 w-4" /> : <Camera className="h-4 w-4 text-rose-300" />}
                  </button>

                  <div className="h-10 w-10 rounded-2xl bg-[#0066FF] text-white flex items-center justify-center shadow-lg shadow-[#0066FF]/30">
                    <MonitorUp className="h-4 w-4" />
                  </div>

                  {/* Reaction trigger pill */}
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-2xl bg-white/[0.08] border border-white/[0.08]">
                    {['👏', '🔥', '👍'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => triggerReaction(emoji)}
                        className="text-base hover:scale-125 transition-transform p-1 cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleStartInstant}
                    className="h-10 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer"
                  >
                    <span>Leave</span>
                  </button>
                </div>

                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 font-mono">Mesh: 2 Peers</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12 w-full">
          <div className="text-center space-y-3 mb-16">
            <Badge variant="orange">Enterprise Grade Features</Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Why Global Enterprises Choose MetroMeet
            </h2>
            <p className="text-sm text-gray-400 max-w-xl mx-auto">
              Engineered with zero compromises on security, latency, and participant governance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-3xl bg-[#091222]/80 border border-[#0066FF]/20 backdrop-blur-xl shadow-xl space-y-4 hover:border-[#FF7A00]/40 transition-all group">
              <div className="h-12 w-12 rounded-2xl bg-[#FF7A00]/15 border border-[#FF7A00]/30 text-[#FFA033] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Knock & Waiting Room Approval</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Host admission controls with melodic calling ringtones, instant knock alerts, and 1-click batch admission for corporate privacy.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-[#091222]/80 border border-[#0066FF]/20 backdrop-blur-xl shadow-xl space-y-4 hover:border-[#0066FF]/50 transition-all group">
              <div className="h-12 w-12 rounded-2xl bg-[#0066FF]/15 border border-[#0066FF]/30 text-[#388BFF] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Direct WebRTC P2P Mesh</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Peer-to-peer WebRTC streaming with Google STUN pool optimization ensuring ultra-low &lt;20ms packet latency.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-[#091222]/80 border border-[#0066FF]/20 backdrop-blur-xl shadow-xl space-y-4 hover:border-[#FF7A00]/40 transition-all group">
              <div className="h-12 w-12 rounded-2xl bg-[#FF7A00]/15 border border-[#FF7A00]/30 text-[#FFA033] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Host Controls & Governance</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Mute individual, 1-click Mute All, hand-raising arbitration, Co-Host privilege delegations, and instant room locking.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Corporate Certification Footer */}
      <footer className="border-t border-[#0066FF]/20 bg-[#050a14] py-8 text-center text-xs text-gray-400 relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <BrandLogo size="sm" showTagline={false} />
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-[11px] text-gray-500">
            <span className="font-semibold text-gray-300">MetroNet — We Do IT</span>
            <span>•</span>
            <span>ISO 9001:2008 Certified Company</span>
            <span>•</span>
            <span>High-Speed Optical Backbone Video Infrastructure</span>
          </div>
          <p className="text-[11px] text-gray-500">© 2026 MetroNet Bangladesh. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
