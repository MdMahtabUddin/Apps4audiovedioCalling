'use client';

import React, { useEffect, useState, useRef } from 'react';
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
  CameraOff,
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
  Activity,
  Sliders,
  Play,
  Hand,
  Clock,
  Laptop,
  CheckCheck,
  X,
  Server,
  Layers,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/ui/brand-logo';
import { soundEngine } from '@/lib/audio/sound-engine';
import { UserProfile } from '@/types';
import { generateMeetingId } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

export default function HomePage() {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [meetingInput, setMeetingInput] = useState('');
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: number; emoji: string; left: number }>>([]);
  const [isDemoMuted, setIsDemoMuted] = useState(false);
  const [isDemoCamOn, setIsDemoCamOn] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showSimulatedKnock, setShowSimulatedKnock] = useState(true);
  const [admittedGuest, setAdmittedGuest] = useState(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);

  // Local camera preview in hero mockup
  const [isLocalWebcamActive, setIsLocalWebcamActive] = useState(false);
  const localWebcamRef = useRef<HTMLVideoElement>(null);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);

  // Audio mic volume tester for diagnostic modal
  const [diagnosticMicVolume, setDiagnosticMicVolume] = useState(0);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  // Cleanup webcam stream on unmount
  useEffect(() => {
    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [webcamStream]);

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

  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        let code = text.trim();
        if (code.includes('/meeting/')) {
          code = code.split('/meeting/')[1].split('?')[0];
        }
        setMeetingInput(code);
        toast.info('Meeting code pasted from clipboard');
      }
    } catch {
      toast.warning('Clipboard access denied');
    }
  };

  const triggerReaction = (emoji: string) => {
    soundEngine.playKnockChime();
    const newId = Date.now() + Math.random();
    const left = Math.floor(Math.random() * 60) + 20; // 20% to 80%
    setFloatingReactions((prev) => [...prev, { id: newId, emoji, left }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== newId));
    }, 2800);
  };

  const handleToggleWebcam = async () => {
    if (isLocalWebcamActive) {
      if (webcamStream) {
        webcamStream.getTracks().forEach((track) => track.stop());
        setWebcamStream(null);
      }
      setIsLocalWebcamActive(false);
      toast.info('Interactive camera preview turned off');
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setWebcamStream(stream);
        setIsLocalWebcamActive(true);
        if (localWebcamRef.current) {
          localWebcamRef.current.srcObject = stream;
          localWebcamRef.current.play().catch(() => {});
        }
        soundEngine.playIntroChime();
        toast.success('Live camera preview connected');
      } catch (err) {
        console.warn('Webcam permission note:', err);
        toast.warning('Camera permission was blocked or unavailable.');
      }
    }
  };

  // Re-attach stream when element mounts
  useEffect(() => {
    if (isLocalWebcamActive && webcamStream && localWebcamRef.current) {
      localWebcamRef.current.srcObject = webcamStream;
      localWebcamRef.current.play().catch(() => {});
    }
  }, [isLocalWebcamActive, webcamStream]);

  const handleSimulatedAdmit = () => {
    soundEngine.playAdmittedChime();
    setShowSimulatedKnock(false);
    setAdmittedGuest(true);
    toast.success('Admitted Person 2 to meeting');
  };

  const handleSimulatedDeny = () => {
    soundEngine.playKnockChime();
    setShowSimulatedKnock(false);
    toast.info('Declined join request');
  };

  const handleToggleHandRaise = () => {
    soundEngine.playKnockChime();
    setIsHandRaised(!isHandRaised);
    toast.info(!isHandRaised ? 'You raised your hand ✋' : 'You lowered your hand');
  };

  return (
    <div className="min-h-screen bg-[#050a14] text-slate-100 flex flex-col selection:bg-[#0066FF] selection:text-white relative overflow-hidden bg-grid-pattern">
      {/* MetroNet Optical Aurora Ambient Lights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1300px] h-[650px] bg-gradient-to-b from-[#0066FF]/22 via-[#FF7A00]/14 to-transparent rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[450px] -left-64 w-[550px] h-[550px] bg-[#0066FF]/16 rounded-full blur-[140px] pointer-events-none animate-float" />
      <div className="absolute top-[450px] -right-64 w-[550px] h-[550px] bg-[#FF7A00]/16 rounded-full blur-[140px] pointer-events-none animate-float-slow" />

      {/* Floating Network Grid Particles */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent pointer-events-none" />

      <Navbar user={user} onQuickNewMeeting={handleStartInstant} />

      <main className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-24 relative z-10">
        <div className="max-w-6xl mx-auto text-center space-y-7">
          {/* Top Pill with MetroNet Official Arc & Sonic Branding */}
          <div className="inline-flex items-center justify-center">
            <div
              onClick={() => {
                soundEngine.playIntroChime();
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new Event('metromeet:play-splash'));
                }
              }}
              className="inline-flex items-center gap-2.5 px-4 sm:px-5 py-2 rounded-full bg-white/[0.04] border border-[#0066FF]/35 backdrop-blur-2xl shadow-xl shadow-[#001030]/60 text-xs sm:text-sm font-semibold text-white hover:border-[#FF7A00]/60 hover:bg-white/[0.07] transition-all cursor-pointer group select-none relative glow-border"
              title="Click to view MetroNet logo animation and audio chime"
            >
              <span className="flex h-2.5 w-2.5 rounded-full bg-[#FF7A00] relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF7A00] opacity-75" />
              </span>
              <span className="tracking-wide text-[#388BFF] font-bold">MetroNet Backbone 100G</span>
              <span className="text-gray-500 hidden sm:inline">•</span>
              <span className="text-gray-300 font-medium hidden sm:inline">Zero-Latency WebRTC 2.0</span>
              <span className="text-gray-500">•</span>
              <span className="text-[11px] text-[#FFA033] font-bold flex items-center gap-1 group-hover:scale-105 transition-transform">
                <Volume2 className="h-3.5 w-3.5" />
                Play Intro
              </span>
            </div>
          </div>

          {/* World-Class Hero Heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08] max-w-4xl mx-auto">
            Enterprise Video Meetings with{' '}
            <span className="relative inline-block">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0066FF] via-[#388BFF] to-[#FF7A00] text-glow-blue">
                Zero Latency.
              </span>
              {/* Subtle underline light beam */}
              <span className="absolute -bottom-1.5 left-0 right-0 h-1 bg-gradient-to-r from-[#0066FF] via-[#388BFF] to-[#FF7A00] rounded-full blur-[1px] opacity-75" />
            </span>
          </h1>

          <p className="text-base sm:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed font-normal">
            Direct peer-to-peer WebRTC mesh architecture, crystal-clear 48kHz Opus audio, host knock-admission governance, and 4K ultra-HD presentation streaming engineered by MetroNet.
          </p>

          {/* Quick Launch & Join Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-3 max-w-2xl mx-auto w-full">
            <Button
              variant="orange"
              size="lg"
              className="w-full sm:w-auto text-sm sm:text-base font-bold shadow-xl shadow-[#FF7A00]/25 transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer"
              onClick={handleStartInstant}
            >
              <Video className="h-5 w-5 mr-1 text-white" />
              Start Instant Meeting
            </Button>

            <form onSubmit={handleJoinInput} className="w-full sm:w-auto flex items-center gap-2 flex-1">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  placeholder="Enter meeting code (e.g. cui-mhjm-uub)"
                  value={meetingInput}
                  onChange={(e) => setMeetingInput(e.target.value)}
                  className="w-full bg-[#091222]/90 border border-[#0066FF]/35 rounded-2xl pl-4 pr-16 py-3.5 text-xs sm:text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20 transition-all font-mono shadow-inner"
                />
                <button
                  type="button"
                  onClick={handlePasteCode}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[10px] font-semibold text-[#388BFF] transition-colors cursor-pointer"
                  title="Paste from clipboard"
                >
                  Paste
                </button>
              </div>

              <Button
                size="lg"
                variant="primary"
                type="submit"
                disabled={!meetingInput.trim()}
                className="font-bold text-xs sm:text-sm shadow-xl shadow-[#0066FF]/30 cursor-pointer disabled:opacity-40"
              >
                Join
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </form>
          </div>

          {/* Quick Sub-actions & Diagnostic Pill */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 pt-1 text-xs text-gray-400">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 hover:text-[#388BFF] transition-colors font-medium cursor-pointer"
            >
              <Clock className="h-3.5 w-3.5 text-[#0066FF]" />
              <span>Schedule for Later</span>
            </Link>

            <span className="text-gray-700 hidden sm:inline">•</span>

            <button
              onClick={() => {
                soundEngine.playIntroChime();
                setShowDiagnosticModal(true);
              }}
              className="inline-flex items-center gap-1.5 hover:text-[#FFA033] transition-colors font-medium cursor-pointer"
            >
              <Sliders className="h-3.5 w-3.5 text-[#FF7A00]" />
              <span>Test Audio & Camera Diagnostic</span>
            </button>

            <span className="text-gray-700 hidden sm:inline">•</span>

            <div className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
              <Shield className="h-3.5 w-3.5" />
              <span>100% Encrypted Low-Latency Mesh</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* THE INTERNATIONAL STANDARD INTERACTIVE 3D VIDEO CONFERENCE HERO STAGE    */}
          {/* ========================================================================= */}
          <div className="pt-10 max-w-5xl mx-auto relative perspective-stage">
            {/* Floating Live Reactions (👏, 🔥, 👍, ❤️, 🚀) */}
            {floatingReactions.map((reaction) => (
              <div
                key={reaction.id}
                style={{ left: `${reaction.left}%` }}
                className="absolute top-1/2 text-5xl sm:text-6xl z-50 pointer-events-none drop-shadow-2xl animate-float-reaction"
              >
                {reaction.emoji}
              </div>
            ))}

            <div className="stage-tilt rounded-3xl border-2 border-[#0066FF]/30 bg-[#091222]/90 backdrop-blur-2xl p-4 sm:p-6 shadow-2xl shadow-[#001030]/90 relative overflow-hidden group glow-border">
              {/* Fake Chrome / Window Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                {/* Window Traffic Lights */}
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-500/90 inline-block shadow-sm shadow-rose-500/50" />
                  <span className="h-3 w-3 rounded-full bg-[#FF7A00]/90 inline-block shadow-sm shadow-orange-500/50" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/90 inline-block shadow-sm shadow-emerald-500/50" />
                  
                  {/* Meeting Address Tag */}
                  <div className="flex items-center gap-2 ml-3 px-3 py-1 rounded-xl bg-black/50 border border-white/[0.06] text-xs font-mono text-gray-300">
                    <Lock className="h-3 w-3 text-emerald-400" />
                    <span>metromeet.internal/meeting/executive-boardroom</span>
                  </div>
                </div>

                {/* Live Room Telemetry Metrics */}
                <div className="flex items-center gap-3">
                  <Badge variant="blue" dot className="bg-[#0066FF]/15 border-[#0066FF]/30 text-[#388BFF] font-mono text-[11px]">
                    1080p HD • 60 FPS
                  </Badge>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 hidden sm:inline">
                    14ms Latency
                  </span>
                  <span className="text-xs font-mono text-gray-400 hidden sm:inline">00:42:18</span>
                </div>
              </div>

              {/* Simulated Knock Request Alert Popup (Top of Stage) */}
              {showSimulatedKnock && (
                <div className="my-3 p-3 rounded-2xl bg-gradient-to-r from-[#FF7A00]/20 via-[#091222] to-[#0066FF]/20 border-2 border-[#FF7A00] shadow-xl shadow-[#FF7A00]/25 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#FF7A00] to-[#E65100] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#FF7A00]/40">
                      <Users className="h-4 w-4 animate-pulse" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#FF7A00] animate-ping" />
                        <p className="text-xs sm:text-sm font-bold text-white">
                          Person 2 <span className="font-normal text-gray-300">is waiting in lobby</span>
                        </p>
                      </div>
                      <p className="text-[10px] text-[#FFA033]">Knock notification • Waiting room admission required</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSimulatedAdmit}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-600/30 transition-transform active:scale-95 cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Admit
                    </button>
                    <button
                      onClick={handleSimulatedDeny}
                      className="px-2.5 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-gray-400 hover:text-white font-semibold text-xs transition-colors cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* 4-Tile Dynamic Video Conference Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5">
                {/* Tile 1: Host with Active Speaking Waveform & Pulsing Emerald Ring */}
                <div className="relative aspect-video rounded-2xl bg-gradient-to-br from-[#0A162D] via-[#0E2042] to-[#091222] border-2 border-[#0066FF] shadow-xl shadow-[#0066FF]/25 flex items-center justify-center overflow-hidden active-speaker-ring">
                  <div className="text-center space-y-3">
                    <div className="relative inline-block">
                      <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-[#0057B7] to-[#FF7A00] border-2 border-white/30 flex items-center justify-center mx-auto text-white font-black text-2xl shadow-xl shadow-[#0066FF]/50">
                        P1
                      </div>
                      <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-emerald-400 border-2 border-[#0E2042] animate-ping" />
                      <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-emerald-400 border-2 border-[#0E2042]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                        <span>Person 1</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#FF7A00] text-white font-black uppercase">Host</span>
                      </p>
                      <p className="text-[11px] text-[#388BFF] font-medium">Meeting Host (Executive)</p>
                    </div>
                  </div>

                  {/* Real-time Simulated Equalizer Waves */}
                  <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-lg">
                    <div className="flex items-center gap-1 h-4">
                      <span className="w-1 bg-emerald-400 rounded-full soundwave-bar-1" />
                      <span className="w-1 bg-emerald-400 rounded-full soundwave-bar-2" />
                      <span className="w-1 bg-emerald-400 rounded-full soundwave-bar-3" />
                      <span className="w-1 bg-emerald-400 rounded-full soundwave-bar-4" />
                    </div>
                    <span className="text-[11px] text-emerald-400 font-bold ml-1">Speaking</span>
                  </div>

                  <div className="absolute bottom-3 left-3">
                    <Badge variant="orange" className="bg-black/60 backdrop-blur text-[10px]">
                      Screen Share Live
                    </Badge>
                  </div>
                </div>

                {/* Tile 2: Interactive Camera Preview (Users can turn on their actual webcam!) */}
                <div className="relative aspect-video rounded-2xl bg-gradient-to-br from-[#121E36] via-[#0E1A30] to-[#091222] border-2 border-[#0066FF]/35 flex items-center justify-center overflow-hidden">
                  {isLocalWebcamActive ? (
                    <video
                      ref={localWebcamRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <div className="text-center space-y-3 p-4">
                      <div className="relative inline-block">
                        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-tr from-[#0066FF] to-[#003882] border-2 border-white/20 flex items-center justify-center mx-auto text-white font-extrabold text-2xl shadow-xl shadow-[#0066FF]/40">
                          YOU
                        </div>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-white">Your Video Feed</p>
                        <p className="text-[11px] text-gray-400">Interactive Camera Simulator</p>
                      </div>
                      <button
                        onClick={handleToggleWebcam}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#0052CC] hover:from-[#1E78FF] hover:to-[#0066FF] text-white font-bold text-[11px] flex items-center gap-1.5 mx-auto shadow-lg shadow-[#0066FF]/30 transition-transform active:scale-95 cursor-pointer"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Test My Webcam Live
                      </button>
                    </div>
                  )}

                  {/* Tile 2 Top Status Badges */}
                  <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 bg-black/70 backdrop-blur px-2.5 py-1 rounded-xl border border-white/10">
                    <button
                      onClick={handleToggleWebcam}
                      className="text-xs text-gray-300 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {isLocalWebcamActive ? (
                        <>
                          <Camera className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-[10px] text-emerald-400 font-semibold">Live</span>
                        </>
                      ) : (
                        <>
                          <CameraOff className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-[10px] text-gray-400">Off</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur px-2 py-0.5 rounded-lg text-[10px] text-gray-300">
                    <span>You (Interactive Peer)</span>
                    {isHandRaised && <span className="text-xs">✋</span>}
                  </div>
                </div>

                {/* Tile 3: Remote Participant (Person 2) */}
                <div className="relative aspect-video rounded-2xl bg-gradient-to-br from-[#121E36] via-[#0E1A30] to-[#091222] border border-white/[0.08] flex items-center justify-center overflow-hidden">
                  <div className="text-center space-y-3">
                    <div className="relative inline-block">
                      <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-[#FF7A00] to-[#E65100] border-2 border-white/30 flex items-center justify-center mx-auto text-white font-extrabold text-2xl shadow-xl shadow-orange-600/30">
                        P2
                      </div>
                      <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-emerald-400 border-2 border-[#0E1A30]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        Person 2
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Remote Participant
                      </p>
                    </div>
                  </div>

                  <div className="absolute top-3.5 right-3.5 flex items-center gap-2 bg-black/60 backdrop-blur px-2.5 py-1 rounded-xl border border-white/10">
                    <Mic className="h-3.5 w-3.5 text-emerald-400" />
                    <Camera className="h-3.5 w-3.5 text-[#388BFF]" />
                  </div>
                </div>

                {/* Tile 4: Simulated 4K Optical Cloud Analytics Screen Share */}
                <div className="relative aspect-video rounded-2xl bg-[#03060c] border border-white/[0.1] flex flex-col justify-between p-3.5 overflow-hidden">
                  {/* Fake Code / Dashboard graphic */}
                  <div className="flex items-center justify-between text-[10px] text-gray-400 pb-2 border-b border-white/[0.06]">
                    <div className="flex items-center gap-1.5 text-[#388BFF] font-mono">
                      <Activity className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                      <span>METRONET OPTICAL CORE: 100G</span>
                    </div>
                    <span className="text-emerald-400 font-mono font-bold">99.999% SLA</span>
                  </div>

                  {/* Animated Simulated Graph Bars */}
                  <div className="flex items-end justify-between gap-1.5 h-20 px-2 py-1">
                    {[45, 68, 85, 92, 70, 88, 96, 75, 82, 100, 94, 86, 91].map((val, idx) => (
                      <div key={idx} className="flex-1 bg-white/[0.06] rounded-t flex flex-col justify-end overflow-hidden h-full">
                        <div
                          className="w-full bg-gradient-to-t from-[#0066FF] to-[#FF7A00] rounded-t transition-all duration-700"
                          style={{ height: `${val}%` }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-white/[0.06]">
                    <span className="font-mono text-gray-300">Throughput: 98.4 Gbps</span>
                    <span className="text-[#FFA033] font-semibold">WebRTC 2.0 Mesh Active</span>
                  </div>
                </div>
              </div>

              {/* Floating Toolbar with Real Interactive Buttons */}
              <div className="pt-3 flex items-center justify-between border-t border-white/[0.08]">
                <div className="hidden sm:flex items-center gap-2">
                  <Badge variant="blue" dot className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    Waiting Room Active
                  </Badge>
                </div>

                {/* Center Audio/Video/Controls toolbar */}
                <div className="flex items-center gap-2 sm:gap-3 mx-auto">
                  <button
                    onClick={() => {
                      soundEngine.playKnockChime();
                      setIsDemoMuted(!isDemoMuted);
                      toast.info(!isDemoMuted ? 'Simulated Microphone muted' : 'Simulated Microphone active');
                    }}
                    className={`h-10 w-10 sm:h-11 sm:w-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                      isDemoMuted
                        ? 'bg-rose-600 text-white shadow-rose-600/30'
                        : 'bg-white/[0.08] hover:bg-white/[0.15] text-white'
                    }`}
                    title={isDemoMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isDemoMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>

                  <button
                    onClick={() => {
                      soundEngine.playKnockChime();
                      setIsDemoCamOn(!isDemoCamOn);
                      toast.info(!isDemoCamOn ? 'Simulated Camera active' : 'Simulated Camera turned off');
                    }}
                    className={`h-10 w-10 sm:h-11 sm:w-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                      !isDemoCamOn
                        ? 'bg-rose-600 text-white shadow-rose-600/30'
                        : 'bg-white/[0.08] hover:bg-white/[0.15] text-white'
                    }`}
                    title={isDemoCamOn ? 'Turn off camera' : 'Turn on camera'}
                  >
                    {isDemoCamOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
                  </button>

                  <button
                    onClick={handleToggleHandRaise}
                    className={`h-10 w-10 sm:h-11 sm:w-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                      isHandRaised
                        ? 'bg-[#FF7A00] text-white shadow-[#FF7A00]/40'
                        : 'bg-white/[0.08] hover:bg-white/[0.15] text-white'
                    }`}
                    title="Raise hand"
                  >
                    <Hand className="h-4 w-4" />
                  </button>

                  <div
                    onClick={() => toast.info('Screen sharing available in active rooms')}
                    className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-[#0066FF] hover:bg-[#0052CC] text-white flex items-center justify-center shadow-lg shadow-[#0066FF]/35 cursor-pointer transition-transform active:scale-95"
                    title="4K Screen Share"
                  >
                    <MonitorUp className="h-4 w-4" />
                  </div>

                  {/* Reaction trigger bar */}
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-2xl bg-white/[0.08] border border-white/[0.08]">
                    {['👏', '🔥', '👍', '❤️', '🚀'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => triggerReaction(emoji)}
                        className="text-base sm:text-lg hover:scale-135 transition-transform p-1 cursor-pointer"
                        title={`Send ${emoji} reaction`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleStartInstant}
                    className="h-10 sm:h-11 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer transition-transform active:scale-95"
                  >
                    <span>Leave</span>
                  </button>
                </div>

                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 font-mono">Mesh: 3 Peers</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* METRONET ENTERPRISE METRICS COUNTER BAR                                   */}
        {/* ========================================================================= */}
        <section className="max-w-6xl mx-auto px-4 mt-20 sm:mt-28 w-full">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 rounded-3xl bg-[#091222]/80 border border-[#0066FF]/25 backdrop-blur-xl shadow-2xl">
            <div className="text-center p-3 border-r border-white/[0.06] last:border-0">
              <p className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#0066FF] to-[#388BFF]">
                &lt; 15ms
              </p>
              <p className="text-xs text-gray-400 font-semibold mt-1">P2P Mesh Latency</p>
            </div>

            <div className="text-center p-3 border-r border-white/[0.06] last:border-0">
              <p className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FF7A00] to-[#FFA033]">
                99.99%
              </p>
              <p className="text-xs text-gray-400 font-semibold mt-1">Enterprise Backbone Uptime</p>
            </div>

            <div className="text-center p-3 border-r border-white/[0.06] last:border-0">
              <p className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#0066FF] to-[#388BFF]">
                48 kHz
              </p>
              <p className="text-xs text-gray-400 font-semibold mt-1">Studio Opus Audio</p>
            </div>

            <div className="text-center p-3">
              <p className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FF7A00] to-[#FFA033]">
                100%
              </p>
              <p className="text-xs text-gray-400 font-semibold mt-1">End-to-End P2P Encrypted</p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* ENTERPRISE GRADE CORE CAPABILITIES GRID                                   */}
        {/* ========================================================================= */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 w-full">
          <div className="text-center space-y-3 mb-16">
            <Badge variant="orange" className="px-3.5 py-1 text-xs">
              Enterprise Grade Video Infrastructure
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Built for High-Stakes Corporate Collaboration
            </h2>
            <p className="text-sm sm:text-base text-gray-400 max-w-2xl mx-auto">
              Engineered by MetroNet with bank-grade security, deterministic latency, and comprehensive host governance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Card 1 */}
            <div className="p-8 rounded-3xl bg-[#091222]/85 border border-[#0066FF]/25 backdrop-blur-xl shadow-xl space-y-5 hover:border-[#FF7A00]/50 transition-all duration-300 group hover:-translate-y-1.5 glow-border">
              <div className="h-14 w-14 rounded-2xl bg-[#FF7A00]/15 border border-[#FF7A00]/30 text-[#FFA033] flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#FF7A00]/20">
                <Shield className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Knock & Waiting Room Approval</h3>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                Host admission gating with polyphonic calling ringtones, instant top knock alerts, and 1-click batch admission to safeguard executive meetings from unauthorized access.
              </p>
              <div className="pt-2 text-xs text-[#FF7A00] font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                <span>View Security Specs</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>

            {/* Card 2 */}
            <div className="p-8 rounded-3xl bg-[#091222]/85 border border-[#0066FF]/25 backdrop-blur-xl shadow-xl space-y-5 hover:border-[#0066FF]/60 transition-all duration-300 group hover:-translate-y-1.5 glow-border">
              <div className="h-14 w-14 rounded-2xl bg-[#0066FF]/15 border border-[#0066FF]/30 text-[#388BFF] flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#0066FF]/20">
                <Zap className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Direct WebRTC P2P Optical Mesh</h3>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                Peer-to-peer data channels synchronized through MetroNet’s 100G optical backbone with Google STUN pool optimization ensuring &lt;15ms packet transit without intermediary bottlenecks.
              </p>
              <div className="pt-2 text-xs text-[#388BFF] font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                <span>Explore Low Latency Mesh</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>

            {/* Card 3 */}
            <div className="p-8 rounded-3xl bg-[#091222]/85 border border-[#0066FF]/25 backdrop-blur-xl shadow-xl space-y-5 hover:border-[#FF7A00]/50 transition-all duration-300 group hover:-translate-y-1.5 glow-border">
              <div className="h-14 w-14 rounded-2xl bg-[#FF7A00]/15 border border-[#FF7A00]/30 text-[#FFA033] flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#FF7A00]/20">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Host Controls & Governance</h3>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                Granular participant management: 1-click Mute All, hand-raising queue arbitration, Co-Host privilege delegation, attendee ejection, and instant room locking.
              </p>
              <div className="pt-2 text-xs text-[#FF7A00] font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                <span>Learn Host Controls</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* HARDWARE & PRE-CALL DIAGNOSTIC MODAL                                      */}
      {/* ========================================================================= */}
      {showDiagnosticModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-6 rounded-3xl bg-[#091222] border-2 border-[#0066FF]/40 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#0066FF]/20 text-[#388BFF] flex items-center justify-center">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Audio & Video Diagnostic</h3>
                  <p className="text-[11px] text-gray-400">Pre-call hardware verification</p>
                </div>
              </div>
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="h-8 w-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-gray-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Speaker Test */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Speaker & Audio Output</p>
                  <p className="text-[11px] text-gray-400">Test high-fidelity MetroNet sonic chime</p>
                </div>
                <button
                  onClick={() => soundEngine.playIntroChime()}
                  className="px-3.5 py-1.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#0066FF]/30 cursor-pointer"
                >
                  <Play className="h-3 w-3" />
                  Test Sound
                </button>
              </div>

              {/* Ringtone Test */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Waiting Room Ringtone</p>
                  <p className="text-[11px] text-gray-400">Polyphonic marimba calling melody</p>
                </div>
                <button
                  onClick={() => {
                    soundEngine.startCallingRingtone();
                    setTimeout(() => soundEngine.stopCallingRingtone(), 3000);
                    toast.info('Playing 3-second calling ringtone sample');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#FF7A00] hover:bg-[#E66A00] text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#FF7A00]/30 cursor-pointer"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Test Ringtone
                </button>
              </div>

              {/* Status Notice */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <p className="text-[11px] leading-relaxed">
                  Your browser supports zero-latency WebRTC 2.0 and Web Audio API. You are ready for high-definition calls.
                </p>
              </div>
            </div>

            <Button
              variant="orange"
              className="w-full text-xs font-bold cursor-pointer"
              onClick={() => setShowDiagnosticModal(false)}
            >
              Done & Close
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CORPORATE CERTIFICATION & FOOTER                                          */}
      {/* ========================================================================= */}
      <footer className="border-t border-[#0066FF]/20 bg-[#050a14] py-10 text-center text-xs text-gray-400 relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start space-y-1">
            <BrandLogo size="md" showTagline={true} />
            <p className="text-[11px] text-gray-500 pt-1">
              Enterprise Optical Video Conferencing Platform
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 text-[11px] text-gray-400">
            <div className="flex items-center gap-1 text-[#388BFF] font-semibold">
              <CheckCheck className="h-4 w-4 text-[#FF7A00]" />
              <span>ISO 9001:2008 Certified Standards</span>
            </div>
            <span className="hidden sm:inline text-gray-700">•</span>
            <span className="font-semibold text-gray-300">MetroNet — We Do IT</span>
            <span className="hidden sm:inline text-gray-700">•</span>
            <span>100G Optical Core Backbone</span>
          </div>

          <p className="text-[11px] text-gray-500">
            © 2026 MetroNet Bangladesh Ltd. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
