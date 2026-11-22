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
  Clock,
  PenTool,
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
import { WhiteboardCanvas, WhiteboardElement } from './whiteboard-canvas';
import { BroadcastNameplate } from './broadcast-nameplate';
import { BrandLogo } from '@/components/ui/brand-logo';
import { soundEngine } from '@/lib/audio/sound-engine';
import { useMeetingRecorder } from '@/lib/recording/use-meeting-recorder';
import { useResilientSignaling } from '@/lib/webrtc/use-resilient-signaling';
import {
  UnifiedStudioShell,
  StudioParticipantItem,
  StudioTile,
} from './unified-studio-shell';

function StreamVideoPlayer({
  stream,
  muted = false,
  mirror = false,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) {
      el.play().catch(() => {});
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={`w-full h-full object-cover ${mirror ? 'scale-x-[-1]' : ''}`}
    />
  );
}

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
    myDisplayName,
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
    connectToPeer,
    handlePeerOffer,
    handlePeerAnswer,
    handlePeerIceCandidate,
    registerIceCandidateHandler,
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
    displayName: myDisplayName || (isHost ? 'Host' : 'Participant'),
    role: isHost ? 'HOST' : 'PARTICIPANT',
    isJoined: true,
  });

  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false);
  const [showChatAndNotes, setShowChatAndNotes] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [wbElements, setWbElements] = useState<WhiteboardElement[]>([]);
  const [wbRedoStack, setWbRedoStack] = useState<WhiteboardElement[]>([]);
  const [httpKnocks, setHttpKnocks] = useState<Array<{ socketId: string; displayName: string; userId: string; requestedAt: number }>>([]);
  const [apiParticipants, setApiParticipants] = useState<Array<{ id: string; userId?: string; displayName: string; name: string; role: string; avatar?: string | null; joinedAt?: string | number | null }>>([]);

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
        toast.success('Recording started: Capturing Audio & Vedio');
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
            joinedAt: new Date().toISOString(),
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
          joinedAt: new Date().toISOString(),
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

  // Meeting duration timer (formats hh:mm:ss or mm:ss)
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const hours = Math.floor(elapsed / 3600);
      const mins = Math.floor((elapsed % 3600) / 60)
        .toString()
        .padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');
      if (hours > 0) {
        setMeetingDuration(`${hours.toString().padStart(2, '0')}:${mins}:${secs}`);
      } else {
        setMeetingDuration(`${mins}:${secs}`);
      }
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
      joinedAt?: string | number | null;
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
        joinedAt: sockInfo?.joinedAt,
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
          joinedAt: p.joinedAt,
        });
      }
    });

    // 3. Database / HTTPS Synced Participants
    apiParticipants.forEach((p) => {
      // Don't include current user in remote tiles
      if (myParticipantId && p.id === myParticipantId) return;

      const peerStream = remoteStreams.get(p.id);

      // Check if this participant is already registered in map by id or name
      const existingEntry = Array.from(map.values()).find(
        (existing) =>
          existing.id === p.id ||
          existing.displayName.trim().toLowerCase() === p.displayName.trim().toLowerCase()
      );

      if (existingEntry) {
        if (!existingEntry.stream && peerStream) {
          existingEntry.stream = peerStream;
          existingEntry.isVideoEnabled = peerStream.getVideoTracks().some((t) => t.enabled);
        }
        if (!existingEntry.joinedAt && p.joinedAt) {
          existingEntry.joinedAt = p.joinedAt;
        }
      } else {
        map.set(p.id, {
          id: p.id,
          displayName: p.displayName || p.name || 'Participant',
          role: p.role,
          avatar: p.avatar,
          stream: peerStream,
          isAudioEnabled: true,
          isVideoEnabled: peerStream ? peerStream.getVideoTracks().some((t) => t.enabled) : false,
          joinedAt: p.joinedAt || new Date().toISOString(),
        });
      }
    });

    return Array.from(map.values());
  }, [remotePeers, socketParticipants, apiParticipants, myParticipantId]);

  const totalParticipants = 1 + unifiedRemoteList.length;

  // Unique Peer ID for resilient signaling & WebRTC handshake
  const currentPeerId = useMemo(() => {
    if (myParticipantId) return myParticipantId;
    if (typeof window !== 'undefined') {
      let cached = sessionStorage.getItem(`metromeet_peer_${meetingId}`);
      if (!cached) {
        cached = isHost ? `host_${meetingId}` : `peer_${Math.random().toString(36).slice(2, 9)}`;
        sessionStorage.setItem(`metromeet_peer_${meetingId}`, cached);
      }
      return cached;
    }
    return isHost ? `host_${meetingId}` : `peer_${meetingId}`;
  }, [myParticipantId, isHost, meetingId]);

  const remotePeerIds = useMemo(() => {
    return unifiedRemoteList.map((p) => p.id);
  }, [unifiedRemoteList]);

  // Activate Resilient HTTPS WebRTC Signaling (Directly exchanges SDP & ICE candidates over port 443)
  useResilientSignaling({
    meetingId,
    myPeerId: currentPeerId,
    isHost,
    remotePeerIds,
    connectToPeer,
    handlePeerOffer,
    handlePeerAnswer,
    handlePeerIceCandidate,
    registerIceCandidateHandler,
  });

  const drawerParticipants = useMemo(() => {
    return unifiedRemoteList.map((p) => ({
      socketId: p.id,
      userId: p.id,
      displayName: p.displayName,
      role: p.role,
      isAudioEnabled: p.isAudioEnabled ?? true,
      isVideoEnabled: p.isVideoEnabled ?? false,
      isHandRaised: false,
      joinedAt: p.joinedAt ? new Date(p.joinedAt).getTime() : Date.now(),
    }));
  }, [unifiedRemoteList]);

  // Dynamic scalable layout engineered for up to 50 concurrent participants
  const getGridClasses = () => {
    if (totalParticipants === 1) return 'max-w-4xl w-full aspect-video mx-auto';
    if (totalParticipants === 2) return 'w-full grid grid-cols-1 md:grid-cols-2 gap-4 max-w-6xl mx-auto';
    if (totalParticipants <= 4) return 'w-full grid grid-cols-2 gap-3.5 max-w-6xl mx-auto';
    if (totalParticipants <= 9) return 'w-full grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-7xl mx-auto';
    if (totalParticipants <= 16) return 'w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-w-7xl mx-auto';
    if (totalParticipants <= 25) return 'w-full grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-w-7xl max-h-[72vh] overflow-y-auto p-1 mx-auto';
    return 'w-full grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-w-7xl max-h-[72vh] overflow-y-auto p-1 mx-auto';
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

  const localName = myDisplayName || (isHost ? 'Host' : 'Participant');
  const remoteEntries = Array.from(remoteStreams.entries());

  const unifiedTiles: StudioTile[] = [
    {
      key: 'local-webrtc',
      id: myParticipantId || 'local',
      name: localName,
      isLocal: true,
      isHost,
      isMicOn: isAudioEnabled,
      isSpeaking: isLocalSpeaking,
      isScreenShare: isScreenSharing,
      hasVideo: Boolean((isScreenSharing && screenStream) || (isVideoEnabled && localStream)),
      renderVideo: (mirrored) => (
        <StreamVideoPlayer
          stream={isScreenSharing && screenStream ? screenStream : localStream}
          muted={true}
          mirror={mirrored}
        />
      ),
    },
    ...remoteEntries.map(([peerId, stream]) => {
      const peerMeta =
        socketParticipants.find((p) => p.socketId === peerId || p.userId === peerId) ||
        apiParticipants.find((p) => p.id === peerId || p.userId === peerId);
      const peerName = peerMeta?.displayName || (peerMeta as any)?.name || 'Participant';
      const hasVid = stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');
      const hasAud = stream.getAudioTracks().some((t) => t.enabled && t.readyState === 'live');
      return {
        key: `remote-${peerId}`,
        id: peerId,
        name: peerName,
        isLocal: false,
        isMicOn: hasAud,
        isSpeaking: activeSpeakerId === peerId,
        hasVideo: hasVid,
        renderVideo: () => <StreamVideoPlayer stream={stream} muted={false} mirror={false} />,
      };
    }),
  ];

  const unifiedParticipants: StudioParticipantItem[] = [
    {
      id: myParticipantId || 'local',
      name: localName,
      isLocal: true,
      isHost,
      isMicOn: isAudioEnabled,
      isCamOn: isVideoEnabled,
    },
    ...remoteEntries.map(([peerId, stream]) => {
      const peerMeta =
        socketParticipants.find((p) => p.socketId === peerId || p.userId === peerId) ||
        apiParticipants.find((p) => p.id === peerId || p.userId === peerId);
      const peerName = peerMeta?.displayName || (peerMeta as any)?.name || 'Participant';
      return {
        id: peerId,
        name: peerName,
        isLocal: false,
        isMicOn: stream.getAudioTracks().some((t) => t.enabled),
        isCamOn: stream.getVideoTracks().some((t) => t.enabled),
      };
    }),
  ];

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {activeWaitingList.length > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[94%] max-w-md p-3.5 rounded-2xl bg-[#091222]/95 border-2 border-[#FF7A00] shadow-2xl shadow-[#FF7A00]/40 backdrop-blur-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#FF7A00] to-[#E65100] text-white flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-white truncate">
                {activeWaitingList[0].displayName}
              </p>
              <p className="text-[10.5px] text-[#FFA033] font-semibold">
                Requesting to join meeting
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => handleAdmitCandidate(activeWaitingList[0].socketId)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
            >
              Admit
            </button>
            <button
              onClick={() => handleDenyCandidate(activeWaitingList[0].socketId)}
              className="p-1.5 rounded-xl bg-white/[0.08] hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <UnifiedStudioShell
        meetingId={meetingId}
        meetingTitle={title || 'MetroMeet Session'}
        isHost={isHost}
        displayName={localName}
        tiles={unifiedTiles}
        participants={unifiedParticipants}
        isMicOn={isAudioEnabled}
        isCamOn={isVideoEnabled}
        isScreenSharing={isScreenSharing}
        onToggleMic={toggleAudio}
        onToggleCam={toggleVideo}
        onToggleScreenShare={() => {
          if (isScreenSharing) stopScreenShare();
          else void startScreenShare();
        }}
        onLeave={leaveRoom}
        onEndMeeting={async () => {
          endMeetingForAll();
          await endRoom();
        }}
      />
    </div>
  );
}
