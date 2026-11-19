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
  FlipHorizontal,
  Pin,
  PinOff,
  Volume2,
  VolumeX,
  X,
  Crown,
  UserCheck,
  UserMinus,
  BarChart2,
  Megaphone,
  Camera,
  Keyboard,
} from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { soundEngine } from '@/lib/audio/sound-engine';
import { useToast } from '@/components/ui/toast';
import { useMeetingRecorder } from '@/lib/recording/use-meeting-recorder';
import { RTC_CONFIG } from '@/lib/webrtc/webrtc-mesh';
import { ChatAndNotesDrawer, ChatMessage } from './chat-and-notes-drawer';
import { WhiteboardCanvas, WhiteboardElement } from './whiteboard-canvas';
import { BroadcastNameplate } from './broadcast-nameplate';

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
  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showHostExitModal, setShowHostExitModal] = useState(false);
  const [coHosts, setCoHosts] = useState<Record<string, boolean>>({});
  const [wbElements, setWbElements] = useState<WhiteboardElement[]>([]);
  const [wbRedoStack, setWbRedoStack] = useState<WhiteboardElement[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_lk',
      sender: 'MetroMeet Bot',
      isLocal: false,
      text: 'Welcome! You can chat with Everyone or send Private Messages (DM) to any participant.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatRecipientId, setChatRecipientId] = useState<string>('ALL');
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const showChatRef = useRef(showChatAndNotes);
  useEffect(() => {
    showChatRef.current = showChatAndNotes;
    if (showChatAndNotes) setUnreadChatCount(0);
  }, [showChatAndNotes]);
  const [showReactionsBar, setShowReactionsBar] = useState(false);

  // Live Interactive Poll State
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionsInput, setPollOptionsInput] = useState(['Yes', 'No', 'Need more info']);
  const [activePoll, setActivePoll] = useState<{
    id: string;
    question: string;
    createdBy: string;
    options: Array<{ id: string; text: string; votes: string[] }>;
  } | null>(null);

  // TV Broadcast Breaking Banner State
  const [broadcastBanner, setBroadcastBanner] = useState<{ text: string; author: string } | null>(null);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [bannerDraft, setBannerDraft] = useState('');

  // Keyboard Shortcuts Modal
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
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

  // Camera Mirroring State (Default: true for natural webcam mirror orientation)
  const [isMirrored, setIsMirrored] = useState(true);

  // Spotlight / Pinned Track Key
  const [pinnedTrackKey, setPinnedTrackKey] = useState<string | null>(null);

  // Picture in Picture Toggle
  const togglePiP = async () => {
    try {
      const videos = Array.from(document.querySelectorAll('video'));
      const activeVideo = videos.find((v) => v.readyState >= 2 && !v.paused) || videos[0];
      if (!activeVideo) {
        toast.info('No active video found for Picture-in-Picture');
        return;
      }
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        toast.info('Exited Picture-in-Picture');
      } else {
        await activeVideo.requestPictureInPicture();
        toast.success('Picture-in-Picture activated');
      }
    } catch {
      toast.info('Picture-in-Picture is not supported in this browser');
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
        } else if (data.type === 'cohost-update' && data.identity) {
          setCoHosts((prev) => ({ ...prev, [data.identity]: Boolean(data.isCoHost) }));
          if (data.name) {
            toast.info(
              data.isCoHost
                ? `🛡️ ${data.name} is now a Co-Host`
                : `${data.name} is no longer a Co-Host`
            );
          }
        } else if (data.type === 'wb-add' && data.element) {
          setWbElements((prev) =>
            prev.some((e) => e.id === data.element.id) ? prev : [...prev, data.element]
          );
        } else if (data.type === 'wb-clear') {
          setWbElements([]);
          setWbRedoStack([]);
        } else if (data.type === 'host-media-control') {
          const myId = room?.localParticipant?.identity;
          const isTarget =
            data.targetIdentity === myId || (data.targetIdentity === 'ALL' && !isHost);
          if (isTarget && room?.localParticipant) {
            if (data.media === 'mic') {
              room.localParticipant.setMicrophoneEnabled(Boolean(data.enabled)).catch(() => {});
              toast.info(
                data.enabled
                  ? `🎤 ${data.byName || 'Host'} turned ON your microphone`
                  : `🔇 ${data.byName || 'Host'} muted your microphone`
              );
            } else if (data.media === 'cam') {
              room.localParticipant.setCameraEnabled(Boolean(data.enabled)).catch(() => {});
              toast.info(
                data.enabled
                  ? `📹 ${data.byName || 'Host'} turned ON your vedio`
                  : `📷 ${data.byName || 'Host'} turned OFF your vedio`
              );
            }
          }
        } else if (data.type === 'chat-msg' && data.text) {
          const myId = room?.localParticipant?.identity;
          // Ignore echoes of our own messages
          if (data.senderIdentity && data.senderIdentity === myId) return;
          // Private message visibility check: only intended recipient sees it
          if (data.isPrivate && data.recipientIdentity !== myId) return;

          const incomingMsg: ChatMessage = {
            id: data.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            sender: data.senderName || participant?.name || 'Participant',
            senderId: data.senderIdentity || participant?.identity,
            isLocal: false,
            text: data.text,
            timestamp:
              data.timestamp ||
              new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isPrivate: Boolean(data.isPrivate),
            recipientId: data.recipientIdentity,
            recipientName: data.recipientName,
          };

          setChatMessages((prev) =>
            prev.some((m) => m.id === incomingMsg.id) ? prev : [...prev, incomingMsg]
          );

          if (!showChatRef.current) {
            setUnreadChatCount((c) => c + 1);
            soundEngine.playKnockChime();
            if (incomingMsg.isPrivate) {
              toast.info(`🔒 Private message from ${incomingMsg.sender}`);
            } else {
              toast.info(`💬 ${incomingMsg.sender}: ${incomingMsg.text.slice(0, 40)}`);
            }
          }
        } else if (data.type === 'poll-create' && data.poll) {
          setActivePoll(data.poll);
          soundEngine.playIntroChime();
          toast.info(`📊 New Live Poll: ${data.poll.question}`);
        } else if (data.type === 'poll-vote' && data.pollId && data.optionId && data.voterId) {
          setActivePoll((prev) => {
            if (!prev || prev.id !== data.pollId) return prev;
            return {
              ...prev,
              options: prev.options.map((opt) => {
                const withoutVoter = opt.votes.filter((v) => v !== data.voterId);
                return opt.id === data.optionId
                  ? { ...opt, votes: [...withoutVoter, data.voterId] }
                  : { ...opt, votes: withoutVoter };
              }),
            };
          });
        } else if (data.type === 'poll-close') {
          setActivePoll(null);
        } else if (data.type === 'broadcast-banner') {
          setBroadcastBanner(data.banner || null);
          if (data.banner?.text) {
            soundEngine.playIntroChime();
          }
        }
      } catch {}
    };

    room.on('dataReceived', handleDataReceived);
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room, toast, isHost]);

  const handleLaunchPoll = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOptions = pollOptionsInput.map((o) => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() || cleanOptions.length < 2) {
      toast.error('Please enter a question and at least 2 options');
      return;
    }
    const newPoll = {
      id: `poll_${Date.now()}`,
      question: pollQuestion.trim(),
      createdBy: displayName || 'Host',
      options: cleanOptions.map((text, idx) => ({
        id: `opt_${idx}_${Date.now()}`,
        text,
        votes: [] as string[],
      })),
    };
    setActivePoll(newPoll);
    setShowPollModal(false);
    setPollQuestion('');
    toast.success('Live poll launched to all participants!');
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({ type: 'poll-create', poll: newPoll })
      );
      room?.localParticipant.publishData(payload, { reliable: true });
    } catch {}
  };

  const handleVotePoll = (optionId: string) => {
    if (!activePoll) return;
    const voterId = localParticipant?.identity || 'local';
    setActivePoll((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        options: prev.options.map((opt) => {
          const withoutVoter = opt.votes.filter((v) => v !== voterId);
          return opt.id === optionId
            ? { ...opt, votes: [...withoutVoter, voterId] }
            : { ...opt, votes: withoutVoter };
        }),
      };
    });
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          type: 'poll-vote',
          pollId: activePoll.id,
          optionId,
          voterId,
        })
      );
      room?.localParticipant.publishData(payload, { reliable: true });
    } catch {}
  };

  const handleClosePoll = () => {
    setActivePoll(null);
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ type: 'poll-close' }));
      room?.localParticipant.publishData(payload, { reliable: true });
    } catch {}
  };

  const handleSetBroadcastBanner = (banner: { text: string; author: string } | null) => {
    setBroadcastBanner(banner);
    setShowBannerModal(false);
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({ type: 'broadcast-banner', banner })
      );
      room?.localParticipant.publishData(payload, { reliable: true });
    } catch {}
    toast.success(banner ? 'TV Announcement Banner is now ON AIR' : 'Announcement banner cleared');
  };

  const handleCaptureSnapshot = () => {
    try {
      const videos = Array.from(document.querySelectorAll('video'));
      const activeVideo = videos.find((v) => v.readyState >= 2 && v.videoWidth > 0);
      if (!activeVideo) {
        toast.info('No active vedio stream to capture');
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = activeVideo.videoWidth;
      canvas.height = activeVideo.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(activeVideo, 0, 0, canvas.width, canvas.height);
      const link = document.createElement('a');
      link.download = `MetroMeet-Snapshot-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      soundEngine.playKnockChime();
      toast.success('Snapshot captured & downloaded as PNG!');
    } catch {
      toast.error('Could not capture snapshot');
    }
  };

  // Global keyboard shortcuts inside the live meeting
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === 'm' && localParticipant) {
        localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled).catch(() => {});
      } else if (key === 'v' && localParticipant) {
        localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled).catch(() => {});
      } else if (key === 'w') {
        setShowWhiteboard((prev) => !prev);
      } else if (key === 'p') {
        setShowParticipantsDrawer((prev) => !prev);
      } else if (key === 'c') {
        setShowChatAndNotes((prev) => !prev);
      } else if (key === 'f') {
        toggleFullscreen();
      } else if (key === '?') {
        setShowShortcutsModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [localParticipant]);

  const hasHostPrivileges = isHost || Boolean(localParticipant && coHosts[localParticipant.identity]);

  const handleHostControlMedia = (
    targetIdentity: string,
    targetName: string,
    media: 'mic' | 'cam',
    enabled: boolean
  ) => {
    if (localParticipant && targetIdentity === localParticipant.identity) {
      if (media === 'mic') {
        localParticipant.setMicrophoneEnabled(enabled).catch(() => {});
      } else {
        localParticipant.setCameraEnabled(enabled).catch(() => {});
      }
      return;
    }

    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          type: 'host-media-control',
          targetIdentity,
          media,
          enabled,
          byName: displayName,
        })
      );
      room?.localParticipant.publishData(
        payload,
        targetIdentity === 'ALL'
          ? { reliable: true }
          : { reliable: true, destinationIdentities: [targetIdentity] }
      );
      const actionLabel =
        media === 'mic'
          ? enabled
            ? 'Unmuted'
            : 'Muted'
          : enabled
          ? 'Turned ON vedio for'
          : 'Turned OFF vedio for';
      toast.success(`${actionLabel} ${targetIdentity === 'ALL' ? 'all participants' : targetName}`);
    } catch {}
  };

  const handleSendChatMessage = (
    text: string,
    recipient?: { id: string; name: string } | null
  ) => {
    const myId = localParticipant?.identity || 'local';
    const isPrivate = Boolean(recipient);
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const outgoing: ChatMessage = {
      id: msgId,
      sender: displayName || 'You',
      senderId: myId,
      isLocal: true,
      text,
      timestamp,
      isPrivate,
      recipientId: recipient?.id,
      recipientName: recipient?.name,
    };

    setChatMessages((prev) => [...prev, outgoing]);

    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          type: 'chat-msg',
          id: msgId,
          senderIdentity: myId,
          senderName: displayName || 'Participant',
          text,
          timestamp,
          isPrivate,
          recipientIdentity: recipient?.id || null,
          recipientName: recipient?.name || null,
        })
      );
      room?.localParticipant.publishData(
        payload,
        isPrivate && recipient
          ? { reliable: true, destinationIdentities: [recipient.id] }
          : { reliable: true }
      );
    } catch {}
  };

  const handleOpenPrivateChat = (targetIdentity: string) => {
    setChatRecipientId(targetIdentity);
    setShowParticipantsDrawer(false);
    setShowChatAndNotes(true);
  };

  const handleToggleCoHost = (identity: string, name: string) => {
    const nextIsCoHost = !coHosts[identity];
    setCoHosts((prev) => ({ ...prev, [identity]: nextIsCoHost }));
    toast.success(
      nextIsCoHost
        ? `${name} has been promoted to Co-Host`
        : `Co-Host role removed from ${name}`
    );
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({ type: 'cohost-update', identity, name, isCoHost: nextIsCoHost })
      );
      room?.localParticipant.publishData(payload, { reliable: true });
    } catch {}
  };

  const handleWhiteboardAdd = (el: WhiteboardElement) => {
    setWbElements((prev) => [...prev, el]);
    setWbRedoStack([]);
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ type: 'wb-add', element: el }));
      room?.localParticipant.publishData(payload, { reliable: true });
    } catch {}
  };

  const handleWhiteboardUndo = () => {
    setWbElements((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setWbRedoStack((r) => [...r, last]);
      return prev.slice(0, -1);
    });
  };

  const handleWhiteboardRedo = () => {
    setWbRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setWbElements((els) => [...els, last]);
      return prev.slice(0, -1);
    });
  };

  const handleWhiteboardClear = () => {
    setWbElements([]);
    setWbRedoStack([]);
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ type: 'wb-clear' }));
      room?.localParticipant.publishData(payload, { reliable: true });
    } catch {}
  };

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

  // Order tracks so pinned track comes first
  const orderedTracks = useMemo(() => {
    if (!pinnedTrackKey) return tracks;
    const pinned = tracks.find((t) => `${t.participant.identity}-${t.source}` === pinnedTrackKey);
    const others = tracks.filter((t) => `${t.participant.identity}-${t.source}` !== pinnedTrackKey);
    return pinned ? [pinned, ...others] : tracks;
  }, [tracks, pinnedTrackKey]);

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
    if (pinnedTrackKey) return 'w-full flex flex-col lg:flex-row gap-3 max-w-7xl mx-auto max-h-[75vh] items-stretch';
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

      {/* Top Navigation Bar — Clean International Studio Header */}
      <header className="h-14 sm:h-16 px-4 sm:px-5 bg-[#080d18]/90 border-b border-white/[0.07] backdrop-blur-xl flex items-center justify-between gap-3 z-20 shrink-0">
        {/* Left: Brand & Meeting Title */}
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo size="sm" showTagline={false} />
          <div className="h-5 w-px bg-white/[0.1] hidden sm:block" />
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate max-w-[140px] sm:max-w-xs">
              {meetingTitle}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono">
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
              <span className="text-gray-600">•</span>
              <span className="text-gray-300 font-semibold">{formatDuration(callDuration)}</span>
              {recorder.isRecording && (
                <>
                  <span className="text-gray-600">•</span>
                  <span className="text-rose-400 font-extrabold animate-pulse">
                    REC {recorder.recordingDuration}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Studio Utility Controls (Snapshot, Mirror Camera, Record, PiP, Shortcuts, Fullscreen, Share) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Grouped Media Utilities Pill: Snapshot + Mirror Camera + Record */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
            {/* Snapshot Capture */}
            <button
              onClick={handleCaptureSnapshot}
              className="h-8 w-8 rounded-xl hover:bg-white/[0.1] text-cyan-300 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="Capture Live Snapshot (PNG)"
            >
              <Camera className="h-4 w-4" />
            </button>

            {/* Mirror / Disable Mirror Camera (next to Snapshot) */}
            <button
              onClick={() => {
                const next = !isMirrored;
                setIsMirrored(next);
                toast.info(next ? 'Mirror camera enabled' : 'Mirror camera disabled');
              }}
              className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                isMirrored
                  ? 'bg-[#0066FF]/20 text-[#388BFF]'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.1]'
              }`}
              title={isMirrored ? 'Disable Mirror Camera' : 'Enable Mirror Camera'}
            >
              <FlipHorizontal className="h-4 w-4" />
            </button>

            {/* Record Vedio & Audio (next to Snapshot & Mirror) */}
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
              className={`h-8 px-2.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 text-[11px] font-bold ${
                recorder.isRecording
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'hover:bg-white/[0.1] text-gray-200 hover:text-white'
              }`}
              title={recorder.isRecording ? 'Stop Recording' : 'Record Vedio & Audio'}
            >
              <Disc className={`h-3.5 w-3.5 ${recorder.isRecording ? 'text-white animate-spin' : 'text-rose-400'}`} />
              <span className="hidden md:inline">
                {recorder.isRecording ? recorder.recordingDuration : 'Record'}
              </span>
            </button>

            {/* Picture in Picture */}
            <button
              onClick={togglePiP}
              className="hidden sm:flex h-8 w-8 rounded-xl hover:bg-white/[0.1] text-gray-300 hover:text-white items-center justify-center transition-all cursor-pointer active:scale-95"
              title="Picture-in-Picture"
            >
              <PictureInPicture2 className="h-4 w-4" />
            </button>
          </div>

          {/* Keyboard Shortcuts */}
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="hidden md:flex h-9 w-9 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] text-gray-300 hover:text-white items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="h-4 w-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="h-9 w-9 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] text-gray-300 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>

          {/* Share Link */}
          <button
            onClick={copyMeetingLink}
            className="h-9 px-3 rounded-xl bg-[#0066FF]/15 hover:bg-[#0066FF]/25 border border-[#0066FF]/35 text-[#388BFF] hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Copy Meeting Link"
          >
            {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Invite'}</span>
          </button>
        </div>
      </header>

      {/* Main Video Stage */}
      <main className="flex-1 overflow-hidden p-3 sm:p-5 flex items-center justify-center relative">
        {/* TV Broadcast Breaking Announcement Banner */}
        {broadcastBanner && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-3xl w-[94%] rounded-2xl overflow-hidden shadow-2xl border border-[#FF7A00]/50 bg-[#070e1d]/95 backdrop-blur-xl flex items-stretch animate-in fade-in slide-in-from-top-3 duration-300">
            <div className="px-3.5 py-2 bg-gradient-to-r from-[#FF7A00] to-rose-600 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-1.5 shrink-0">
              <Megaphone className="h-3.5 w-3.5 animate-pulse" />
              <span>ON AIR</span>
            </div>
            <div className="flex-1 px-4 py-2 flex items-center justify-between gap-3 min-w-0">
              <p className="text-xs sm:text-sm font-bold text-white truncate">
                {broadcastBanner.text}
              </p>
              {hasHostPrivileges && (
                <button
                  onClick={() => handleSetBroadcastBanner(null)}
                  className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer shrink-0"
                  title="Clear Broadcast Banner"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Floating Live Poll Voting Card */}
        {activePoll && (
          <div className="absolute bottom-4 right-4 z-30 w-80 max-w-[92vw] rounded-3xl bg-[#091222]/96 border border-[#0066FF]/40 backdrop-blur-2xl shadow-2xl p-4 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#388BFF]">
                  <BarChart2 className="h-3.5 w-3.5 text-[#FF7A00]" />
                  <span>Live Poll • By {activePoll.createdBy}</span>
                </div>
                <h4 className="text-xs sm:text-sm font-black text-white leading-snug">
                  {activePoll.question}
                </h4>
              </div>
              {hasHostPrivileges && (
                <button
                  onClick={handleClosePoll}
                  className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
                  title="Close Poll for Everyone"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="space-y-2">
              {(() => {
                const totalVotes = activePoll.options.reduce((s, o) => s + o.votes.length, 0);
                const myId = localParticipant?.identity || 'local';
                return activePoll.options.map((opt) => {
                  const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
                  const voted = opt.votes.includes(myId);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleVotePoll(opt.id)}
                      className={`w-full text-left relative overflow-hidden rounded-xl border p-2.5 transition-all cursor-pointer ${
                        voted
                          ? 'border-[#0066FF] bg-[#0066FF]/15'
                          : 'border-white/[0.1] bg-white/[0.03] hover:border-[#388BFF]/50'
                      }`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#0066FF]/30 to-[#FF7A00]/20 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative z-10 flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-white truncate">{opt.text}</span>
                        <span className="font-mono text-[11px] font-bold text-cyan-300 shrink-0">
                          {pct}% ({opt.votes.length})
                        </span>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        )}
        <div className="w-full h-full flex items-center justify-center">
          <div className={getGridClasses()}>
            {orderedTracks.map((trackRef) => {
              const participant = trackRef.participant;
              const isLocal = participant.isLocal;
              const trackKey = `${participant.identity}-${trackRef.source}`;
              const isPinned = pinnedTrackKey === trackKey;
              const pName = participant.name || participant.identity || (isLocal ? displayName : 'Participant');
              const hasVideo = trackRef.publication && !trackRef.publication.isMuted && trackRef.publication.track;
              const isSpeaking = participant.isSpeaking;

              return (
                <div
                  key={trackKey}
                  className={`relative aspect-video rounded-3xl bg-[#0c101c] overflow-hidden flex items-center justify-center transition-all duration-300 group ${
                    pinnedTrackKey && isPinned
                      ? 'flex-1 w-full lg:max-h-[75vh] ring-2 ring-[#0066FF] shadow-2xl'
                      : pinnedTrackKey
                      ? 'w-full lg:w-64 shrink-0 border border-white/10'
                      : 'w-full'
                  } ${
                    isSpeaking
                      ? 'ring-4 ring-emerald-500 shadow-2xl shadow-emerald-500/25'
                      : 'border-2 border-white/[0.08] hover:border-indigo-500/40 shadow-xl'
                  }`}
                >
                  {/* Video Track Element with Mirroring for Local Camera */}
                  {hasVideo ? (
                    <VideoTrack
                      trackRef={trackRef}
                      className={`w-full h-full object-cover transition-transform duration-300 ${
                        isLocal && trackRef.source === Track.Source.Camera && isMirrored
                          ? 'scale-x-[-1]'
                          : ''
                      }`}
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

                  {/* Top Left Badges: Hand Raise, Res, Mirror, Spotlight */}
                  <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 z-20 pointer-events-none">
                    {raisedHands[participant.identity] && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 font-bold text-[10px] sm:text-[11px] shadow-lg animate-bounce">
                        <span>✋</span>
                        <span>Hand Raised</span>
                      </div>
                    )}
                    <span className="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-cyan-400 font-bold">
                      {trackRef.source === Track.Source.ScreenShare ? 'Screen Share' : '1080p HD'}
                    </span>
                    {isPinned && (
                      <span className="px-2 py-0.5 rounded-lg bg-[#0066FF] text-white text-[10px] font-bold flex items-center gap-1">
                        <Pin className="h-2.5 w-2.5" /> Spotlight
                      </span>
                    )}
                    {isLocal && trackRef.source === Track.Source.Camera && isMirrored && (
                      <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-mono text-gray-300">
                        Mirrored
                      </span>
                    )}
                  </div>

                  {/* Top Right Quick Actions (visible on hover) */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setPinnedTrackKey(isPinned ? null : trackKey)}
                      className="h-8 w-8 rounded-xl bg-black/80 hover:bg-[#0066FF] border border-white/15 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-90"
                      title={isPinned ? 'Remove Spotlight' : 'Pin to Stage'}
                    >
                      {isPinned ? <PinOff className="h-4 w-4 text-amber-400" /> : <Pin className="h-4 w-4" />}
                    </button>
                    {isLocal && trackRef.source === Track.Source.Camera && (
                      <button
                        onClick={() => {
                          const next = !isMirrored;
                          setIsMirrored(next);
                          toast.info(next ? 'Mirror camera enabled' : 'Mirror camera disabled');
                        }}
                        className="h-8 w-8 rounded-xl bg-black/80 hover:bg-[#0066FF] border border-white/15 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-90"
                        title={isMirrored ? 'Show Un-mirrored Camera' : 'Show Mirrored Camera'}
                      >
                        <FlipHorizontal className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Top Right Live Badge (fades on hover) */}
                  <div className="absolute top-3 right-3 group-hover:opacity-0 transition-opacity flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/75 backdrop-blur-md border border-emerald-500/35 text-[11px] font-bold text-white shadow-lg pointer-events-none">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="tracking-wider uppercase text-emerald-400 font-extrabold text-[10px]">LIVE</span>
                  </div>

                  {/* Bottom TV Broadcast Lower-Third Nameplate */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between pointer-events-none z-20">
                    <BroadcastNameplate
                      name={pName}
                      isLocal={isLocal}
                      isHost={isLocal && isHost}
                      isCoHost={Boolean(coHosts[participant.identity])}
                      isMuted={!participant.isMicrophoneEnabled}
                      isSpeaking={isSpeaking}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Floating International-Standard Bottom Control Dock */}
      <footer className="pb-4 pt-2 px-4 flex items-center justify-center z-20 shrink-0 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2.5 rounded-full bg-[#0b1222]/92 border border-white/[0.12] backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.65)]">
          {/* Mic Toggle */}
          <button
            onClick={() => localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled)}
            className={`h-11 w-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              localParticipant.isMicrophoneEnabled
                ? 'bg-white/[0.09] hover:bg-white/[0.16] text-white'
                : 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/30'
            }`}
            title={localParticipant.isMicrophoneEnabled ? 'Mute Microphone (M)' : 'Unmute Microphone (M)'}
          >
            {localParticipant.isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {/* Camera Toggle */}
          <button
            onClick={() => localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled)}
            className={`h-11 w-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              localParticipant.isCameraEnabled
                ? 'bg-white/[0.09] hover:bg-white/[0.16] text-white'
                : 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/30'
            }`}
            title={localParticipant.isCameraEnabled ? 'Turn Off Vedio (V)' : 'Turn On Vedio (V)'}
          >
            {localParticipant.isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={() => localParticipant.setScreenShareEnabled(!localParticipant.isScreenShareEnabled)}
            className={`h-11 w-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              localParticipant.isScreenShareEnabled
                ? 'bg-[#0066FF] text-white shadow-lg shadow-[#0066FF]/40'
                : 'bg-white/[0.09] hover:bg-white/[0.16] text-gray-200 hover:text-white'
            }`}
            title={localParticipant.isScreenShareEnabled ? 'Stop Screen Share' : 'Share Screen'}
          >
            <Monitor className="h-5 w-5" />
          </button>

          <div className="h-6 w-px bg-white/[0.1] mx-0.5 hidden sm:block" />

          {/* Reactions Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowReactionsBar(!showReactionsBar)}
              className="h-11 w-11 rounded-full bg-white/[0.09] hover:bg-white/[0.16] text-gray-200 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="Send Reaction"
            >
              <Smile className="h-5 w-5" />
            </button>
            {showReactionsBar && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 p-2 rounded-2xl bg-[#0c1324] border border-white/15 shadow-2xl flex items-center gap-1.5 z-50 animate-in fade-in zoom-in-95">
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
            className={`h-11 w-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              isHandRaised
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/30'
                : 'bg-white/[0.09] hover:bg-white/[0.16] text-gray-200 hover:text-white'
            }`}
            title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
          >
            <Hand className="h-5 w-5" />
          </button>

          {/* Host / Co-Host Live Poll & Announcement Banner */}
          {hasHostPrivileges && (
            <>
              <button
                onClick={() => setShowPollModal(true)}
                className="h-11 w-11 rounded-full bg-white/[0.09] hover:bg-white/[0.16] text-amber-300 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
                title="Launch Live Poll"
              >
                <BarChart2 className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  setBannerDraft(broadcastBanner?.text || '');
                  setShowBannerModal(true);
                }}
                className={`h-11 w-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  broadcastBanner
                    ? 'bg-[#FF7A00] text-white'
                    : 'bg-white/[0.09] hover:bg-white/[0.16] text-gray-200 hover:text-white'
                }`}
                title="Live Announcement Banner"
              >
                <Megaphone className="h-5 w-5" />
              </button>
            </>
          )}

          <div className="h-6 w-px bg-white/[0.1] mx-0.5 hidden sm:block" />

          {/* Merged Unified Hub Button: Participants + Chat + Draw */}
          <button
            onClick={() => {
              if (showParticipantsDrawer || showChatAndNotes || showWhiteboard) {
                setShowParticipantsDrawer(false);
                setShowChatAndNotes(false);
                setShowWhiteboard(false);
              } else {
                setShowParticipantsDrawer(true);
              }
            }}
            className={`relative h-11 px-4 rounded-full flex items-center gap-2 transition-all cursor-pointer active:scale-95 text-xs font-bold ${
              showParticipantsDrawer || showChatAndNotes || showWhiteboard
                ? 'bg-[#0066FF] text-white shadow-lg shadow-[#0066FF]/35'
                : 'bg-white/[0.09] hover:bg-white/[0.16] text-gray-100'
            }`}
            title="Meeting Hub: Participants, Chat & Draw"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">People • Chat • Draw</span>
            <span className="px-1.5 py-0.5 rounded-full bg-black/35 text-[10px] font-mono font-bold">
              {totalCount}
            </span>
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-violet-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-[#0b1222] animate-bounce">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Leave / End Meeting Button */}
          <button
            onClick={() => {
              if (recorder.isRecording) {
                recorder.stopRecording();
              }
              if (isHost && onEndMeeting) {
                setShowHostExitModal(true);
              } else {
                onLeave();
              }
            }}
            className="h-11 px-5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-rose-600/35 transition-all cursor-pointer active:scale-95"
          >
            <PhoneOff className="h-4 w-4" />
            <span className="hidden sm:inline">{isHost ? 'End' : 'Leave'}</span>
          </button>
        </div>
      </footer>

      {/* Live Poll Creator Modal */}
      {showPollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <form
            onSubmit={handleLaunchPoll}
            className="w-full max-w-md p-6 rounded-3xl bg-[#091222] border border-[#0066FF]/35 shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-[#FF7A00]" />
                Launch Live Interactive Poll
              </h3>
              <button
                type="button"
                onClick={() => setShowPollModal(false)}
                className="p-1.5 rounded-xl bg-white/[0.06] text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300">Poll Question</label>
              <input
                type="text"
                required
                placeholder="e.g. Are we ready to launch v2.0?"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                className="w-full rounded-xl bg-black/50 border border-white/[0.12] px-3.5 py-2.5 text-xs sm:text-sm text-white outline-none focus:border-[#0066FF]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300">Options</label>
              {pollOptionsInput.map((opt, idx) => (
                <input
                  key={idx}
                  type="text"
                  placeholder={`Option ${idx + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const next = [...pollOptionsInput];
                    next[idx] = e.target.value;
                    setPollOptionsInput(next);
                  }}
                  className="w-full rounded-xl bg-black/50 border border-white/[0.1] px-3 py-2 text-xs text-white outline-none focus:border-[#0066FF]"
                />
              ))}
              {pollOptionsInput.length < 4 && (
                <button
                  type="button"
                  onClick={() => setPollOptionsInput((p) => [...p, ''])}
                  className="text-xs font-bold text-[#388BFF] hover:underline cursor-pointer"
                >
                  + Add another option
                </button>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPollModal(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.06] text-xs font-bold text-gray-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#FF7A00] text-xs font-black text-white shadow-lg cursor-pointer"
              >
                Broadcast Poll
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TV On-Air Announcement Banner Modal */}
      {showBannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#091222] border border-[#FF7A00]/40 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-[#FF7A00]" />
                TV On-Air Broadcast Banner
              </h3>
              <button
                onClick={() => setShowBannerModal(false)}
                className="p-1.5 rounded-xl bg-white/[0.06] text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Display a live news-channel style announcement ticker across every participant&apos;s screen.
            </p>
            <input
              type="text"
              placeholder="e.g. Welcome! Q&A session starts in 5 minutes..."
              value={bannerDraft}
              onChange={(e) => setBannerDraft(e.target.value)}
              className="w-full rounded-xl bg-black/50 border border-white/[0.12] px-3.5 py-2.5 text-xs sm:text-sm text-white outline-none focus:border-[#FF7A00]"
            />
            <div className="flex justify-end gap-2 pt-1">
              {broadcastBanner && (
                <button
                  onClick={() => handleSetBroadcastBanner(null)}
                  className="px-3.5 py-2 rounded-xl bg-rose-600/20 border border-rose-500/35 text-xs font-bold text-rose-300 cursor-pointer"
                >
                  Clear Banner
                </button>
              )}
              <button
                onClick={() =>
                  bannerDraft.trim()
                    ? handleSetBroadcastBanner({ text: bannerDraft.trim(), author: displayName })
                    : handleSetBroadcastBanner(null)
                }
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF7A00] to-rose-600 text-xs font-black text-white shadow-lg cursor-pointer"
              >
                Go On Air
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-[#091222] border border-[#0066FF]/35 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-[#388BFF]" />
                Studio Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="p-1.5 rounded-xl bg-white/[0.06] text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {[
                ['M', 'Mute / Unmute Microphone'],
                ['V', 'Turn Vedio (Camera) On / Off'],
                ['W', 'Open / Close Whiteboard Studio'],
                ['P', 'Toggle Participants Drawer'],
                ['C', 'Toggle Chat & Private DMs'],
                ['F', 'Toggle Fullscreen Mode'],
                ['?', 'Show / Hide Shortcuts'],
              ].map(([k, desc]) => (
                <div
                  key={k}
                  className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                >
                  <span className="text-gray-300">{desc}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-[#0066FF]/20 border border-[#0066FF]/40 text-[#388BFF] font-mono font-black">
                    {k}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Host Leave vs End Meeting Confirmation Modal */}
      {showHostExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#091222] border border-[#0066FF]/30 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-black text-white">Leave or End Meeting?</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              If you choose <strong className="text-white">Leave Only</strong>, the room stays open and you can rejoin anytime as the <strong className="text-[#388BFF]">Host</strong>.
            </p>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={() => {
                  setShowHostExitModal(false);
                  onLeave();
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#0066FF] hover:bg-[#1E78FF] text-white text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-lg shadow-[#0066FF]/25"
              >
                Leave Only (Rejoin Later as Host)
              </button>
              <button
                onClick={async () => {
                  setShowHostExitModal(false);
                  if (onEndMeeting) await onEndMeeting();
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-lg shadow-rose-600/25"
              >
                End Meeting for Everyone
              </button>
              <button
                onClick={() => setShowHostExitModal(false)}
                className="w-full py-2 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Meeting Hub — Participants Tab */}
      {showParticipantsDrawer && (
        <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-[#091222]/96 backdrop-blur-2xl border-l border-white/[0.1] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Unified Hub Switcher Bar: People | Chat | Draw */}
          <div className="px-3 pt-3 pb-2 border-b border-white/[0.08] bg-[#060c18]/80 flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                setShowParticipantsDrawer(true);
                setShowChatAndNotes(false);
                setShowWhiteboard(false);
              }}
              className="flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-[#0066FF] text-white shadow-md shadow-[#0066FF]/30 cursor-pointer"
            >
              <Users className="h-3.5 w-3.5" />
              <span>People ({totalCount})</span>
            </button>
            <button
              onClick={() => {
                setShowParticipantsDrawer(false);
                setShowChatAndNotes(true);
                setShowWhiteboard(false);
              }}
              className="relative flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-gray-300 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Chat</span>
              {unreadChatCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-violet-500 text-white text-[9px] font-black">
                  {unreadChatCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setShowParticipantsDrawer(false);
                setShowChatAndNotes(false);
                setShowWhiteboard(true);
              }}
              className="flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-gray-300 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              <PenTool className="h-3.5 w-3.5 text-[#FFA033]" />
              <span>Draw</span>
            </button>
            <button
              onClick={() => setShowParticipantsDrawer(false)}
              className="h-8 w-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-gray-400 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              title="Close Panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
            <p className="text-[11px] text-gray-400">
              {hasHostPrivileges
                ? 'Control Mic/Vedio, assign Co-Hosts & send DMs'
                : 'View attendees & send private messages'}
            </p>
          </div>

          {/* Host / Co-Host Bulk Media Controls */}
          {hasHostPrivileges && (
            <div className="px-4 py-3 border-b border-white/[0.08] bg-white/[0.02] flex items-center gap-2">
              <button
                onClick={() => handleHostControlMedia('ALL', 'Everyone', 'mic', false)}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Mute all participants' microphones"
              >
                <MicOff className="h-3.5 w-3.5" />
                <span>Mute All</span>
              </button>
              <button
                onClick={() => handleHostControlMedia('ALL', 'Everyone', 'cam', false)}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Turn off all participants' vedio"
              >
                <VideoOff className="h-3.5 w-3.5" />
                <span>All Vedio Off</span>
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {participants.map((p) => {
              const pName = p.name || p.identity || 'Participant';
              const isLocalP = p.isLocal;
              const isPeerCoHost = Boolean(coHosts[p.identity]);
              const isPeerHost = isLocalP && isHost;

              return (
                <div
                  key={p.identity}
                  className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-[#0066FF]/35 transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#0066FF] to-[#FF7A00] text-white font-black text-xs flex items-center justify-center shrink-0 shadow-md">
                        {pName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[140px]">
                            {pName} {isLocalP ? '(You)' : ''}
                          </span>
                          {isPeerHost && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FF7A00]/20 text-[#FFA033] border border-[#FF7A00]/35 text-[9px] font-black uppercase">
                              <Crown className="h-2.5 w-2.5" /> Host
                            </span>
                          )}
                          {isPeerCoHost && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#0066FF]/20 text-[#388BFF] border border-[#0066FF]/35 text-[9px] font-black uppercase">
                              <Shield className="h-2.5 w-2.5" /> Co-Host
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                          <span className={p.isMicrophoneEnabled ? 'text-emerald-400' : 'text-rose-400'}>
                            {p.isMicrophoneEnabled ? 'Mic On' : 'Muted'}
                          </span>
                          <span>•</span>
                          <span className={p.isCameraEnabled ? 'text-emerald-400' : 'text-gray-500'}>
                            {p.isCameraEnabled ? 'Vedio On' : 'Vedio Off'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Private Message (DM) Button — available for any participant to message any other */}
                    {!isLocalP && (
                      <button
                        onClick={() => handleOpenPrivateChat(p.identity)}
                        className="h-8 px-2.5 rounded-xl bg-violet-500/15 hover:bg-violet-500/30 border border-violet-500/35 text-violet-300 text-[11px] font-bold flex items-center gap-1 shrink-0 transition-all cursor-pointer"
                        title={`Send private message to ${pName}`}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>DM</span>
                      </button>
                    )}
                  </div>

                  {/* Host / Co-Host Controls Row: Mic On/Off, Vedio On/Off, Make Co-Host */}
                  {hasHostPrivileges && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/[0.06]">
                      {/* Toggle Participant Mic ON/OFF */}
                      <button
                        onClick={() =>
                          handleHostControlMedia(
                            p.identity,
                            pName,
                            'mic',
                            !p.isMicrophoneEnabled
                          )
                        }
                        className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          p.isMicrophoneEnabled
                            ? 'bg-emerald-500/15 hover:bg-rose-500/20 text-emerald-300 hover:text-rose-300 border border-emerald-500/30'
                            : 'bg-rose-500/15 hover:bg-emerald-500/20 text-rose-300 hover:text-emerald-300 border border-rose-500/30'
                        }`}
                        title={
                          p.isMicrophoneEnabled
                            ? `Mute ${pName}'s microphone`
                            : `Turn ON ${pName}'s microphone`
                        }
                      >
                        {p.isMicrophoneEnabled ? (
                          <>
                            <Mic className="h-3.5 w-3.5" />
                            <span>Mic On</span>
                          </>
                        ) : (
                          <>
                            <MicOff className="h-3.5 w-3.5" />
                            <span>Mic Off</span>
                          </>
                        )}
                      </button>

                      {/* Toggle Participant Vedio (Camera) ON/OFF */}
                      <button
                        onClick={() =>
                          handleHostControlMedia(p.identity, pName, 'cam', !p.isCameraEnabled)
                        }
                        className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          p.isCameraEnabled
                            ? 'bg-emerald-500/15 hover:bg-rose-500/20 text-emerald-300 hover:text-rose-300 border border-emerald-500/30'
                            : 'bg-rose-500/15 hover:bg-emerald-500/20 text-rose-300 hover:text-emerald-300 border border-rose-500/30'
                        }`}
                        title={
                          p.isCameraEnabled
                            ? `Turn OFF ${pName}'s vedio`
                            : `Turn ON ${pName}'s vedio`
                        }
                      >
                        {p.isCameraEnabled ? (
                          <>
                            <Video className="h-3.5 w-3.5" />
                            <span>Vedio On</span>
                          </>
                        ) : (
                          <>
                            <VideoOff className="h-3.5 w-3.5" />
                            <span>Vedio Off</span>
                          </>
                        )}
                      </button>

                      {/* Host Action: Make / Remove Co-Host */}
                      {isHost && !isLocalP && (
                        <button
                          onClick={() => handleToggleCoHost(p.identity, pName)}
                          className={`py-1.5 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 shrink-0 transition-all cursor-pointer ${
                            isPeerCoHost
                              ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30'
                              : 'bg-[#0066FF]/20 hover:bg-[#0066FF]/35 text-[#388BFF] border border-[#0066FF]/40'
                          }`}
                          title={isPeerCoHost ? 'Remove Co-Host role' : 'Promote to Co-Host'}
                        >
                          {isPeerCoHost ? (
                            <>
                              <UserMinus className="h-3.5 w-3.5" />
                              <span>Remove</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3.5 w-3.5" />
                              <span>Co-Host</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      )}

      {/* Live Collaborative Whiteboard */}
      <WhiteboardCanvas
        isOpen={showWhiteboard}
        onClose={() => setShowWhiteboard(false)}
        meetingTitle={meetingTitle}
        authorName={displayName}
        elements={wbElements}
        onAddElement={handleWhiteboardAdd}
        onUndo={handleWhiteboardUndo}
        onRedo={handleWhiteboardRedo}
        canUndo={wbElements.length > 0}
        canRedo={wbRedoStack.length > 0}
        onClear={handleWhiteboardClear}
      />

      {/* Drawers */}
      <ChatAndNotesDrawer
        isOpen={showChatAndNotes}
        onClose={() => setShowChatAndNotes(false)}
        meetingId={meetingId}
        meetingTitle={meetingTitle}
        localUserName={displayName}
        messages={chatMessages}
        onSendMessage={handleSendChatMessage}
        participants={participants.map((p) => ({
          id: p.identity,
          name: p.name || p.identity || 'Participant',
          isLocal: p.isLocal,
        }))}
        selectedRecipientId={chatRecipientId}
        onSelectRecipient={setChatRecipientId}
        topSwitcher={
          <div className="px-3 pt-3 pb-2 border-b border-white/[0.08] bg-[#060c18]/80 flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                setShowChatAndNotes(false);
                setShowParticipantsDrawer(true);
                setShowWhiteboard(false);
              }}
              className="flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-gray-300 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              <Users className="h-3.5 w-3.5" />
              <span>People ({totalCount})</span>
            </button>
            <button
              onClick={() => {
                setShowChatAndNotes(true);
                setShowParticipantsDrawer(false);
                setShowWhiteboard(false);
              }}
              className="flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-[#0066FF] text-white shadow-md shadow-[#0066FF]/30 cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => {
                setShowChatAndNotes(false);
                setShowParticipantsDrawer(false);
                setShowWhiteboard(true);
              }}
              className="flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-gray-300 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              <PenTool className="h-3.5 w-3.5 text-[#FFA033]" />
              <span>Draw</span>
            </button>
          </div>
        }
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
