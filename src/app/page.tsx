'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Video,
  Shield,
  Zap,
  MonitorUp,
  ArrowRight,
  Mic,
  Camera,
  MessageSquare,
  Users,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Badge } from '@/components/ui/badge';
import { UserProfile } from '@/types';

export default function HomePage() {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      <Navbar user={user} />

      <main className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-16 sm:py-24 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-300">
            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
            Next-Gen WebRTC Video Conferencing Engine
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
            Flawless Video Meetings. <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-200">
              Zero Latency. Total Control.
            </span>
          </h1>

          <p className="text-sm sm:text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Experience real-time WebRTC audio & video communication with mesh peer traversal, high-definition screen sharing, and secure room management in pure browser technology.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            {user ? (
              <Link
                href="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-xl shadow-indigo-600/25 transition-all hover:scale-105 gap-2"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-xl shadow-indigo-600/25 transition-all hover:scale-105 gap-2"
                >
                  Start Meeting for Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3.5 rounded-2xl bg-gray-900/80 hover:bg-gray-800 text-gray-200 font-semibold border border-gray-800 transition-all hover:scale-105 gap-2"
                >
                  Sign In to MeetFlow
                </Link>
              </>
            )}
          </div>

          {/* Interactive UI Mockup Illustration */}
          <div className="pt-12 max-w-4xl mx-auto">
            <div className="rounded-3xl border border-gray-800/80 bg-gradient-to-b from-gray-900/90 to-gray-950 p-4 sm:p-6 shadow-2xl shadow-indigo-950/40 relative">
              {/* Fake Meeting Interface Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-800/80">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
                  <span className="text-xs text-gray-400 font-mono ml-2">meetflow.app/meeting/abc-defg-hij</span>
                </div>
                <Badge variant="success" dot>
                  Encrypted P2P
                </Badge>
              </div>

              {/* Video Mockup Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
                <div className="relative aspect-video rounded-2xl bg-gradient-to-br from-indigo-950/50 to-gray-900 border border-indigo-500/30 flex items-center justify-center overflow-hidden">
                  <div className="text-center space-y-2">
                    <div className="h-16 w-16 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center mx-auto text-indigo-300 font-bold text-lg">
                      AJ
                    </div>
                    <p className="text-xs font-semibold text-white">Alex Johnson (Host)</p>
                  </div>
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <Badge variant="indigo" className="bg-black/60 backdrop-blur">
                      Speaking
                    </Badge>
                  </div>
                </div>

                <div className="relative aspect-video rounded-2xl bg-gradient-to-br from-purple-950/50 to-gray-900 border border-purple-500/30 flex items-center justify-center overflow-hidden">
                  <div className="text-center space-y-2">
                    <div className="h-16 w-16 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center mx-auto text-purple-300 font-bold text-lg">
                      SM
                    </div>
                    <p className="text-xs font-semibold text-white">Sarah Miller</p>
                  </div>
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <Badge variant="default" className="bg-black/60 backdrop-blur">
                      Participant
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Floating Meeting Controls Pill Mockup */}
              <div className="flex items-center justify-center gap-3 p-2 bg-gray-950/80 border border-gray-800 rounded-2xl max-w-md mx-auto shadow-xl">
                <div className="h-9 w-9 rounded-xl bg-gray-800 text-gray-300 flex items-center justify-center">
                  <Mic className="h-4 w-4" />
                </div>
                <div className="h-9 w-9 rounded-xl bg-gray-800 text-gray-300 flex items-center justify-center">
                  <Camera className="h-4 w-4" />
                </div>
                <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <MonitorUp className="h-4 w-4" />
                </div>
                <div className="h-9 w-9 rounded-xl bg-gray-800 text-gray-300 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="h-9 w-9 rounded-xl bg-red-600 text-white flex items-center justify-center">
                  <Video className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-16 text-left">
            <div className="p-6 rounded-2xl bg-gray-900/40 border border-gray-800/80 backdrop-blur space-y-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Direct WebRTC Mesh</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Direct peer-to-peer real-time audio and video with adaptive resolution and STUN/TURN NAT traversal.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-gray-900/40 border border-gray-800/80 backdrop-blur space-y-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center border border-violet-500/20">
                <MonitorUp className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-white">4K Screen Sharing</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Share entire screens, application windows, or browser tabs with instant camera track failover.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-gray-900/40 border border-gray-800/80 backdrop-blur space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Host Security Controls</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Waiting room admission, participant mute/removal, role permissions, and room lock mechanisms.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-800/80 py-6 text-center text-xs text-gray-500">
        <p>© 2026 MeetFlow. Production-ready real-time video communication platform.</p>
      </footer>
    </div>
  );
}
