'use client';

import React, { useState, useRef } from 'react';
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
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    if (withSound) {
      soundEngine.playIntroChime();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('metromeet:play-splash'));
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: Number((-y * 16).toFixed(2)),
      ry: Number((x * 18).toFixed(2)),
    });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ rx: 0, ry: 0 });
  };

  const dimensions = {
    sm: {
      text: 'text-lg',
      arcTop: '-top-2.5',
      arcHeight: '13',
      arcStroke: 3.2,
      pro: 'px-1.5 py-0.5 text-[8px] rounded-md',
      tagline: 'text-[8.5px]',
    },
    md: {
      text: 'text-2xl',
      arcTop: '-top-3.5',
      arcHeight: '17',
      arcStroke: 3.8,
      pro: 'px-2 py-0.5 text-[9.5px] rounded-lg',
      tagline: 'text-[10px]',
    },
    lg: {
      text: 'text-3xl',
      arcTop: '-top-4',
      arcHeight: '20',
      arcStroke: 4.2,
      pro: 'px-2.5 py-0.5 text-[10.5px] rounded-lg',
      tagline: 'text-[11px]',
    },
    xl: {
      text: 'text-4xl sm:text-5xl',
      arcTop: '-top-5',
      arcHeight: '26',
      arcStroke: 4.8,
      pro: 'px-3 py-1 text-xs rounded-xl',
      tagline: 'text-xs',
    },
  }[size];

  const content = (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: '700px' }}
      className={`inline-flex flex-col cursor-pointer select-none group relative ${className}`}
      title="MetroMeet PRO — We Do IT"
    >
      <div
        style={{
          transform: isHovered
            ? `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(-1.5px) scale(1.03)`
            : 'rotateX(0deg) rotateY(0deg) translateY(0px) scale(1)',
          transformStyle: 'preserve-3d',
          transition: isHovered
            ? 'transform 0.12s cubic-bezier(0.22, 1, 0.36, 1)'
            : 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="inline-flex flex-col pt-2"
      >
        <div className="relative inline-flex items-center">
          {/* 3D Animated Orange Swoosh Arc */}
          <svg
            className={`overflow-visible absolute ${dimensions.arcTop} left-0 w-full pointer-events-none transition-transform duration-500 ease-out ${
              isHovered ? '-translate-y-0.5 scale-x-[1.03]' : ''
            }`}
            height={dimensions.arcHeight}
            viewBox="0 0 180 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              filter: isHovered
                ? 'drop-shadow(0 4px 10px rgba(255, 122, 0, 0.55))'
                : 'drop-shadow(0 2px 5px rgba(255, 122, 0, 0.32))',
            }}
          >
            {/* 3D Shadow Underside */}
            <path
              d="M 10 17 Q 90 -1 170 17"
              stroke="rgba(180, 60, 0, 0.45)"
              strokeWidth={dimensions.arcStroke}
              strokeLinecap="round"
              transform="translate(0, 1.4)"
            />
            {/* Main Glossy Orange Arc */}
            <path
              d="M 10 17 Q 90 -1 170 17"
              stroke="url(#metromeet-3d-arc)"
              strokeWidth={dimensions.arcStroke}
              strokeLinecap="round"
            />
            {/* Top Specular Rim Highlight */}
            <path
              d="M 24 13.5 Q 90 1 156 13.5"
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="metromeet-3d-arc" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FF8A1E" />
                <stop offset="50%" stopColor="#FF7A00" />
                <stop offset="100%" stopColor="#EA580C" />
              </linearGradient>
            </defs>
          </svg>

          {/* 3D Extruded Wordmark + Glossy PRO Pill */}
          <div
            className={`flex items-center tracking-tight font-black italic relative overflow-hidden rounded-lg pr-0.5 ${dimensions.text}`}
          >
            <span
              className="text-[#0066FF] dark:text-[#3B82F6] transition-colors"
              style={{
                textShadow: isHovered
                  ? '0 1px 0 #0047B3, 0 2px 0 #003A94, 0 6px 14px rgba(0, 102, 255, 0.38)'
                  : '0 1px 0 #0047B3, 0 2px 0 rgba(0, 58, 148, 0.65), 0 3px 6px rgba(0, 102, 255, 0.2)',
              }}
            >
              Metro
            </span>
            <span
              className="text-[#0f172a] dark:text-white ml-0.5 font-black transition-colors"
              style={{
                textShadow: isHovered
                  ? '0 1px 0 rgba(15, 23, 42, 0.35), 0 2px 0 rgba(15, 23, 42, 0.2), 0 5px 12px rgba(15, 23, 42, 0.22)'
                  : '0 1px 0 rgba(15, 23, 42, 0.25), 0 2px 4px rgba(15, 23, 42, 0.14)',
              }}
            >
              Meet
            </span>
            <span
              className={`ml-1.5 not-italic font-extrabold tracking-wider bg-gradient-to-b from-[#FF8C1A] via-[#FF7300] to-[#E65100] text-white uppercase transition-transform duration-300 ${dimensions.pro} ${
                isHovered ? 'scale-105 -translate-y-[1px]' : ''
              }`}
              style={{
                boxShadow: isHovered
                  ? 'inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 0 #b83d00, 0 6px 14px rgba(255,115,0,0.42)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 0 #b83d00, 0 3px 8px rgba(255,115,0,0.28)',
              }}
            >
              PRO
            </span>

            {/* Silky Hover Glint Sweep */}
            <span
              className={`pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 ease-out ${
                isHovered ? 'translate-x-[340%]' : '-translate-x-full'
              }`}
            />
          </div>
        </div>

        {/* Tagline: • We Do IT | Enterprise Vedio Infrastructure */}
        {showTagline && (
          <div className={`flex items-center gap-1.5 mt-0.5 leading-none ${dimensions.tagline}`}>
            <span
              className={`h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 transition-transform duration-300 ${
                isHovered ? 'scale-125 shadow-[0_0_8px_rgba(16,185,129,0.75)]' : ''
              }`}
            />
            <span className="font-bold text-blue-600 dark:text-[#3B82F6] italic tracking-wide">
              We Do <span className="font-black text-[#FF7A00]">IT</span>
            </span>
            <span className="text-slate-300 dark:text-zinc-600">|</span>
            <span className="text-slate-500 dark:text-zinc-400 font-medium tracking-tight">
              Enterprise Vedio Infrastructure
            </span>
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
