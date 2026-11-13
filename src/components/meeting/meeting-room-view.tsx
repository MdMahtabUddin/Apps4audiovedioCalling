'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Camera,
  VideoOff,
  MonitorUp,
  Smile,
  PhoneOff,
  Copy,
  Check,
  Lock,
  Unlock,
  Radio,
  Share2,
  Users,
  Hand,
  Volume2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMeeting } from '@/lib/meeting/meeting-provider';
import { useVideo } from '@/lib/webrtc/video-provider';
import { useMeetingSocket } from '@/lib/socket/use-meeting-socket';
import { useToast } from '@/components/ui/toast';
import { RemoteVideoTile } from './remote-video-tile';
import { ParticipantDrawer } from './participant-drawer';

export function MeetingRoomView() {
  const toast = useToast();
  const {
    meetingId,
    title,
    isHost,
    isLocked,
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
    remoteStreams,
    activeSpeakerId,
    networkQuality,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
  } = useVideo();

  // Phase 4 & Phase 5 Socket.IO Signaling & Controls
  const {
    connectionStatus,
    participants: socketParticipants,
    currentRole,
    isRoomLocked,
    isHandRaised,
    activeReaction: remoteReaction,
    sendReaction,
    toggleHandRaise,
    muteParticipant,
    muteAll,
    kickParticipant,
    assignRole,
    toggleRoomLock,
    endMeetingForAll,
  } = useMeetingSocket({
    meetingId,
    displayName: isHost ? 'Host' : 'Participant',
    role: isHost ? 'HOST' : 'PARTICIPANT',
    isJoined: true,
  });

  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  const [copied, setCopied] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState('00:00');
  const [activeReaction, setActiveReaction] = useState<string | null>(null);
  const [showReactionsBar, setShowReactionsBar] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);

  // Sync remote reaction received via socket
  useEffect(() => {
    if (remoteReaction) {
      setActiveReaction(remoteReaction.emoji);
      const timer = setTimeout(() => setActiveReaction(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [remoteReaction]);

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
    sendReaction(emoji);
    setShowReactionsBar(false);
    setTimeout(() => setActiveReaction(null), 2500);
  };

  // Convert remoteStreams Map to array for rendering
  const remotePeers = Array.from(remoteStreams.entries());
  const totalParticipants = 1 + Math.max(remotePeers.length, socketParticipants.length);

  // Grid layout class based on participant count
  const getGridClasses = () => {
    if (totalParticipants === 1) return 'max-w-4xl w-full aspect-video';
    if (totalParticipants === 2) return 'w-full grid grid-cols-1 md:grid-cols-2 gap-4 max-w-6xl';
    if (totalParticipants <= 4) return 'w-full grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-6xl';
    return 'w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl';
  };

  const isLocalSpeaking = activeSpeakerId === 'local' && micVolume > 20;

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
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span
                  className={`h-2 w-2 rounded-full ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-400 animate-pulse'
                      : connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-indigo-400'
                  }`}
                />
                <span className="capitalize">{connectionStatus}</span>
                <span>({totalParticipants} online)</span>
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

          <Button size="sm" variant="secondary" onClick={handleCopyLink} className="text-xs">
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
      <main className="flex-1 p-3 sm:p-5 relative flex items-center justify-center overflow-y-auto">
        {/* If screen sharing is active, show large screen share + participant sidebar/filmstrip */}
        {isScreenSharing && screenStream ? (
          <div className="w-full h-full flex flex-col lg:flex-row gap-4 items-center justify-center">
            {/* Big Screen Share Tile */}
            <div className="flex-1 w-full h-full rounded-3xl bg-black border border-white/[0.1] overflow-hidden flex items-center justify-center relative shadow-2xl">
              <video ref={screenVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
              <div className="absolute top-4 left-4 bg-black/70 backdrop-blur px-3 py-1.5 rounded-xl border border-white/10 text-xs font-semibold text-white flex items-center gap-2">
                <MonitorUp className="h-4 w-4 text-indigo-400" />
                <span>You are sharing your screen</span>
              </div>
            </div>

            {/* Thumbnail Local & Remote Video Tiles Filmstrip */}
            <div className="w-full lg:w-72 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto shrink-0 max-h-[75vh]">
              {/* Local Thumbnail Tile */}
              <div
                className={`w-48 lg:w-full aspect-video rounded-2xl bg-[#0c101c] overflow-hidden relative shadow-xl shrink-0 transition-all ${
                  isLocalSpeaking ? 'ring-2 ring-emerald-400' : 'border border-white/10'
                }`}
              >
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
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/60 text-[10px] text-white font-medium flex items-center gap-1">
                  <span>You</span>
                  {!isAudioEnabled && <MicOff className="h-3 w-3 text-rose-400" />}
                </div>
              </div>

              {/* Remote Participant Filmstrip Tiles */}
              {remotePeers.map(([peerId, stream]) => {
                const info = socketParticipants.find((p) => p.socketId === peerId);
                return (
                  <div key={peerId} className="w-48 lg:w-full shrink-0">
                    <RemoteVideoTile
                      peerId={peerId}
                      name={info?.displayName}
                      stream={stream}
                      isSpeaking={activeSpeakerId === peerId}
                      quality={networkQuality.get(peerId)}
                      isAudioEnabled={info?.isAudioEnabled ?? true}
                      isVideoEnabled={info?.isVideoEnabled ?? true}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Multi-Participant Dynamic Grid Layout */
          <div className="w-full h-full flex items-center justify-center">
            <div className={getGridClasses()}>
              {/* Local Participant Card */}
              <div
                className={`relative w-full aspect-video rounded-3xl bg-gradient-to-br from-[#0c101c] to-[#070912] shadow-2xl overflow-hidden flex items-center justify-center transition-all duration-300 group ${
                  isLocalSpeaking
                    ? 'ring-4 ring-emerald-500 shadow-emerald-500/25'
                    : 'border-2 border-indigo-500/40 shadow-indigo-950/40'
                }`}
              >
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
                    <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-3xl font-extrabold text-white shadow-2xl shadow-indigo-600/40 border-2 border-indigo-400/40">
                      You
                    </div>
                    <p className="text-sm font-bold text-white">You {isHost ? '(Host)' : ''}</p>
                    <p className="text-xs text-gray-400">Camera stream paused</p>
                  </div>
                )}

                {/* Local Status Badges */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-xs font-semibold text-white flex items-center gap-2 shadow-lg">
                    <span>You {isHost ? '(Host)' : ''}</span>
                    {!isAudioEnabled && <MicOff className="h-3.5 w-3.5 text-rose-400" />}
                    {isLocalSpeaking && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                        <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                        Speaking
                      </span>
                    )}
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

                {/* Single participant invitation prompt */}
                {remotePeers.length === 0 && (
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs text-indigo-300 font-medium flex items-center gap-1.5">
                    <Share2 className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Share link to invite participants</span>
                  </div>
                )}
              </div>

              {/* Remote Participants Cards */}
              {remotePeers.map(([peerId, stream]) => {
                const info = socketParticipants.find((p) => p.socketId === peerId);
                return (
                  <RemoteVideoTile
                    key={peerId}
                    peerId={peerId}
                    name={info?.displayName}
                    stream={stream}
                    isSpeaking={activeSpeakerId === peerId}
                    quality={networkQuality.get(peerId)}
                    isAudioEnabled={info?.isAudioEnabled ?? true}
                    isVideoEnabled={info?.isVideoEnabled ?? true}
                  />
                );
              })}
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

          {/* Raise Hand Toggle */}
          <button
            onClick={toggleHandRaise}
            className={`h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
              isHandRaised
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/30 font-bold ring-2 ring-amber-400'
                : 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
            }`}
            title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
          >
            <Hand className="h-5 w-5" />
          </button>

          {/* Participants Drawer Toggle */}
          <button
            onClick={() => setShowParticipantsDrawer(!showParticipantsDrawer)}
            className={`relative h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
              showParticipantsDrawer
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                : 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
            }`}
            title="Manage Participants"
          >
            <Users className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-indigo-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#070912]">
              {totalParticipants}
            </span>
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
            Signaling Live
          </Badge>
        </div>
      </footer>

      {/* Host End Meeting Confirmation Modal */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#0c101c] border border-white/[0.1] shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-white">Conclude Meeting</h3>
            <p className="text-sm text-gray-400">
              As the meeting host, would you like to leave the call or conclude the session for all participants?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="danger"
                className="flex-1"
                onClick={async () => {
                  setShowEndModal(false);
                  endMeetingForAll();
                  await endRoom();
                }}
              >
                End Meeting for All
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowEndModal(false);
                  leaveRoom();
                }}
              >
                Leave Only
              </Button>
            </div>
            <button
              onClick={() => setShowEndModal(false)}
              className="w-full text-xs text-gray-400 hover:text-white pt-2 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {/* Participant Management Drawer */}
      <ParticipantDrawer
        isOpen={showParticipantsDrawer}
        onClose={() => setShowParticipantsDrawer(false)}
        participants={socketParticipants}
        localUser={{
          name: isHost ? 'Host' : 'Participant',
          role: currentRole,
          isAudioEnabled,
          isVideoEnabled,
          isHandRaised,
        }}
        currentUserRole={currentRole}
        isRoomLocked={isRoomLocked || isLocked}
        onToggleRoomLock={(locked) => {
          toggleRoomLock(locked);
          toggleLock();
        }}
        onMuteParticipant={muteParticipant}
        onMuteAll={muteAll}
        onKickParticipant={kickParticipant}
        onAssignRole={assignRole}
        onToggleLocalHandRaise={toggleHandRaise}
      />
    </div>
  );
}
