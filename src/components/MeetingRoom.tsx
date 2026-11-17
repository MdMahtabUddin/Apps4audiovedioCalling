"use client";

import React, { useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useRoomContext,
  useConnectionState,
} from "@livekit/components-react";
import { Track, ConnectionState } from "livekit-client";
import { Users, Wifi, AlertTriangle, Copy, Check } from "lucide-react";
import ParticipantTile from "./ParticipantTile";
import ControlBar from "./ControlBar";

interface MeetingRoomProps {
  roomId: string;
  token: string;
  liveKitUrl: string;
  initialVideo: boolean;
  initialAudio: boolean;
  onLeave: () => void;
}

function RoomContent({ roomId, onLeave }: { roomId: string; onLeave: () => void }) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const [copied, setCopied] = useState(false);

  // Get all camera tracks (both active and muted/placeholders for all participants)
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = async () => {
    try {
      if (room) {
        await room.disconnect();
      }
    } catch (err) {
      console.error("Error disconnecting room:", err);
    } finally {
      onLeave();
    }
  };

  // Separate local and remote participants if needed
  const localTrack = tracks.find((t) => t.participant.isLocal);
  const remoteTracks = tracks.filter((t) => !t.participant.isLocal);
  const totalParticipants = tracks.length;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-white overflow-hidden">
      {/* Top Header */}
      <header className="h-14 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            <span className="text-xs text-slate-400 font-medium">Room:</span>
            <span className="text-xs font-mono font-semibold text-indigo-400">{roomId}</span>
            <button
              onClick={handleCopyRoomId}
              title="Copy Room ID"
              className="ml-1 text-slate-400 hover:text-white transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800/60 px-2.5 py-1.5 rounded-lg text-xs text-slate-400">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>{totalParticipants} {totalParticipants === 1 ? "participant" : "participants"}</span>
          </div>
        </div>

        {/* Connection State Badge */}
        <div className="flex items-center gap-2">
          {connectionState === ConnectionState.Connecting && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Connecting...
            </span>
          )}
          {connectionState === ConnectionState.Reconnecting && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
              <Wifi className="w-3 h-3 animate-pulse" />
              Reconnecting...
            </span>
          )}
          {connectionState === ConnectionState.Connected && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Connected
            </span>
          )}
        </div>
      </header>

      {/* Main Video Stage */}
      <main className="flex-1 p-3 sm:p-4 overflow-hidden relative flex items-center justify-center">
        {totalParticipants === 0 ? (
          <div className="text-center text-slate-500">
            <p>Connecting to room...</p>
          </div>
        ) : totalParticipants === 1 ? (
          /* Solo View (Waiting for others) */
          <div className="flex flex-col items-center justify-center w-full h-full max-w-4xl max-h-[80vh] gap-4">
            <div className="w-full h-full flex-1 max-h-[70vh]">
              {localTrack && (
                <ParticipantTile
                  trackRef={localTrack}
                  isLocal={true}
                  className="w-full h-full shadow-2xl"
                />
              )}
            </div>
            <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-5 py-2.5 rounded-full text-slate-300 text-sm shadow-lg">
              <span>Waiting for others to join. Share Meeting ID:</span>
              <button
                onClick={handleCopyRoomId}
                className="font-mono font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-md transition"
              >
                {roomId}
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        ) : totalParticipants === 2 ? (
          /* 2 Participants Layout: Stacked remote on top, local below on vertical, or 2-split on widescreen */
          <div className="w-full h-full max-w-6xl flex flex-col md:flex-row gap-4 items-center justify-center">
            {remoteTracks[0] && (
              <div className="w-full h-full flex-1 max-h-[45vh] md:max-h-full">
                <ParticipantTile
                  trackRef={remoteTracks[0]}
                  isLocal={false}
                  className="w-full h-full shadow-2xl"
                />
              </div>
            )}
            {localTrack && (
              <div className="w-full h-full flex-1 max-h-[45vh] md:max-h-full">
                <ParticipantTile
                  trackRef={localTrack}
                  isLocal={true}
                  className="w-full h-full shadow-2xl"
                />
              </div>
            )}
          </div>
        ) : (
          /* Multiple Participants (3+): Responsive Grid */
          <div
            className={`w-full h-full grid gap-3 sm:gap-4 p-1 auto-rows-fr ${
              totalParticipants <= 4
                ? "grid-cols-1 sm:grid-cols-2"
                : totalParticipants <= 6
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            }`}
          >
            {tracks.map((trackRef) => (
              <div key={trackRef.participant.identity} className="w-full h-full min-h-[180px]">
                <ParticipantTile
                  trackRef={trackRef}
                  isLocal={trackRef.participant.isLocal}
                  className="w-full h-full shadow-xl"
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Control Bar */}
      <ControlBar onLeave={handleDisconnect} />
    </div>
  );
}

export default function MeetingRoom({
  roomId,
  token,
  liveKitUrl,
  initialVideo,
  initialAudio,
  onLeave,
}: MeetingRoomProps) {
  const [connectionError, setConnectionError] = useState<string | null>(null);

  return (
    <div className="relative w-screen h-screen bg-slate-950 overflow-hidden">
      {connectionError ? (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connection Failed</h2>
          <p className="text-slate-400 max-w-md mb-6 text-sm">{connectionError}</p>
          <button
            type="button"
            onClick={onLeave}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition"
          >
            Return to Home
          </button>
        </div>
      ) : (
        <LiveKitRoom
          video={initialVideo}
          audio={initialAudio}
          token={token}
          serverUrl={liveKitUrl}
          connect={true}
          onDisconnected={onLeave}
          onError={(err: any) => {
            console.error("LiveKit room error:", err);
            // Do not break the call if it's only a webcam/mic device warning
            const msg = (err?.message || "").toLowerCase();
            if (msg.includes("device") || msg.includes("permission") || msg.includes("camera") || msg.includes("notfound")) {
              console.warn("Media device warning in room:", err);
              return;
            }
            setConnectionError(err?.message || "Failed to connect to LiveKit server.");
          }}
          className="w-full h-full flex flex-col"
        >
          {/* Automatic Audio rendering for remote participants */}
          <RoomAudioRenderer />
          <RoomContent roomId={roomId} onLeave={onLeave} />
        </LiveKitRoom>
      )}
    </div>
  );
}
