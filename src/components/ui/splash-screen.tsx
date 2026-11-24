'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { soundEngine } from '@/lib/audio/sound-engine';

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [phase, setPhase] = useState<'init' | 'draw' | 'ready'>('init');

  const runIntro = useCallback((force = false) => {
    if (!force && typeof window !== 'undefined') {
      try {
        if (sessionStorage.getItem('metromeet_intro_seen') === '1') {
          setVisible(false);
          return () => {};
        }
        sessionStorage.setItem('metromeet_intro_seen', '1');
      } catch {}
    }

    setVisible(true);
    setFading(false);
    setPhase('init');

    const t1 = setTimeout(() => setPhase('draw'), 80);
    const t2 = setTimeout(() => setPhase('ready'), 420);
    const t3 = setTimeout(() => setFading(true), 1250);
    const t4 = setTimeout(() => setVisible(false), 1650);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  useEffect(() => {
    const cleanup = runIntro(false);
    const handleReplay = () => {
      runIntro(true);
    };
    window.addEventListener('metromeet:play-splash', handleReplay);
    return () => {
      cleanup();
      window.removeEventListener('metromeet:play-splash', handleReplay);
    };
  }, [runIntro]);

  const dismiss = () => {
    soundEngine.playIntroChime();
    setFading(true);
    setTimeout(() => setVisible(false), 260);
  };

  if (!visible) return null;

  return (
    <div
      onClick={dismiss}
      className={`fixed inset-0 z-[9999] bg-[#f8fafc] dark:bg-[#09090b] flex flex-col items-center justify-center select-none cursor-pointer transition-all duration-400 ease-out ${
        fading ? 'opacity-0 scale-[1.03] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Subtle Ambient Brand Glow */}
      <div className="absolute w-[420px] h-[220px] bg-gradient-to-r from-blue-500/12 via-sky-400/10 to-orange-500/10 rounded-full blur-[90px] pointer-events-none" />

      {/* 3D Animated Brand Lockup */}
      <div className="relative flex flex-col items-center text-center z-10 px-6" style={{ perspective: '800px' }}>
        <div
          className={`relative pt-7 pb-2 transition-all duration-600 ease-out ${
            phase === 'init'
              ? 'opacity-0 translate-y-4 scale-90'
              : 'opacity-100 translate-y-0 scale-100'
          }`}
        >
          {/* Smooth 3D Animated Orange Swoosh Arc */}
          <svg
            className="overflow-visible absolute top-0 left-1/2 -translate-x-1/2 w-56 sm:w-64 pointer-events-none"
            height="34"
            viewBox="0 0 240 34"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ filter: 'drop-shadow(0 4px 10px rgba(255, 122, 0, 0.42))' }}
          >
            <path
              d="M 12 30 Q 120 -6 228 30"
              stroke="url(#intro-3d-arc-grad)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="260"
              strokeDashoffset={phase === 'init' ? '260' : '0'}
              style={{
                transition: 'stroke-dashoffset 0.75s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
            <defs>
              <linearGradient id="intro-3d-arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FF8A1E" />
                <stop offset="50%" stopColor="#FF7A00" />
                <stop offset="100%" stopColor="#EA580C" />
              </linearGradient>
            </defs>
          </svg>

          {/* 3D Extruded Wordmark */}
          <div className="flex items-center justify-center tracking-tight font-black italic text-4xl sm:text-6xl">
            <span
              className="text-[#0066FF] dark:text-[#3B82F6]"
              style={{
                textShadow: '0 2px 0 #0047B3, 0 3px 0 #003A94, 0 8px 18px rgba(0, 102, 255, 0.32)',
              }}
            >
              Metro
            </span>
            <span
              className="text-[#0f172a] dark:text-white ml-1"
              style={{
                textShadow: '0 2px 0 rgba(15, 23, 42, 0.25), 0 6px 14px rgba(15, 23, 42, 0.16)',
              }}
            >
              Meet
            </span>
            <span
              className="ml-2.5 px-2.5 py-0.5 text-xs sm:text-sm not-italic font-extrabold tracking-widest rounded-lg bg-gradient-to-b from-[#FF8C1A] via-[#FF7300] to-[#E65100] text-white uppercase"
              style={{
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 3px 0 #b83d00, 0 8px 18px rgba(255,115,0,0.38)',
              }}
            >
              PRO
            </span>
          </div>
        </div>

        {/* Exact Tagline Reveal */}
        <div
          className={`flex items-center gap-1.5 mt-1 text-xs sm:text-sm transition-all duration-500 delay-100 ${
            phase === 'ready' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-bold text-blue-600 dark:text-[#3B82F6] italic tracking-wide">
            We Do <span className="font-black text-[#FF7A00]">IT</span>
          </span>
          <span className="text-slate-300 dark:text-zinc-600">|</span>
          <span className="text-slate-500 dark:text-zinc-400 font-medium tracking-tight">
            Enterprise Vedio Infrastructure
          </span>
        </div>

        {/* Sleek 2px Progress Hairline */}
        <div className="mt-6 w-44 h-[2px] rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-orange-500 transition-all duration-1000 ease-out"
            style={{ width: phase === 'init' ? '8%' : phase === 'draw' ? '68%' : '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
