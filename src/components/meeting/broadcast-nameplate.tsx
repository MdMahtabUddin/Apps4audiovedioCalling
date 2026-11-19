'use client';

import React from 'react';
import { MicOff } from 'lucide-react';

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
 * Clean, international-standard video conferencing nameplate pill
 * (inspired by Google Meet / Zoom Workplace / FaceTime).
 */
export function BroadcastNameplate({
  name,
  isLocal = false,
  isHost = false,
  isCoHost = false,
  isMuted = false,
  isSpeaking = false,
}: BroadcastNameplateProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 max-w-[85%] px-3 py-1.5 rounded-full backdrop-blur-xl border transition-all duration-200 pointer-events-none select-none shadow-lg ${
        isSpeaking
          ? 'bg-[#091526]/80 border-emerald-400/50 shadow-emerald-500/15'
          : 'bg-black/55 border-white/[0.12] shadow-black/40'
      }`}
    >
      {/* Speaking Equalizer or Muted Mic Icon */}
      {isMuted ? (
        <MicOff className="h-3.5 w-3.5 text-rose-400 shrink-0" />
      ) : isSpeaking ? (
        <div className="flex items-end gap-[2px] h-3 shrink-0">
          <span className="w-[2.5px] bg-emerald-400 rounded-full soundwave-bar-1" />
          <span className="w-[2.5px] bg-emerald-400 rounded-full soundwave-bar-2" />
          <span className="w-[2.5px] bg-emerald-400 rounded-full soundwave-bar-3" />
        </div>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/90 shrink-0" />
      )}

      {/* Clean Participant Name */}
      <span className="text-xs font-semibold tracking-tight text-white/95 truncate max-w-[140px] sm:max-w-[200px]">
        {name}
        {isLocal ? ' (You)' : ''}
      </span>

      {/* Minimal Role Tag (Only for Host or Co-Host) */}
      {isHost && (
        <span className="px-1.5 py-0.5 rounded-full bg-[#FF7A00]/20 text-[#FFA033] border border-[#FF7A00]/30 text-[9px] font-bold uppercase tracking-wider shrink-0">
          Host
        </span>
      )}
      {!isHost && isCoHost && (
        <span className="px-1.5 py-0.5 rounded-full bg-[#0066FF]/20 text-[#388BFF] border border-[#0066FF]/30 text-[9px] font-bold uppercase tracking-wider shrink-0">
          Co-Host
        </span>
      )}
    </div>
  );
}
