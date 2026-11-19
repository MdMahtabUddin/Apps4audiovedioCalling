'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { soundEngine } from '@/lib/audio/sound-engine';

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [arcDrawn, setArcDrawn] = useState(false);

  const startAnimation = useCallback(() => {
    setVisible(true);
    setFading(false);
    setArcDrawn(false);

    // Trigger arc drawing after brief delay
    const timerArc = setTimeout(() => {
      setArcDrawn(true);
      soundEngine.playIntroChime();
    }, 150);

    // Fade out after 2.2 seconds
    const timerFade = setTimeout(() => {
      setFading(true);
    }, 2200);

    // Complete transition and hide
    const timerEnd = setTimeout(() => {
      setVisible(false);
    }, 2800);

    return () => {
      clearTimeout(timerArc);
      clearTimeout(timerFade);
      clearTimeout(timerEnd);
    };
  }, []);

  useEffect(() => {
    // Check if user came from a meeting link or landing
    const cleanup = startAnimation();

    // Listen for custom trigger event (e.g. clicking logo in navbar or footer)
    const handleReplay = () => {
      startAnimation();
    };
    window.addEventListener('metromeet:play-splash', handleReplay);

    return () => {
      cleanup();
      window.removeEventListener('metromeet:play-splash', handleReplay);
    };
  }, [startAnimation]);

  const dismiss = () => {
    soundEngine.playIntroChime();
    setFading(true);
    setTimeout(() => setVisible(false), 400);
  };

  if (!visible) return null;

  return (
    <div
      onClick={dismiss}
      className={`fixed inset-0 z-[9999] bg-[#050a14] flex flex-col items-center justify-center select-none cursor-pointer transition-all duration-700 ${
        fading ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Radiant MetroNet Aurora Background Glow */}
      <div className="absolute w-[600px] h-[600px] bg-gradient-to-tr from-[#0066FF]/25 via-[#FF7A00]/20 to-transparent rounded-full blur-[120px] pointer-events-none animate-pulse" />

      {/* Center Cinematic Brand Reveal */}
      <div className="relative flex flex-col items-center text-center space-y-7 z-10 px-4">
        {/* Animated Arc Swoosh & Wordmark */}
        <div className="relative px-8 py-5">
          {/* Laser-animated Orange Arc Curve from MetroNet Logo */}
          <svg
            className="overflow-visible absolute -top-8 sm:-top-9 left-1/2 -translate-x-1/2 w-72 sm:w-80 pointer-events-none"
            height="44"
            viewBox="0 0 280 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M 12 40 Q 140 -8 268 40"
              stroke="url(#splash-arc-gradient)"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeDasharray="300"
              strokeDashoffset={arcDrawn ? '0' : '300'}
              style={{
                transition: 'stroke-dashoffset 1.1s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              className="drop-shadow-[0_0_18px_rgba(255,122,0,0.95)]"
            />
            <defs>
              <linearGradient id="splash-arc-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FF7A00" />
                <stop offset="50%" stopColor="#FFA033" />
                <stop offset="100%" stopColor="#FF5500" />
              </linearGradient>
            </defs>
          </svg>

          {/* MetroMeet Wordmark Typography */}
          <div className="flex items-baseline tracking-tight font-black italic text-5xl sm:text-7xl pt-2 animate-in fade-in zoom-in-95 duration-500">
            <span className="text-[#0066FF] drop-shadow-[0_0_35px_rgba(0,102,255,0.85)]">
              Metro
            </span>
            <span className="text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.4)] ml-1 sm:ml-2">
              Meet
            </span>
            <span className="ml-2 sm:ml-3 px-2.5 py-0.5 text-xs sm:text-sm not-italic font-black tracking-widest rounded-lg bg-gradient-to-r from-[#FF7A00] to-[#E65100] text-white shadow-xl shadow-[#FF7A00]/50 uppercase">
              Pro
            </span>
          </div>

          {/* Official MetroNet Tagline */}
          <div className="flex items-center justify-center gap-2.5 mt-3 animate-in fade-in duration-700 delay-300">
            <span className="text-xs sm:text-sm font-black text-[#0066FF] italic tracking-wider">
              We Do <span className="font-black text-[#FF7A00]">IT</span>
            </span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs sm:text-sm text-gray-300 font-semibold tracking-wide">
              ISO 9001:2008 Certified Standards
            </span>
          </div>

          <p className="text-[11px] text-[#388BFF] font-medium tracking-wider uppercase mt-1 opacity-90">
            Enterprise Vedio Infrastructure
          </p>
        </div>

        {/* Optical Fiber High-Speed Loading Line */}
        <div className="w-64 h-1.5 bg-white/[0.08] rounded-full overflow-hidden relative shadow-inner">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#0066FF] via-[#FF7A00] to-[#0066FF] w-full rounded-full animate-aurora" />
        </div>

        <div className="space-y-1">
          <p className="text-[11px] text-gray-400 font-semibold tracking-widest uppercase">
            Initializing Encrypted Vedio Network...
          </p>
          <p className="text-[10px] text-gray-500 italic">
            Tap anywhere to skip • High-fidelity audio enabled
          </p>
        </div>
      </div>
    </div>
  );
}
