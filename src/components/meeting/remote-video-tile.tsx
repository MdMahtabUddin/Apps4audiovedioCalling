'use client';

import React, { useEffect, useRef } from 'react';
import { MicOff, Wifi, WifiOff, Volume2 } from 'lucide-react';
import { NetworkQuality } from '@/lib/webrtc/webrtc-mesh';

interface RemoteVideoTileProps {
  peerId: string;
  name?: string;
  stream: MediaStream;
  isSpeaking?: boolean;
  quality?: NetworkQuality;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
  joinedAt?: string | number | null;
}

export function RemoteVideoTile({
  peerId,
  name,
  stream,
  isSpeaking = false,
  quality,
  isAudioEnabled = true,
  isVideoEnabled = true,
  joinedAt,
}: RemoteVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const displayName = name || `Participant (${peerId.slice(0, 5)})`;

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => {
        console.warn(`[RemoteVideoTile] Auto-play video prevented for peer ${peerId}:`, err);
      });
    }
  }, [stream, peerId]);

  // Dedicated unmuted audio element with auto-resume on first interaction
  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.volume = 1.0;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn(`[RemoteVideoTile] Audio autoplay deferred for ${peerId}:`, err);
          const resumeAudio = () => {
            audioRef.current?.play().catch(() => {});
            window.removeEventListener('click', resumeAudio);
            window.removeEventListener('touchstart', resumeAudio);
            window.removeEventListener('keydown', resumeAudio);
          };
          window.addEventListener('click', resumeAudio);
          window.addEventListener('touchstart', resumeAudio);
          window.addEventListener('keydown', resumeAudio);
        });
      }
    }
  }, [stream, peerId]);

  const hasVideo = isVideoEnabled && stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');

  return (
    <div
      className={`relative w-full aspect-video rounded-3xl bg-[#0c101c] overflow-hidden flex items-center justify-center transition-all duration-300 group ${
        isSpeaking
          ? 'ring-4 ring-emerald-500 shadow-2xl shadow-emerald-500/20'
          : 'border-2 border-white/[0.08] hover:border-indigo-500/40 shadow-xl'
      }`}
    >
      {/* High-priority dedicated audio playback element */}
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        className="hidden"
      />

      {/* Remote Video Track */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          hasVideo ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Video Disabled Avatar Fallback */}
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-[#0a0d16]">
          <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-2xl font-extrabold text-white shadow-xl border border-white/10">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <p className="text-xs font-semibold text-gray-300">{displayName}</p>
        </div>
      )}

      {/* Top Right: Glowing LIVE Badge */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/75 backdrop-blur-md border border-emerald-500/35 text-[11px] font-bold text-white shadow-lg shadow-black/60">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="tracking-wider uppercase text-emerald-400 font-extrabold">LIVE</span>
        {quality && (
          <span className="text-[10px] text-gray-400 font-mono pl-1 border-l border-white/20">
            {quality.rttMs}ms
          </span>
        )}
      </div>

      {/* Bottom Bar Info with Join Time */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-xs font-semibold text-white flex items-center gap-2 shadow-lg">
          <span className="truncate max-w-[120px] sm:max-w-[180px]">{displayName}</span>
          {!isAudioEnabled && <MicOff className="h-3.5 w-3.5 text-rose-400 shrink-0" />}
          {isSpeaking && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
              <Volume2 className="h-3.5 w-3.5 animate-pulse" />
              Speaking
            </span>
          )}
        </div>

        {joinedAt && (
          <div className="px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-gray-300">
            {typeof joinedAt === 'number'
              ? new Date(joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : new Date(String(joinedAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
}
