'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  X,
  Lock,
  Unlock,
  Radio,
  Share2,
  Users,
  Hand,
  Volume2,
  Wifi,
  WifiOff,
  Disc,
  Square,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMeeting } from '@/lib/meeting/meeting-provider';
import { useVideo } from '@/lib/webrtc/video-provider';
import { useMeetingSocket } from '@/lib/socket/use-meeting-socket';
import { useToast } from '@/components/ui/toast';
import { RemoteVideoTile } from './remote-video-tile';
import { ParticipantDrawer } from './participant-drawer';
import { WaitingRoomScreen } from './waiting-room-screen';
import { ChatAndNotesDrawer } from './chat-and-notes-drawer';
import { BrandLogo } from '@/components/ui/brand-logo';
import { soundEngine } from '@/lib/audio/sound-engine';
import { useMeetingRecorder } from '@/lib/recording/use-meeting-recorder';

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
    myParticipantId,
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

  // Phase 4 & Phase 5 Socket.IO Signaling, Controls & Waiting Room
  const {
    connectionStatus,
    participants: socketParticipants,
    currentRole,
    isRoomLocked,
    isHandRaised,
    isWaitingForAdmission,
    waitingParticipants,
    waitingHostName,
    activeReaction: remoteReaction,
    sendReaction,
    toggleHandRaise,
    muteParticipant,
    muteAll,
    kickParticipant,
    assignRole,
    toggleRoomLock,
    admitParticipant,
    denyParticipant,
    admitAll,
    endMeetingForAll,
  } = useMeetingSocket({
    meetingId,
    displayName: isHost ? 'Host' : 'Participant',
    role: isHost ? 'HOST' : 'PARTICIPANT',
    isJoined: true,
  });

  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false);
  const [showChatAndNotes, setShowChatAndNotes] = useState(false);
  const [httpKnocks, setHttpKnocks] = useState<Array<{ socketId: string; displayName: string; userId: string; requestedAt: number }>>([]);
  const [apiParticipants, setApiParticipants] = useState<Array<{ id: string; userId?: string; displayName: string; name: string; role: string; avatar?: string | null }>>([]);

  // Phase 6 In-Meeting Audio & Video Recording Engine
  const {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
  } = useMeetingRecorder(title || `MetroMeet-${meetingId}`);

  const handleToggleRecording = async () => {
    if (isRecording) {
      stopRecording();
      toast.success('Meeting recording saved! Check your downloads.');
    } else {
      const remoteAudioList = Array.from(remoteStreams.values());
      const streamToRecord = isScreenSharing && screenStream ? screenStream : localStream;
      const started = await startRecording(streamToRecord, remoteAudioList);
      if (started) {
        toast.success('Recording started: Capturing Audio & Video');
      } else {
        toast.warning('Recording was canceled');
      }
    }
  };

  // Resilient HTTPS Polling for Active Room Participants
  const fetchParticipants = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/participants`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.participants)) {
        setApiParticipants(data.participants);
      }
    } catch (e) {
      console.warn('Fetch participants error:', e);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchParticipants();
    const interval = setInterval(fetchParticipants, 1500);
    return () => clearInterval(interval);
  }, [fetchParticipants]);

  // Resilient HTTPS Polling for Guest Knocks (Works on Vercel Serverless without port 3001)
  useEffect(() => {
    let previousCount = 0;
    const fetchKnocks = async () => {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/knocks`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.waitingList) {
          const list = data.waitingList.map((p: any) => ({
            socketId: p.id,
            displayName: p.displayName,
            userId: p.userId || p.id,
            requestedAt: new Date(p.joinedAt).getTime(),
          }));
          setHttpKnocks(list);

          if (list.length > previousCount) {
            soundEngine.playKnockChime();
          }
          previousCount = list.length;
        }
      } catch (err) {
        console.warn('Knocks polling note:', err);
      }
    };

    fetchKnocks();
    const interval = setInterval(fetchKnocks, 1200);
    return () => clearInterval(interval);
  }, [meetingId]);

  // Combined Waiting List: Socket.IO + HTTPS Fallback
  const activeWaitingList = useMemo(() => {
    const map = new Map<string, { socketId: string; displayName: string; userId: string; requestedAt: number }>();
    waitingParticipants.forEach((p) => map.set(p.socketId, p));
    httpKnocks.forEach((p) => map.set(p.socketId, p));
    return Array.from(map.values());
  }, [waitingParticipants, httpKnocks]);

  const handleAdmitCandidate = async (participantId: string) => {
    admitParticipant(participantId);

    // Instant optimistic insertion into participant list so name & card immediately show up in grid!
    const candidate = activeWaitingList.find((p) => p.socketId === participantId);
    if (candidate) {
      setApiParticipants((prev) => {
        if (prev.some((p) => p.id === participantId)) return prev;
        return [
          ...prev,
          {
            id: participantId,
            userId: candidate.userId,
            name: candidate.displayName,
            displayName: candidate.displayName,
            role: 'PARTICIPANT',
          },
        ];
      });
    }

    try {
      await fetch(`/api/meetings/${meetingId}/knocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ADMIT', participantId }),
      });
      setHttpKnocks((prev) => prev.filter((p) => p.socketId !== participantId));
      fetchParticipants();
      toast.success(`Admitted ${candidate?.displayName || 'participant'}`);
    } catch (e) {
      console.warn('Admit error:', e);
    }
  };

  const handleDenyCandidate = async (participantId: string) => {
    denyParticipant(participantId);
    try {
      await fetch(`/api/meetings/${meetingId}/knocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DENY', participantId }),
      });
      setHttpKnocks((prev) => prev.filter((p) => p.socketId !== participantId));
      toast.info('Declined participant request');
    } catch (e) {
      console.warn('Deny error:', e);
    }
  };

  const handleAdmitAllCandidates = async () => {
    admitAll();
    const waitingSnapshot = [...activeWaitingList];
    setApiParticipants((prev) => {
      const newItems = waitingSnapshot
        .filter((c) => !prev.some((p) => p.id === c.socketId))
        .map((c) => ({
          id: c.socketId,
          userId: c.userId,
          name: c.displayName,
          displayName: c.displayName,
          role: 'PARTICIPANT',
        }));
      return [...prev, ...newItems];
    });

    try {
      await fetch(`/api/meetings/${meetingId}/knocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ADMIT_ALL' }),
      });
      setHttpKnocks([]);
      fetchParticipants();
      toast.success('Admitted all waiting participants');
    } catch (e) {
      console.warn('Admit all error:', e);
    }
  };

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

  // Unified list of remote participants (combines WebRTC streams, Socket.IO, and HTTPS DB participants)
  const unifiedRemoteList = useMemo(() => {
    const map = new Map<string, {
      id: string;
      displayName: string;
      role: string;
      avatar?: string | null;
      stream?: MediaStream;
      isAudioEnabled?: boolean;
      isVideoEnabled?: boolean;
    }>();

    // 1. WebRTC Remote Streams (Direct P2P audio/video)
    remotePeers.forEach(([peerId, stream]) => {
      const sockInfo = socketParticipants.find((p) => p.socketId === peerId);
      map.set(peerId, {
        id: peerId,
        displayName: sockInfo?.displayName || 'Participant',
        role: sockInfo?.role || 'PARTICIPANT',
        stream,
        isAudioEnabled: sockInfo?.isAudioEnabled ?? true,
        isVideoEnabled: sockInfo?.isVideoEnabled ?? true,
      });
    });

    // 2. Socket.IO Participants
    socketParticipants.forEach((p) => {
      if (!map.has(p.socketId)) {
        map.set(p.socketId, {
          id: p.socketId,
          displayName: p.displayName,
          role: p.role,
          isAudioEnabled: p.isAudioEnabled,
          isVideoEnabled: p.isVideoEnabled,
        });
      }
    });

    // 3. Database / HTTPS Synced Participants
    apiParticipants.forEach((p) => {
      // Don't include current user in remote tiles
      if (myParticipantId && p.id === myParticipantId) return;

      // Check if this participant is already registered in map by id or name
      const exists = Array.from(map.values()).some(
        (existing) =>
          existing.id === p.id ||
          existing.displayName.trim().toLowerCase() === p.displayName.trim().toLowerCase()
      );

      if (!exists) {
        map.set(p.id, {
          id: p.id,
          displayName: p.displayName || p.name || 'Participant',
          role: p.role,
          avatar: p.avatar,
          isAudioEnabled: true,
          isVideoEnabled: false,
        });
      }
    });

    return Array.from(map.values());
  }, [remotePeers, socketParticipants, apiParticipants, myParticipantId]);

  const totalParticipants = 1 + unifiedRemoteList.length;

  const drawerParticipants = useMemo(() => {
    return unifiedRemoteList.map((p) => ({
      socketId: p.id,
      userId: p.id,
      displayName: p.displayName,
      role: p.role,
      isAudioEnabled: p.isAudioEnabled ?? true,
      isVideoEnabled: p.isVideoEnabled ?? false,
      isHandRaised: false,
      joinedAt: Date.now(),
    }));
  }, [unifiedRemoteList]);

  // Grid layout class based on participant count
  const getGridClasses = () => {
    if (totalParticipants === 1) return 'max-w-4xl w-full aspect-video';
    if (totalParticipants === 2) return 'w-full grid grid-cols-1 md:grid-cols-2 gap-4 max-w-6xl';
    if (totalParticipants <= 4) return 'w-full grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-6xl';
    return 'w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl';
  };

  const isLocalSpeaking = activeSpeakerId === 'local' && micVolume > 20;

  if (isWaitingForAdmission) {
    return (
      <WaitingRoomScreen
        meetingTitle={title || 'MetroMeet Session'}
        hostName={waitingHostName}
        onLeave={leaveRoom}
      />
    );
  }

  return (
    <div className="h-screen w-screen bg-[#06080e] text-slate-100 flex flex-col overflow-hidden select-none relative">
      {/* Reaction Float Animation */}
      {activeReaction && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-8xl z-50 animate-bounce pointer-events-none drop-shadow-2xl">
          {activeReaction}
        </div>
      )}

      {/* Prominent Floating Admission Alert (Visible on Mobile & Desktop) */}
      {activeWaitingList.length > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-md p-3.5 rounded-2xl bg-[#091222]/95 border-2 border-[#FF7A00] shadow-2xl shadow-[#FF7A00]/40 backdrop-blur-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#FF7A00] to-[#E65100] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#FF7A00]/30">
              <Users className="h-5 w-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#FF7A00] animate-ping" />
                <p className="text-sm font-black text-white truncate">
                  {activeWaitingList[0].displayName}
                </p>
              </div>
              <p className="text-[11px] text-[#FFA033] font-semibold">
                Requesting to join meeting
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => handleAdmitCandidate(activeWaitingList[0].socketId)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>Admit</span>
            </button>

            {activeWaitingList.length > 1 && (
              <button
                onClick={handleAdmitAllCandidates}
                className="px-2.5 py-1.5 rounded-xl bg-[#0066FF] hover:bg-[#1E78FF] text-white font-bold text-xs transition-all cursor-pointer"
              >
                All
              </button>
            )}

            <button
              onClick={() => handleDenyCandidate(activeWaitingList[0].socketId)}
              className="p-1.5 rounded-xl bg-white/[0.08] hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 transition-all cursor-pointer"
              title="Decline"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Meeting Header Bar */}
      <header className="h-16 px-4 sm:px-6 border-b border-[#0066FF]/20 bg-[#091222]/90 backdrop-blur-xl flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <BrandLogo size="sm" showTagline={false} className="mr-2 hidden md:inline-flex" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">{title}</h2>
              <span className="text-xs text-gray-400 font-mono hidden sm:inline">({meetingId})</span>
              {isHost && (
                <Badge variant="blue" dot>
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
                      ? 'bg-[#FF7A00] animate-pulse'
                      : 'bg-[#0066FF]'
                  }`}
                />
                <span className="capitalize">{connectionStatus}</span>
                <span>({totalParticipants} online)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Center / Right Notification Banner for Knock Requests */}
        {activeWaitingList.length > 0 && (isHost || currentRole === 'CO_HOST') && (
          <div className="hidden sm:flex items-center gap-2 bg-[#FF7A00]/20 border border-[#FF7A00]/40 px-3 py-1.5 rounded-xl shadow-lg shadow-[#FF7A00]/10 animate-pulse">
            <span className="text-xs text-[#FFA033] font-bold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#FF7A00] animate-ping" />
              {activeWaitingList.length} waiting to join
            </span>
            <button
              onClick={() => handleAdmitCandidate(activeWaitingList[0].socketId)}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all cursor-pointer shadow-sm"
            >
              Admit {activeWaitingList[0].displayName.split(' ')[0]}
            </button>
            <button
              onClick={() => setShowParticipantsDrawer(true)}
              className="text-[11px] text-[#388BFF] hover:underline font-semibold cursor-pointer"
            >
              View All
            </button>
          </div>
        )}

        {/* Top Right Header Controls */}
        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-rose-600/20 border border-rose-500/50 text-rose-300 font-mono text-xs shadow-lg shadow-rose-600/20 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              <span className="font-bold">REC {recordingDuration}</span>
              <button
                onClick={handleToggleRecording}
                className="ml-1 px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-sans text-[10px] font-bold cursor-pointer transition-transform active:scale-95"
              >
                Stop
              </button>
            </div>
          )}

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
                {unifiedRemoteList.length === 0 && (
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs text-[#388BFF] font-medium flex items-center gap-1.5 shadow-lg">
                    <Share2 className="h-3.5 w-3.5 text-[#388BFF]" />
                    <span>Share link to invite participants</span>
                  </div>
                )}
              </div>

              {/* Remote Participants Cards (Instant Dynamic Rendering) */}
              {unifiedRemoteList.map((participant) => {
                if (participant.stream) {
                  return (
                    <RemoteVideoTile
                      key={participant.id}
                      peerId={participant.id}
                      name={participant.displayName}
                      stream={participant.stream}
                      isSpeaking={activeSpeakerId === participant.id}
                      quality={networkQuality.get(participant.id)}
                      isAudioEnabled={participant.isAudioEnabled ?? true}
                      isVideoEnabled={participant.isVideoEnabled ?? true}
                    />
                  );
                }

                const initials =
                  participant.displayName
                    .split(' ')
                    .map((n) => n[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'P';

                return (
                  <div
                    key={participant.id}
                    className="relative w-full aspect-video rounded-3xl bg-gradient-to-br from-[#091222] via-[#050a14] to-[#0c182c] border-2 border-[#0066FF]/35 shadow-2xl overflow-hidden flex flex-col items-center justify-center p-6 transition-all duration-300 hover:border-[#FF7A00]/50 group animate-in zoom-in-95"
                  >
                    {/* Ambient Glow */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#0066FF]/15 via-transparent to-[#FF7A00]/15 pointer-events-none" />

                    {/* Dedicated unmuted audio element for voice clarity */}
                    {remoteStreams.get(participant.id) && (
                      <audio
                        ref={(el) => {
                          if (el) {
                            const str = remoteStreams.get(participant.id);
                            if (str && el.srcObject !== str) {
                              el.srcObject = str;
                              el.volume = 1.0;
                              el.play().catch(() => {});
                            }
                          }
                        }}
                        autoPlay
                        playsInline
                        className="hidden"
                      />
                    )}

                    {/* Participant Avatar with MetroNet Pulse Aura */}
                    <div className="relative mb-3.5">
                      <div className="absolute -inset-2.5 rounded-full bg-gradient-to-r from-[#0066FF] to-[#FF7A00] opacity-40 blur-lg animate-pulse" />
                      <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gradient-to-tr from-[#0057B7] to-[#002D62] text-white flex items-center justify-center text-2xl sm:text-3xl font-black shadow-2xl shadow-[#0066FF]/50 border-2 border-white/20">
                        {initials}
                      </div>
                    </div>

                    {/* Participant Name & Badges */}
                    <div className="text-center space-y-1.5 relative z-10 max-w-[85%]">
                      <h3 className="text-base sm:text-lg font-bold text-white tracking-tight truncate drop-shadow-md">
                        {participant.displayName}
                      </h3>
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            participant.role === 'HOST'
                              ? 'bg-[#FF7A00]/20 text-[#FFA033] border border-[#FF7A00]/40'
                              : 'bg-[#0066FF]/20 text-[#388BFF] border border-[#0066FF]/40'
                          }`}
                        >
                          {participant.role}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                          Connected
                        </span>
                      </div>
                    </div>

                    {/* Bottom Status Bar */}
                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-gray-400">
                      <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 shadow-sm">
                        <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-[11px] text-gray-300 font-semibold">Audio Ready</span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium">MetroNet Low-Latency</span>
                    </div>
                  </div>
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
              activeWaitingList.length > 0
                ? 'bg-[#FF7A00] text-black font-bold ring-4 ring-[#FF7A00]/40 shadow-xl shadow-[#FF7A00]/40 animate-pulse'
                : showParticipantsDrawer
                ? 'bg-[#0066FF] hover:bg-[#1E78FF] text-white shadow-[#0066FF]/30'
                : 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
            }`}
            title={activeWaitingList.length > 0 ? `${activeWaitingList.length} person waiting to join!` : "Manage Participants"}
          >
            <Users className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-[#0066FF] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#070912]">
              {totalParticipants}
            </span>
            {activeWaitingList.length > 0 && (
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-emerald-500 text-white text-[9px] font-black rounded-full animate-bounce shadow">
                +{activeWaitingList.length}
              </span>
            )}
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

          {/* Audio & Video Recording Toggle Button */}
          <button
            onClick={handleToggleRecording}
            className={`h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
              isRecording
                ? 'bg-rose-600 hover:bg-rose-500 text-white ring-4 ring-rose-600/40 shadow-xl shadow-rose-600/40 animate-pulse'
                : 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
            }`}
            title={isRecording ? `Stop Recording (${recordingDuration})` : 'Record Audio & Video'}
          >
            {isRecording ? <Square className="h-4 w-4 fill-white" /> : <Disc className="h-5 w-5 text-rose-400" />}
          </button>

          {/* Meeting Chat & Notepad Drawer Toggle */}
          <button
            onClick={() => setShowChatAndNotes(!showChatAndNotes)}
            className={`relative h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
              showChatAndNotes
                ? 'bg-gradient-to-r from-[#FF7A00] to-[#E65100] text-white shadow-xl shadow-[#FF7A00]/40'
                : 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
            }`}
            title="Chat & Meeting Notepad"
          >
            <MessageSquare className="h-5 w-5" />
          </button>

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
        participants={drawerParticipants}
        waitingParticipants={activeWaitingList}
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
        onAdmitParticipant={handleAdmitCandidate}
        onDenyParticipant={handleDenyCandidate}
        onAdmitAll={handleAdmitAllCandidates}
      />

      {/* In-Meeting Group Chat & Collaborative Notepad Drawer */}
      <ChatAndNotesDrawer
        isOpen={showChatAndNotes}
        onClose={() => setShowChatAndNotes(false)}
        meetingId={meetingId}
        meetingTitle={title}
        localUserName={isHost ? 'Person 1 (Host)' : 'Person 2'}
      />
    </div>
  );
}
