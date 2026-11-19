'use client';

import React, { useEffect } from 'react';
import { ShieldCheck, PhoneCall, LogOut, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BrandLogo } from '@/components/ui/brand-logo';
import { soundEngine } from '@/lib/audio/sound-engine';

interface WaitingRoomScreenProps {
  meetingTitle: string;
  hostName: string;
  onLeave: () => void;
}

export function WaitingRoomScreen({ meetingTitle, hostName, onLeave }: WaitingRoomScreenProps) {
  useEffect(() => {
    soundEngine.startCallingRingtone();
    return () => {
      soundEngine.stopCallingRingtone();
    };
  }, []);
  return (
    <div className="min-h-screen bg-[#050a14] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* MetroNet Brand Ambient Backlight */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-r from-[#0066FF]/20 to-[#FF7A00]/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md p-8 rounded-3xl bg-[#091222]/90 border border-[#0066FF]/20 backdrop-blur-2xl shadow-2xl text-center space-y-6 relative z-10 glow-border">
        {/* Brand Logo with Audio Chime */}
        <div className="flex justify-center pb-1">
          <BrandLogo size="md" showTagline={true} />
        </div>

        {/* Animated Radar Pulse Ring in MetroNet Orange & Blue */}
        <div className="relative inline-block py-2">
          {/* Radar waves */}
          <div className="absolute inset-0 m-auto h-20 w-20 rounded-full bg-[#FF7A00]/20 animate-radar pointer-events-none" />
          <div className="absolute inset-0 m-auto h-28 w-28 rounded-full bg-[#0066FF]/15 animate-radar [animation-delay:0.8s] pointer-events-none" />

          {/* Center Phone / Calling Icon */}
          <div className="relative h-20 w-20 rounded-full bg-gradient-to-tr from-[#0057B7] to-[#FF7A00] text-white flex items-center justify-center mx-auto shadow-xl shadow-[#0066FF]/30 border-2 border-white/20">
            <PhoneCall className="h-9 w-9 animate-bounce text-white drop-shadow-md" />
          </div>
        </div>

        {/* Meeting Information */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Badge variant="orange" dot>
              Waiting for Host Approval
            </Badge>
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight">{meetingTitle}</h2>

          <p className="text-xs text-gray-300 leading-relaxed max-w-sm mx-auto">
            Please wait while the meeting host (<strong className="text-[#388BFF] font-semibold">{hostName}</strong>) accepts your request to join.
          </p>
        </div>

        {/* Audio Ringtone Notice & Security Badge */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs text-gray-400 text-left space-y-2">
          <div className="flex items-center justify-between text-gray-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-white">MetroNet Encrypted Lobby</span>
            </div>
            <span className="flex items-center gap-1 text-[11px] text-[#FFA033]">
              <Volume2 className="h-3.5 w-3.5 animate-pulse" />
              Ringing...
            </span>
          </div>
          <p className="text-[11px] text-gray-400 leading-normal">
            Your camera and microphone are muted while waiting. As soon as the host admits you, your audio/vedio will activate smoothly.
          </p>
        </div>

        {/* Cancel / Leave Button */}
        <Button variant="secondary" className="w-full text-xs font-bold" onClick={onLeave}>
          <LogOut className="h-3.5 w-3.5 mr-1.5" />
          Leave Waiting Room
        </Button>
      </div>
    </div>
  );
}
