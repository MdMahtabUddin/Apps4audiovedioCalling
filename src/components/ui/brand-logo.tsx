'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { soundEngine } from '@/lib/audio/sound-engine';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  withSound?: boolean;
  href?: string;
  className?: string;
}

export function BrandLogo({
  size = 'md',
  showTagline = true,
  withSound = true,
  href = '/',
  className = '',
}: BrandLogoProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (withSound) {
      soundEngine.playIntroChime();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('metromeet:play-splash'));
    }
  };

  const dimensions = {
    sm: { width: 120, height: 38, text: 'text-lg', arcStroke: 3 },
    md: { width: 160, height: 48, text: 'text-2xl', arcStroke: 3.5 },
    lg: { width: 220, height: 64, text: 'text-3xl', arcStroke: 4 },
    xl: { width: 280, height: 80, text: 'text-4xl', arcStroke: 4.5 },
  }[size];

  const content = (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`inline-flex flex-col cursor-pointer select-none group relative transition-transform duration-300 hover:scale-[1.02] ${className}`}
      title="MetroMeet - A MetroNet Solution (Click for sound)"
    >
      <div className="relative flex items-center">
        {/* Dynamic MetroNet Stylized SVG Arc & Wordmark */}
        <div className="relative">
          {/* Animated Orange Arc Swoosh */}
          <svg
            className="overflow-visible absolute -top-3.5 left-0 w-full pointer-events-none"
            height="18"
            viewBox="0 0 160 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M 6 16 Q 80 -4 154 16"
              stroke="url(#metronet-arc-gradient)"
              strokeWidth={dimensions.arcStroke}
              strokeLinecap="round"
              className={`transition-all duration-700 ${
                isHovered ? 'filter drop-shadow-[0_0_8px_rgba(255,122,0,0.8)]' : 'drop-shadow-[0_0_4px_rgba(255,122,0,0.4)]'
              }`}
            />
            <defs>
              <linearGradient id="metronet-arc-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FF7A00" />
                <stop offset="50%" stopColor="#FFA336" />
                <stop offset="100%" stopColor="#FF6200" />
              </linearGradient>
            </defs>
          </svg>

          {/* Typography */}
          <div className="flex items-center tracking-tight font-black italic relative overflow-hidden rounded-lg">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2B82FF] via-[#00D4FF] to-[#0057FF] drop-shadow-[0_0_14px_rgba(0,102,255,0.45)] transition-all group-hover:drop-shadow-[0_0_20px_rgba(0,212,255,0.7)]">
              Metro
            </span>
            <span className="text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.3)] ml-0.5 font-black">
              Meet
            </span>
            <span className="ml-1.5 px-2 py-0.5 text-[8.5px] not-italic font-black tracking-widest rounded-full bg-gradient-to-r from-[#FF7A00] via-[#FFA336] to-[#FF4500] text-white shadow-md shadow-orange-500/35 uppercase border border-white/20 animate-pulse">
              PRO
            </span>
            {/* Ambient Shimmer Beam Sweep */}
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
          </div>
        </div>
      </div>

      {showTagline && size !== 'sm' && (
        <div className="flex items-center gap-1.5 -mt-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00D4FF] animate-ping" />
          <span className="text-[10px] font-semibold text-[#388BFF] italic tracking-wide">
            We Do <span className="font-black text-[#FF7A00]">IT</span>
          </span>
          <span className="text-[9px] text-gray-500">|</span>
          <span className="text-[9px] text-gray-400 font-medium tracking-tight">
            Enterprise Video Infrastructure
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
