"use client";

import React from "react";
import { TrackReferenceOrPlaceholder, VideoTrack } from "@livekit/components-react";
import { Mic, MicOff, VideoOff, Volume2 } from "lucide-react";
import { Participant } from "livekit-client";

interface ParticipantTileProps {
  trackRef: TrackReferenceOrPlaceholder;
  isLocal?: boolean;
  className?: string;
}

export default function ParticipantTile({
  trackRef,
  isLocal = false,
  className = "",
}: ParticipantTileProps) {
  const participant = trackRef.participant as Participant;
  const isVideoEnabled = trackRef.publication && !trackRef.publication.isMuted;
  const isAudioEnabled = participant.isMicrophoneEnabled;
  const isSpeaking = participant.isSpeaking;

  const displayName = participant.name || participant.identity || "Participant";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`relative w-full h-full bg-slate-900 border ${
        isSpeaking ? "border-emerald-500 shadow-lg shadow-emerald-500/20" : "border-slate-800"
      } rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-300 group ${className}`}
    >
      {/* Video Stream or Avatar Fallback */}
      {isVideoEnabled ? (
        <div className="w-full h-full relative">
          <VideoTrack
            trackRef={trackRef}
            className={`w-full h-full object-cover ${isLocal ? "transform -scale-x-100" : ""}`}
          />
        </div>
      ) : (
        /* Voice-only Call UI */
        <div className="flex flex-col items-center justify-center gap-3">
          <div
            className={`relative w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold bg-gradient-to-tr from-indigo-700 to-violet-500 text-white shadow-xl transition-transform duration-300 ${
              isSpeaking ? "scale-110 ring-4 ring-emerald-500 ring-offset-4 ring-offset-slate-900" : ""
            }`}
          >
            {initials}
            {isSpeaking && (
              <span className="absolute -bottom-1 -right-1 bg-emerald-500 p-1.5 rounded-full text-white shadow">
                <Volume2 className="w-4 h-4 animate-pulse" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
            <VideoOff className="w-4 h-4 text-slate-500" />
            <span>Voice Only</span>
          </div>
        </div>
      )}

      {/* Participant Info Banner (Bottom Left) */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800/80 max-w-[80%] z-10">
        <span className="text-xs font-medium text-slate-200 truncate">
          {displayName} {isLocal && <span className="text-indigo-400 font-semibold">(You)</span>}
        </span>
      </div>

      {/* Mic Status Badge (Top Right) */}
      <div className="absolute top-3 right-3 z-10">
        <div
          className={`p-1.5 rounded-lg backdrop-blur-md border ${
            !isAudioEnabled
              ? "bg-red-500/80 text-white border-red-500/40"
              : isSpeaking
              ? "bg-emerald-500/80 text-white border-emerald-500/40"
              : "bg-slate-900/70 text-slate-400 border-slate-700/60"
          }`}
          title={isAudioEnabled ? (isSpeaking ? "Speaking" : "Microphone active") : "Muted"}
        >
          {!isAudioEnabled ? (
            <MicOff className="w-3.5 h-3.5" />
          ) : (
            <Mic className="w-3.5 h-3.5" />
          )}
        </div>
      </div>
    </div>
  );
}
