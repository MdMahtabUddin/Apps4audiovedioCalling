'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Camera,
  VideoOff,
  MonitorUp,
  MessageSquare,
  Users,
  Smile,
  Settings,
  PhoneOff,
  Copy,
  Check,
  ShieldCheck,
  Lock,
  Unlock,
  Maximize,
  Minimize,
  MoreVertical,
  Radio,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMeeting } from '@/lib/meeting/meeting-provider';
import { useVideo } from '@/lib/webrtc/video-provider';
import { useToast } from '@/components/ui/toast';

export function MeetingRoomView() {
  const toast = useToast();
  const {
    meetingId,
    title,
    hostName,
    isHost,
    myRole,
    isLocked,
    settings,
    leaveRoom,
    endRoom,
    toggleLock,
  } = useMeeting();

  const {
    localStream,
    screenStream,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    micVolume,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
  } = useVideo();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  const [copied, setCopied] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState('00:00');
  const [activeReaction, setActiveReaction] = useState<string | null>(null);
  const [showReactionsBar, setShowReactionsBar] = useState(false);
  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);

  // Meeting timer
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');
      setMeetingDuration(`${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Attach local stream to video
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, isVideoEnabled]);

  // Attach screen share stream
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
      screenVideoRef.current.play().catch(() => {});
    }
  }, [screenStream]);

  const handleCopyLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Meeting link copied to clipboard');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTriggerReaction = (emoji: string) => {
    setActiveReaction(emoji);
    setShowReactionsBar(false);
    setTimeout(() => setActiveReaction(null), 2500);
  };

  return (
    <div className="h-screen w-screen bg-[#06080e] text-slate-100 flex flex-col overflow-hidden select-none relative">
      {/* Reaction Float Animation */}
      {activeReaction && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-8xl z-50 animate-bounce pointer-events-none drop-shadow-2xl">
          {activeReaction}
        </div>
      )}

      {/* Top Meeting Header Bar */}
      <header className="h-16 px-4 sm:px-6 border-b border-white/[0.08] bg-[#0c101c]/80 backdrop-blur-xl flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">{title}</h2>
              <span className="text-xs text-gray-400 font-mono hidden sm:inline">({meetingId})</span>
              {isHost && (
                <Badge variant="indigo" dot>
                  Host
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <span className="font-mono">{meetingDuration}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <Radio className="h-3 w-3 animate-pulse" />
                P2P Mesh Encrypted
              </span>
            </div>
          </div>
        </div>

        {/* Top Right Header Controls */}
        <div className="flex items-center gap-2">
          {isHost && (
            <button
              onClick={toggleLock}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isLocked
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-white/[0.04] border-white/10 text-gray-300 hover:text-white'
              }`}
              title={isLocked ? 'Meeting is locked' : 'Lock meeting'}
            >
              {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{isLocked ? 'Locked' : 'Unlocked'}</span>
            </button>
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={handleCopyLink}
            className="text-xs"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy Link
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Main Video Stage Area */}
      <main className="flex-1 p-3 sm:p-5 relative flex items-center justify-center overflow-hidden">
        {/* If screen sharing is active, show screen share prominently */}
        {isScreenSharing && screenStream ? (
          <div className="w-full h-full flex flex-col lg:flex-row gap-4 items-center justify-center">
            {/* Big Screen Share Tile */}
            <div className="flex-1 w-full h-full rounded-3xl bg-black border border-white/[0.1] overflow-hidden flex items-center justify-center relative shadow-2xl">
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
              <div className="absolute top-4 left-4 bg-black/70 backdrop-blur px-3 py-1.5 rounded-xl border border-white/10 text-xs font-semibold text-white flex items-center gap-2">
                <MonitorUp className="h-4 w-4 text-indigo-400" />
                <span>You are sharing your screen</span>
              </div>
            </div>

            {/* Thumbnail Local Video Tile */}
            <div className="w-64 aspect-video rounded-2xl bg-[#0c101c] border border-white/10 overflow-hidden relative shadow-xl shrink-0">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] ${
                  isVideoEnabled && localStream ? 'opacity-100' : 'opacity-0'
                }`}
              />
              {(!isVideoEnabled || !localStream) && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a0d16] text-xs font-bold text-gray-400">
                  Camera Off
                </div>
              )}
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/60 text-[10px] text-white font-medium">
                You
              </div>
            </div>
          </div>
        ) : (
          /* Standard Video Grid (1 or more participants) */
          <div className="w-full h-full max-w-5xl flex items-center justify-center">
            <div className="relative w-full aspect-video max-h-[75vh] rounded-3xl bg-gradient-to-br from-[#0c101c] to-[#070912] border-2 border-indigo-500/50 shadow-2xl shadow-indigo-950/40 overflow-hidden flex items-center justify-center group">
              {/* Local Video Stream */}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-200 ${
                  isVideoEnabled && localStream ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Video Disabled Avatar Display */}
              {(!isVideoEnabled || !localStream) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-[#0a0d16]">
                  <div className="h-28 w-28 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-4xl font-extrabold text-white shadow-2xl shadow-indigo-600/40 border-2 border-indigo-400/40">
                    You
                  </div>
                  <p className="text-sm font-bold text-white">You (Host / Participant)</p>
                  <p className="text-xs text-gray-400">Camera stream paused</p>
                </div>
              )}

              {/* Local Status Badges */}
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-xs font-semibold text-white flex items-center gap-2 shadow-lg">
                  <span>You {isHost ? '(Host)' : ''}</span>
                  {!isAudioEnabled && <MicOff className="h-3.5 w-3.5 text-rose-400" />}
                </div>

                {isAudioEnabled && (
                  <div className="px-2.5 py-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 flex items-center gap-1.5 shadow-lg">
                    <div className="h-1.5 w-10 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-75"
                        style={{ width: `${micVolume}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Waiting for other participants badge */}
              <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs text-indigo-300 font-medium flex items-center gap-1.5">
                <Share2 className="h-3.5 w-3.5 text-indigo-400" />
                <span>Share link to invite participants</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Meeting Controls Bar */}
      <footer className="h-20 px-4 sm:px-6 bg-[#0c101c]/90 border-t border-white/[0.08] backdrop-blur-2xl flex items-center justify-between z-20 shrink-0">
        {/* Left info */}
        <div className="hidden md:flex items-center gap-2 text-xs text-gray-400 font-mono">
          <span>ID: {meetingId}</span>
        </div>

        {/* Center: Controls Pill */}
        <div className="flex items-center gap-2 sm:gap-3 mx-auto">
          {/* Microphone */}
          <button
            onClick={toggleAudio}
            className={`h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
              isAudioEnabled
                ? 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
            }`}
            title={isAudioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {/* Camera */}
          <button
            onClick={toggleVideo}
            className={`h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
              isVideoEnabled
                ? 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
            }`}
            title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {isVideoEnabled ? <Camera className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            className={`h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
              isScreenSharing
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                : 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
            }`}
            title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
          >
            <MonitorUp className="h-5 w-5" />
          </button>

          {/* Reactions Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowReactionsBar(!showReactionsBar)}
              className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] text-white flex items-center justify-center transition-all cursor-pointer"
              title="Send Reaction"
            >
              <Smile className="h-5 w-5" />
            </button>

            {showReactionsBar && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 p-2 rounded-2xl bg-[#0c101c] border border-white/[0.1] shadow-2xl flex items-center gap-1.5 animate-in fade-in zoom-in-95">
                {['👍', '❤️', '👏', '🎉', '🔥', '😮'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleTriggerReaction(emoji)}
                    className="h-10 w-10 rounded-xl hover:bg-white/[0.1] text-xl flex items-center justify-center transition-transform hover:scale-125 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Leave / End Meeting Button */}
          <button
            onClick={() => {
              if (isHost) {
                setShowEndModal(true);
              } else {
                leaveRoom();
              }
            }}
            className="h-11 px-5 sm:h-12 sm:px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-rose-600/30 transition-all cursor-pointer active:scale-95"
          >
            <PhoneOff className="h-4 w-4" />
            <span>{isHost ? 'End Call' : 'Leave'}</span>
          </button>
        </div>

        {/* Right Info */}
        <div className="hidden md:flex items-center gap-2">
          <Badge variant="indigo" dot>
            WebRTC Active
          </Badge>
        </div>
      </footer >

      {/* Host End Meeting Confirmation Modal */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#0c101c] border border-white/[0.1] shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-white">Conclude Meeting</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              As the meeting host, you can end this session for all participants or leave while keeping the room open.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <Button variant="danger" onClick={endRoom}>
                End Meeting for Everyone
              </Button>
              <Button variant="secondary" onClick={leaveRoom}>
                Leave Meeting Alone
              </Button>
              <Button variant="ghost" onClick={() => setShowEndModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
