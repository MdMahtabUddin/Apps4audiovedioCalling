'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useTracks,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
  useConnectionState,
} from '@livekit/components-react';
import { Track, ConnectionState, ConnectionQuality } from 'livekit-client';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  Users,
  MessageSquare,
  Smile,
  Shield,
  Copy,
  Check,
  Radio,
  PenTool,
  HelpCircle,
  PictureInPicture2,
  Sparkles,
  Wifi,
  Disc,
  Hand,
  Maximize,
  Minimize,
} from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { soundEngine } from '@/lib/audio/sound-engine';
import { useToast } from '@/components/ui/toast';
import { useMeetingRecorder } from '@/lib/recording/use-meeting-recorder';
import { RTC_CONFIG } from '@/lib/webrtc/webrtc-mesh';
import { ChatAndNotesDrawer } from './chat-and-notes-drawer';

interface LiveKitMeetingStageProps {
  meetingId: string;
  meetingTitle: string;
  isHost: boolean;
  token: string;
  serverUrl: string;
  displayName: string;
  onLeave: () => void;
  onEndMeeting?: () => Promise<void>;
  onFallback?: () => void;
}

function LiveKitInnerStage({
  meetingId,
  meetingTitle,
  isHost,
  displayName,
  onLeave,
  onEndMeeting,
}: {
  meetingId: string;
  meetingTitle: string;
  isHost: boolean;
  displayName: string;
  onLeave: () => void;
  onEndMeeting?: () => Promise<void>;
}) {
  const toast = useToast();
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  // Participant join chime and toast notification
  const prevCountRef = React.useRef(participants.length);
  useEffect(() => {
    if (participants.length > prevCountRef.current) {
      soundEngine.playAdmittedChime();
      const latest = participants[participants.length - 1];
      if (latest && !latest.isLocal) {
        toast.info(`🔔 ${latest.name || 'Participant'} joined the meeting`);
      }
    }
    prevCountRef.current = participants.length;
  }, [participants, toast]);

  // Drawers & Modals
  const [showChatAndNotes, setShowChatAndNotes] = useState(false);
  const [showReactionsBar, setShowReactionsBar] = useState(false);
  const [activeReaction, setActiveReaction] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [knocks, setKnocks] = useState<Array<{ id: string; displayName: string }>>([]);

  // Video & Audio Meeting Recorder
  const recorder = useMeetingRecorder(meetingTitle);

  // Virtual Hand Raise State
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Record<string, string>>({});

  // Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Listen to LiveKit real-time data channel for reactions & hand raises
  useEffect(() => {
    if (!room) return;
    const handleDataReceived = (payload: Uint8Array, participant?: any) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);
        if (data.type === 'reaction' && data.emoji) {
          setActiveReaction(data.emoji);
          setTimeout(() => setActiveReaction(null), 2500);
        } else if (data.type === 'hand-raise') {
          const id = data.identity || participant?.identity;
          const name = data.name || participant?.name || 'Participant';
          setRaisedHands((prev) => {
            const next = { ...prev };
            if (data.raised) {
              next[id] = name;
            } else {
              delete next[id];
            }
            return next;
          });
          if (data.raised && !participant?.isLocal) {
            soundEngine.playIntroChime();
            toast.info(`✋ ${name} raised their hand!`);
          }
        }
      } catch {}
    };

    room.on('dataReceived', handleDataReceived);
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room, toast]);

  // Hand Raise Toggle
  const toggleHandRaise = () => {
    const nextRaised = !isHandRaised;
    setIsHandRaised(nextRaised);
    if (nextRaised) {
      soundEngine.playIntroChime();
      toast.success('You raised your hand ✋');
    } else {
      toast.info('You lowered your hand');
    }

    setRaisedHands((prev) => {
      const next = { ...prev };
      if (nextRaised) {
        next[localParticipant.identity] = displayName;
      } else {
        delete next[localParticipant.identity];
      }
      return next;
    });

    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          type: 'hand-raise',
          identity: localParticipant.identity,
          name: displayName,
          raised: nextRaised,
        })
      );
      room?.localParticipant.publishData(payload, { reliable: true });
    } catch {}
  };

  // Poll for waiting room admission requests if host
  useEffect(() => {
    if (!isHost) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/knocks`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.waitingList)) {
            setKnocks(data.waitingList);
          }
        }
      } catch {}
    }, 1500);
    return () => clearInterval(interval);
  }, [isHost, meetingId]);

  // Play notification chime for host when a new knock arrives
  const prevKnocksCount = useRef(0);
  useEffect(() => {
    if (knocks.length > prevKnocksCount.current) {
      soundEngine.playKnockChime();
      toast.info(`🔔 ${knocks[knocks.length - 1].displayName} is waiting to join`);
    }
    prevKnocksCount.current = knocks.length;
  }, [knocks, toast]);

  const handleAdmit = async (participantId: string) => {
    try {
      await fetch(`/api/meetings/${meetingId}/knocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, action: 'APPROVE' }),
      });
      setKnocks((prev) => prev.filter((k) => k.id !== participantId));
      toast.success('Participant admitted to meeting!');
    } catch {}
  };

  const handleDeny = async (participantId: string) => {
    try {
      await fetch(`/api/meetings/${meetingId}/knocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, action: 'DENY' }),
      });
      setKnocks((prev) => prev.filter((k) => k.id !== participantId));
    } catch {}
  };

  // Call duration counter
  useEffect(() => {
    const timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // LiveKit reactive video tracks (camera & screenshare)
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const copyMeetingLink = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/meeting/${meetingId}`;
      navigator.clipboard.writeText(url);
      setIsCopied(true);
      toast.success('Meeting link copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleSendReaction = (emoji: string) => {
    setActiveReaction(emoji);
    setShowReactionsBar(false);
    setTimeout(() => setActiveReaction(null), 2500);
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ type: 'reaction', emoji }));
      room?.localParticipant.publishData(payload, { reliable: true });
    } catch {}
  };

  // Total participants count
  const totalCount = participants.length;

  // Grid layout class based on participant count
  const getGridClasses = () => {
    if (tracks.length <= 1) return 'max-w-4xl w-full aspect-video mx-auto max-h-[75vh]';
    if (tracks.length === 2) return 'w-full grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 max-w-6xl mx-auto max-h-[75vh] overflow-y-auto';
    if (tracks.length <= 4) return 'w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 max-w-6xl mx-auto max-h-[75vh] overflow-y-auto';
    if (tracks.length <= 9) return 'w-full grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 max-w-7xl mx-auto max-h-[75vh] overflow-y-auto';
    return 'w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-w-7xl max-h-[75vh] overflow-y-auto p-1 mx-auto';
  };

  return (
    <div className="h-screen w-screen bg-[#06080e] text-slate-100 flex flex-col overflow-hidden select-none relative">
      {/* Floating Reaction Animation */}
      {activeReaction && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-8xl z-50 animate-bounce pointer-events-none drop-shadow-2xl">
          {activeReaction}
        </div>
      )}

      {/* Waiting Room Knocks Notification for Host */}
      {knocks.length > 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-[#0d1322]/95 border border-[#0066FF]/40 rounded-2xl p-3 shadow-2xl backdrop-blur-xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#FF7A00] animate-pulse" />
            <span className="text-xs font-semibold text-white">
              <strong className="text-[#388BFF]">{knocks[0].displayName}</strong> wants to join this meeting
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAdmit(knocks[0].id)}
              className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            >
              Admit
            </button>
            <button
              onClick={() => handleDeny(knocks[0].id)}
              className="px-3 py-1 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            >
              Deny
            </button>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="h-14 sm:h-16 px-4 bg-[#0c101c]/90 border-b border-white/[0.08] backdrop-blur-md flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <BrandLogo size="sm" showTagline={false} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate max-w-[140px] sm:max-w-xs">
                {meetingTitle}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0066FF]/20 text-[#388BFF] border border-[#0066FF]/40 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-cyan-400" />
                Enterprise Cloud Engine
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono">
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                HD Audio & Video
              </span>
              <span>•</span>
              <span className="text-gray-300 font-semibold">{formatDuration(callDuration)}</span>
            </div>
          </div>
        </div>

        {/* Center: Live Call Duration Pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-black/50 border border-white/10 text-xs font-mono">
          <Radio className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
          <span className="text-rose-400 font-bold uppercase tracking-wider text-[10px]">LIVE</span>
          <span className="text-gray-500">|</span>
          <span className="text-white font-semibold">{formatDuration(callDuration)}</span>
        </div>

        {/* Center/Right: Active Recording Indicator */}
        {recorder.isRecording && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-2xl bg-rose-600/20 border border-rose-500/40 text-xs font-mono animate-pulse">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
            <span className="text-rose-400 font-extrabold text-[11px]">REC {recorder.recordingDuration}</span>
          </div>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="h-8 w-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-gray-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={copyMeetingLink}
            className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Copy Meeting Link"
          >
            {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Share Link'}</span>
          </button>
        </div>
      </header>

      {/* Main Video Stage */}
      <main className="flex-1 overflow-hidden p-3 sm:p-5 flex items-center justify-center relative">
        <div className="w-full h-full flex items-center justify-center">
          <div className={getGridClasses()}>
            {tracks.map((trackRef) => {
              const participant = trackRef.participant;
              const isLocal = participant.isLocal;
              const pName = participant.name || participant.identity || (isLocal ? displayName : 'Participant');
              const hasVideo = trackRef.publication && !trackRef.publication.isMuted && trackRef.publication.track;
              const isSpeaking = participant.isSpeaking;

              return (
                <div
                  key={`${participant.identity}-${trackRef.source}`}
                  className={`relative w-full aspect-video rounded-3xl bg-[#0c101c] overflow-hidden flex items-center justify-center transition-all duration-300 group ${
                    isSpeaking
                      ? 'ring-4 ring-emerald-500 shadow-2xl shadow-emerald-500/25'
                      : 'border-2 border-white/[0.08] hover:border-indigo-500/40 shadow-xl'
                  }`}
                >
                  {/* Video Track Element */}
                  {hasVideo ? (
                    <VideoTrack
                      trackRef={trackRef}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-[#0a0d16]">
                      <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-2xl font-black text-white shadow-xl border border-white/10">
                        {pName.slice(0, 2).toUpperCase()}
                      </div>
                      <p className="text-xs font-bold text-gray-200">{pName} {isLocal ? '(You)' : ''}</p>
                      <p className="text-[10px] text-gray-400">Camera stream paused</p>
                    </div>
                  )}

                  {/* Hand Raised Badge */}
                  {raisedHands[participant.identity] && (
                    <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 font-bold text-[10px] sm:text-[11px] shadow-lg animate-bounce">
                      <span>✋</span>
                      <span>Hand Raised</span>
                    </div>
                  )}

                  {/* Top Left Resolution & PiP Pill */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                    <span className="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-cyan-400 font-bold">
                      {trackRef.source === Track.Source.ScreenShare ? 'Screen Share' : '1080p HD'}
                    </span>
                  </div>

                  {/* Top Right Live Badge */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/75 backdrop-blur-md border border-emerald-500/35 text-[11px] font-bold text-white shadow-lg">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="tracking-wider uppercase text-emerald-400 font-extrabold text-[10px]">LIVE</span>
                  </div>

                  {/* Bottom Participant Info Bar */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                    <div className="px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-xs font-semibold text-white flex items-center gap-2 shadow-lg">
                      <span className="truncate max-w-[120px] sm:max-w-[180px]">
                        {pName} {isLocal ? '(You)' : ''}
                      </span>
                      {!participant.isMicrophoneEnabled && (
                        <MicOff className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                      )}
                      {isSpeaking && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                          Speaking
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Live Attendees Ticker Ribbon */}
      <div className="h-9 px-3 sm:px-4 bg-[#050a14]/95 border-t border-b border-[#0066FF]/25 backdrop-blur-md flex items-center overflow-hidden z-20 shrink-0 select-none">
        <div className="flex items-center gap-2 pr-3 sm:pr-4 border-r border-white/10 shrink-0 z-10 bg-[#050a14] text-xs font-bold text-[#388BFF]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0066FF] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0066FF]" />
          </span>
          <span className="uppercase tracking-wider font-mono text-[10px] sm:text-[11px]">
            Attendees ({totalCount}/50)
          </span>
        </div>
        <div className="flex-1 overflow-hidden relative ml-3">
          <div className="animate-marquee flex items-center gap-8 text-xs text-gray-300">
            {[0, 1].map((copyIndex) => (
              <React.Fragment key={copyIndex}>
                {participants.map((p) => {
                  const pName = p.name || p.identity || 'Participant';
                  const initials = pName.slice(0, 2).toUpperCase();
                  const isLocal = p.isLocal;

                  return (
                    <React.Fragment key={`${copyIndex}-${p.identity}`}>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="h-5 w-5 rounded-full bg-gradient-to-tr from-[#0066FF] to-[#0047AB] text-white font-bold text-[10px] flex items-center justify-center shadow-sm">
                          {initials}
                        </span>
                        <span className="font-semibold text-white">
                          {pName} {isLocal ? '(You)' : ''}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-mono font-semibold">Active</span>
                      </div>
                      <span className="text-gray-600 font-black">•</span>
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Floating Control Bar */}
      <footer className="h-18 px-4 bg-[#0c101c]/95 border-t border-white/[0.08] backdrop-blur-lg flex items-center justify-between z-20 shrink-0">
        <div className="hidden md:flex items-center gap-3 text-xs text-gray-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[11px]">Enterprise SFU • 0% Packet Loss</span>
        </div>

        {/* Center Controls */}
        <div className="flex items-center gap-2 sm:gap-3 mx-auto">
          {/* Mic Toggle */}
          <button
            onClick={() => localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled)}
            className={`h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 ${
              localParticipant.isMicrophoneEnabled
                ? 'bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/10'
                : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30'
            }`}
            title={localParticipant.isMicrophoneEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {localParticipant.isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {/* Camera Toggle */}
          <button
            onClick={() => localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled)}
            className={`h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 ${
              localParticipant.isCameraEnabled
                ? 'bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/10'
                : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30'
            }`}
            title={localParticipant.isCameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {localParticipant.isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={() => localParticipant.setScreenShareEnabled(!localParticipant.isScreenShareEnabled)}
            className={`h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 ${
              localParticipant.isScreenShareEnabled
                ? 'bg-[#0066FF] text-white shadow-[#0066FF]/40 border border-[#388BFF]'
                : 'bg-white/[0.08] hover:bg-white/[0.15] text-gray-300 hover:text-white border border-white/10'
            }`}
            title={localParticipant.isScreenShareEnabled ? 'Stop Screen Share' : 'Share Screen'}
          >
            <Monitor className="h-5 w-5" />
          </button>

          {/* Reactions Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowReactionsBar(!showReactionsBar)}
              className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-gray-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95"
              title="Reactions"
            >
              <Smile className="h-5 w-5" />
            </button>
            {showReactionsBar && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 p-2 rounded-2xl bg-[#0c101c] border border-white/15 shadow-2xl flex items-center gap-2 z-50 animate-in fade-in zoom-in-95">
                {['👍', '❤️', '👏', '🎉', '🔥', '🚀'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleSendReaction(emoji)}
                    className="h-10 w-10 text-xl hover:scale-125 transition-transform flex items-center justify-center cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Virtual Hand Raise */}
          <button
            onClick={toggleHandRaise}
            className={`h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 ${
              isHandRaised
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-amber-500/30'
                : 'bg-white/[0.08] hover:bg-white/[0.15] text-gray-300 hover:text-white border border-white/10'
            }`}
            title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
          >
            <Hand className="h-5 w-5" />
          </button>

          {/* Meeting Video & Audio Recorder */}
          <button
            onClick={async () => {
              if (recorder.isRecording) {
                recorder.stopRecording();
                toast.success('Recording saved! Download starting.');
              } else {
                const started = await recorder.startRecording();
                if (started) {
                  toast.success('Recording started!');
                } else {
                  toast.error('Recording cancelled or permission not granted.');
                }
              }
            }}
            className={`h-11 px-3 sm:h-12 sm:px-4 rounded-2xl flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shadow-lg active:scale-95 text-xs font-semibold ${
              recorder.isRecording
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse border border-rose-400'
                : 'bg-white/[0.08] hover:bg-white/[0.15] text-gray-300 hover:text-white border border-white/10'
            }`}
            title={recorder.isRecording ? 'Stop Recording' : 'Record Video & Audio'}
          >
            <Disc className={`h-4 w-4 ${recorder.isRecording ? 'text-white animate-spin' : 'text-rose-400'}`} />
            <span className="hidden sm:inline">
              {recorder.isRecording ? `REC ${recorder.recordingDuration}` : 'Record'}
            </span>
          </button>

          {/* Chat & Notes Drawer */}
          <button
            onClick={() => setShowChatAndNotes(true)}
            className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-gray-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95"
            title="Chat & Notes"
          >
            <MessageSquare className="h-5 w-5" />
          </button>

          {/* Leave / End Meeting Button */}
          <button
            onClick={() => {
              if (recorder.isRecording) {
                recorder.stopRecording();
              }
              if (isHost && onEndMeeting) {
                onEndMeeting();
              } else {
                onLeave();
              }
            }}
            className="h-11 px-5 sm:h-12 sm:px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-rose-600/30 transition-all cursor-pointer active:scale-95"
          >
            <PhoneOff className="h-4 w-4" />
            <span>{isHost ? 'End Call' : 'Leave'}</span>
          </button>
        </div>

        {/* Right Info */}
        <div className="hidden md:flex items-center gap-2 text-xs text-gray-400">
          <span className="font-mono text-[11px] text-gray-500">MetroMeet Pro v2.6</span>
        </div>
      </footer>

      {/* Drawers */}
      <ChatAndNotesDrawer
        isOpen={showChatAndNotes}
        onClose={() => setShowChatAndNotes(false)}
        meetingId={meetingId}
        meetingTitle={meetingTitle}
        localUserName={displayName}
      />
    </div>
  );
}

export function LiveKitMeetingStage({
  meetingId,
  meetingTitle,
  isHost,
  token,
  serverUrl,
  displayName,
  onLeave,
  onEndMeeting,
  onFallback,
}: LiveKitMeetingStageProps) {
  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      video={true}
      audio={true}
      connectOptions={{
        rtcConfig: RTC_CONFIG,
      }}
      data-lk-theme="default"
      onError={(err) => {
        console.warn('LiveKit cloud connection notice:', err);
      }}
      className="h-screen w-screen overflow-hidden bg-[#06080e]"
    >
      <RoomAudioRenderer />
      <StartAudio label="Click to allow audio" />
      <LiveKitInnerStage
        meetingId={meetingId}
        meetingTitle={meetingTitle}
        isHost={isHost}
        displayName={displayName}
        onLeave={onLeave}
        onEndMeeting={onEndMeeting}
      />
    </LiveKitRoom>
  );
}
