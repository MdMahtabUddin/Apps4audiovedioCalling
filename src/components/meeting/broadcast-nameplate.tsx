'use client';

import React from 'react';
import { MicOff, Crown, Shield, Radio } from 'lucide-react';

interface BroadcastNameplateProps {
  name: string;
  isLocal?: boolean;
  isHost?: boolean;
  isCoHost?: boolean;
  isMuted?: boolean;
  isSpeaking?: boolean;
  subtitle?: string;
}

/**
 * International Broadcast TV Channel Lower-Third Nameplate.
 * Displays participant name, role badge, speaking audio bars, and mic status
 * in a sleek news/studio lower-third graphic overlay.
 */
export function BroadcastNameplate({
  name,
  isLocal = false,
  isHost = false,
  isCoHost = false,
  isMuted = false,
  isSpeaking = false,
  subtitle,
}: BroadcastNameplateProps) {
  const roleLabel =
    subtitle ||
    (isHost ? 'HOST • ON AIR' : isCoHost ? 'CO-HOST • STUDIO' : 'LIVE PARTICIPANT');

  const accentGradient = isSpeaking
    ? 'from-emerald-400 via-teal-400 to-cyan-400'
    : isHost
    ? 'from-[#FF7A00] via-amber-400 to-[#FF4D00]'
    : isCoHost
    ? 'from-[#0066FF] via-cyan-400 to-indigo-500'
    : 'from-[#0066FF] via-[#388BFF] to-[#FF7A00]';

  return (
    <div className="inline-flex items-stretch max-w-[85%] rounded-r-2xl rounded-tl-md overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.65)] border border-white/15 bg-[#060c1a]/88 backdrop-blur-xl pointer-events-none select-none">
      {/* Left Broadcast Vertical Accent Stripe */}
      <div className={`w-1.5 shrink-0 bg-gradient-to-b ${accentGradient}`} />

      <div className="flex flex-col min-w-0">
        {/* Top Row: Main Broadcast Name + Audio Equalizer / Mic Status */}
        <div className="px-3 py-1.5 flex items-center gap-2 bg-gradient-to-r from-[#0b1730]/95 via-[#091224]/90 to-transparent">
          {/* Live On-Air Dot or Equalizer */}
          {isSpeaking ? (
            <div className="flex items-end gap-[2px] h-3.5 shrink-0">
              <span className="w-[3px] bg-emerald-400 rounded-full soundwave-bar-1" />
              <span className="w-[3px] bg-emerald-400 rounded-full soundwave-bar-2" />
              <span className="w-[3px] bg-emerald-400 rounded-full soundwave-bar-3" />
            </div>
          ) : (
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                isMuted
                  ? 'bg-rose-500'
                  : isHost
                  ? 'bg-[#FF7A00] shadow-[0_0_8px_#FF7A00]'
                  : 'bg-[#388BFF] shadow-[0_0_8px_#388BFF]'
              }`}
            />
          )}

          {/* Participant Name */}
          <span className="text-xs sm:text-sm font-black tracking-wide text-white truncate max-w-[140px] sm:max-w-[210px] drop-shadow-sm">
            {name}
          </span>

          {isLocal && (
            <span className="px-1.5 py-0.2 rounded bg-white/15 text-[9px] font-extrabold uppercase tracking-wider text-cyan-200 shrink-0">
              You
            </span>
          )}

          {isMuted && (
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-rose-500/25 border border-rose-500/40 text-rose-400 shrink-0">
              <MicOff className="h-3 w-3" />
            </span>
          )}
        </div>

        {/* Bottom Row: TV Channel Lower-Third Role Ticker Strip */}
        <div
          className={`px-3 py-0.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.14em] ${
            isHost
              ? 'bg-gradient-to-r from-[#FF7A00]/90 via-orange-600/80 to-transparent text-white'
              : isCoHost
              ? 'bg-gradient-to-r from-[#0066FF]/90 via-blue-600/80 to-transparent text-white'
              : isSpeaking
              ? 'bg-gradient-to-r from-emerald-600/90 via-teal-600/75 to-transparent text-white'
              : 'bg-gradient-to-r from-[#0066FF]/75 via-[#0d244d]/85 to-transparent text-cyan-100'
          }`}
        >
          {isHost ? (
            <Crown className="h-2.5 w-2.5 shrink-0" />
          ) : isCoHost ? (
            <Shield className="h-2.5 w-2.5 shrink-0" />
          ) : (
            <Radio className="h-2.5 w-2.5 shrink-0" />
          )}
          <span className="truncate">
            {isSpeaking ? 'SPEAKING • LIVE AUDIO' : roleLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
