'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Clock, LogOut, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface WaitingRoomScreenProps {
  meetingTitle: string;
  hostName: string;
  onLeave: () => void;
}

export function WaitingRoomScreen({ meetingTitle, hostName, onLeave }: WaitingRoomScreenProps) {
  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md p-8 rounded-3xl bg-[#0c101c]/90 border border-white/[0.08] backdrop-blur-2xl shadow-2xl text-center space-y-6 relative z-10">
        <div className="relative inline-block">
          <div className="h-16 w-16 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
            <Clock className="h-8 w-8 animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <Badge variant="warning" dot>
            Waiting Room
          </Badge>
          <h2 className="text-xl font-bold text-white tracking-tight">{meetingTitle}</h2>
          <p className="text-xs text-gray-400 leading-relaxed max-w-sm mx-auto">
            Please wait, the meeting host (<strong className="text-white">{hostName}</strong>) has been notified and will let you in shortly.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs text-gray-400 text-left space-y-1.5">
          <div className="flex items-center gap-2 text-gray-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-semibold">Security Protected</span>
          </div>
          <p className="text-[11px] text-gray-400">
            Your camera and microphone are inactive while waiting. They will resume your pre-join preferences when admitted.
          </p>
        </div>

        <Button variant="secondary" className="w-full text-xs font-bold" onClick={onLeave}>
          <LogOut className="h-3.5 w-3.5 mr-1" />
          Leave Waiting Room
        </Button>
      </div>
    </div>
  );
}
