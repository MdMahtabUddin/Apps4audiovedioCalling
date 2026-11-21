'use client';

import React, { useState } from 'react';
import { ArrowLeft, Check, Copy, PhoneOff, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { useToast } from '@/components/ui/toast';

interface DailyBackupStageProps {
  meetingId: string;
  meetingTitle: string;
  isHost: boolean;
  roomUrl: string;
  token?: string | null;
  displayName: string;
  onLeave: () => void;
  onEndMeeting?: () => Promise<void>;
}

export function DailyBackupStage({
  meetingId,
  meetingTitle,
  isHost,
  roomUrl,
  token,
  displayName,
  onLeave,
  onEndMeeting,
}: DailyBackupStageProps) {
  const toast = useToast();
  const [isCopied, setIsCopied] = useState(false);

  const iframeSrc = (() => {
    const params = new URLSearchParams();
    if (token) params.set('t', token);
    if (displayName) params.set('userName', displayName);
    const query = params.toString();
    return query ? `${roomUrl}?${query}` : roomUrl;
  })();

  const copyMeetingLink = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setIsCopied(true);
    toast.success('Meeting link copied!');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleExit = async () => {
    if (isHost && onEndMeeting) {
      await onEndMeeting();
    } else {
      onLeave();
    }
  };

  return (
    <div className="h-screen w-screen bg-[#050a14] text-white flex flex-col overflow-hidden p-3 sm:p-4 gap-3">
      {/* MetroMeet PRO Frosted Header Bar */}
      <header className="flex items-center justify-between gap-3 shrink-0 px-3 sm:px-4 py-2 rounded-2xl bg-[#071022]/85 backdrop-blur-2xl border border-white/[0.09] shadow-xl">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <button
            onClick={onLeave}
            className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-white/[0.06] hover:bg-white/[0.14] text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer active:scale-95"
            title="Leave Meeting"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>

          <div className="hidden sm:flex items-center shrink-0">
            <BrandLogo size="sm" showTagline={false} href="" />
          </div>

          <div className="h-6 w-px bg-white/10 hidden sm:block shrink-0" />

          <div className="min-w-0 flex-1">
            <h1 className="text-xs sm:text-[15px] font-bold tracking-tight truncate text-white">
              {meetingTitle}
            </h1>
            <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
              <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="h-2.5 w-2.5" />
                <span>Backup Cloud Active</span>
              </span>
              <button
                onClick={copyMeetingLink}
                className={`inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[10px] font-semibold border transition-all cursor-pointer active:scale-95 ${
                  isCopied
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                    : 'bg-[#FF7A00]/15 hover:bg-[#FF7A00]/25 text-[#FFB366] hover:text-white border-[#FF7A00]/35'
                }`}
              >
                {isCopied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                <span>{isCopied ? 'Link Copied' : 'Share Link'}</span>
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleExit}
          className="h-8 sm:h-9 px-3.5 sm:px-4 rounded-full bg-gradient-to-r from-[#FF4D3A] to-[#E11D48] hover:opacity-95 text-white font-semibold text-[11px] sm:text-xs shadow-lg shadow-rose-600/30 flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
        >
          <PhoneOff className="h-3.5 w-3.5" />
          <span>{isHost ? 'End' : 'Leave'}</span>
        </button>
      </header>

      {/* Daily.co Backup Cloud Video Stage */}
      <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-white/10 bg-[#080d1a] shadow-2xl">
        <iframe
          src={iframeSrc}
          title={meetingTitle}
          allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
