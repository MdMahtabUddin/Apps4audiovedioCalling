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
  ArrowLeft,
  Plus,
  LayoutGrid,
  Columns2,
  MoreHorizontal,
  Send,
  Sun,
  Moon,
  Lock,
  FileText,
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
        toast.info(`${latest.name || 'Participant'} joined the meeting`);
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

  // Studio UI Preferences (Spotlight vs Grid, MetroMeet Dark Studio default + Light toggle)
  const [layoutMode, setLayoutMode] = useState<'spotlight' | 'grid'>('spotlight');
  const [isDarkStudio, setIsDarkStudio] = useState<boolean>(true);
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);
  const [sidebarChatInput, setSidebarChatInput] = useState<string>('');
  const [showMobileSidebar, setShowMobileSidebar] = useState<boolean>(false);
  const sidebarChatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    sidebarChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
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
            toast.info(`${name} raised their hand!`);
          }
        } else if (data.type === 'cohost-update' && data.identity) {
          setCoHosts((prev) => ({ ...prev, [data.identity]: Boolean(data.isCoHost) }));
          if (data.name) {
            toast.info(
              data.isCoHost
                ? `${data.name} is now a Co-Host`
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
                  ? `${data.byName || 'Host'} turned ON your microphone`
                  : `${data.byName || 'Host'} muted your microphone`
              );
            } else if (data.media === 'cam') {
              room.localParticipant.setCameraEnabled(Boolean(data.enabled)).catch(() => {});
              toast.info(
                data.enabled
                  ? `${data.byName || 'Host'} turned ON your vedio`
                  : `${data.byName || 'Host'} turned OFF your vedio`
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
              toast.info(`Private message from ${incomingMsg.sender}`);
            } else {
              toast.info(`${incomingMsg.sender}: ${incomingMsg.text.slice(0, 40)}`);
            }
          }
        } else if (data.type === 'poll-create' && data.poll) {
          setActivePoll(data.poll);
          soundEngine.playIntroChime();
          toast.info(`New Live Poll: ${data.poll.question}`);
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
      toast.success('You raised your hand');
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
      toast.info(`${knocks[knocks.length - 1].displayName} is waiting to join`);
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

  const todayFormatted = useMemo(
    () =>
      new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    []
  );

  // Determine Spotlight (Featured) track vs Thumbnail strip tracks
  const spotlightTrack = orderedTracks[0] || null;
  const thumbnailTracks = orderedTracks.slice(1);

  const remoteChatPeers = participants
    .filter((p) => !p.isLocal)
    .map((p) => ({ id: p.identity, name: p.name || p.identity || 'Participant' }));
  const selectedDmPeer =
    chatRecipientId !== 'ALL'
      ? remoteChatPeers.find((p) => p.id === chatRecipientId) || null
      : null;

  const handleSidebarChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sidebarChatInput.trim()) return;
    handleSendChatMessage(sidebarChatInput.trim(), selectedDmPeer);
    setSidebarChatInput('');
  };

  const handleToggleRecord = async () => {
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
  };

  const handleExitClick = () => {
    if (recorder.isRecording) {
      recorder.stopRecording();
    }
    if (isHost && onEndMeeting) {
      setShowHostExitModal(true);
    } else {
      onLeave();
    }
  };

  const getGridClasses = () => {
    if (orderedTracks.length <= 1) return 'w-full h-full max-w-4xl mx-auto';
    if (orderedTracks.length === 2) return 'w-full h-full grid grid-cols-1 md:grid-cols-2 gap-3.5';
    if (orderedTracks.length <= 4) return 'w-full h-full grid grid-cols-1 sm:grid-cols-2 gap-3.5';
    if (orderedTracks.length <= 9) return 'w-full h-full grid grid-cols-2 sm:grid-cols-3 gap-3';
    return 'w-full h-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5';
  };

  const renderVideoTile = (
    trackRef: (typeof orderedTracks)[number],
    variant: 'main' | 'thumb' | 'grid'
  ) => {
    const participant = trackRef.participant;
    const isLocal = participant.isLocal;
    const trackKey = `${participant.identity}-${trackRef.source}`;
    const isPinned = pinnedTrackKey === trackKey;
    const pName = participant.name || participant.identity || (isLocal ? displayName : 'Participant');
    const hasVideo =
      trackRef.publication && !trackRef.publication.isMuted && trackRef.publication.track;
    const isSpeaking = participant.isSpeaking;
    const isMicOn = participant.isMicrophoneEnabled;

    return (
      <div
        key={trackKey}
        onClick={variant === 'thumb' ? () => setPinnedTrackKey(trackKey) : undefined}
        className={`relative overflow-hidden flex items-center justify-center transition-all duration-300 group ${
          variant === 'main'
            ? 'w-full h-full rounded-[26px] shadow-md'
            : variant === 'thumb'
            ? 'h-full aspect-video rounded-2xl cursor-pointer hover:scale-[1.02] shadow-sm shrink-0'
            : 'w-full h-full min-h-[180px] rounded-2xl shadow-sm'
        } ${
          isDarkStudio ? 'bg-[#101828]' : 'bg-slate-900'
        } ${
          isSpeaking
            ? 'ring-[3px] ring-emerald-400 shadow-lg shadow-emerald-500/20'
            : isDarkStudio
            ? 'ring-1 ring-white/10'
            : 'ring-1 ring-slate-200/80'
        }`}
      >
        {/* Video Feed or Clean Avatar */}
        {hasVideo ? (
          <VideoTrack
            trackRef={trackRef}
            className={`w-full h-full object-cover transition-transform duration-300 ${
              isLocal && trackRef.source === Track.Source.Camera && isMirrored ? 'scale-x-[-1]' : ''
            }`}
          />
        ) : (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${
              isDarkStudio
                ? 'bg-gradient-to-br from-[#131e36] to-[#0b1220]'
                : 'bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200'
            }`}
          >
            <div
              className={`${
                variant === 'thumb' ? 'h-12 w-12 text-base' : 'h-20 w-20 text-2xl'
              } rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#2563EB] text-white font-bold flex items-center justify-center shadow-lg ring-4 ${
                isDarkStudio ? 'ring-white/10' : 'ring-white'
              }`}
            >
              {pName.slice(0, 2).toUpperCase()}
            </div>
            {variant !== 'thumb' && (
              <p
                className={`text-xs font-semibold ${
                  isDarkStudio ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                {pName} {isLocal ? '(You)' : ''}
              </p>
            )}
          </div>
        )}

        {/* Top-Left Monochrome White MetroMeet PRO Watermark Logo + Smaller LIVE & Time underneath */}
        <div className="absolute top-3.5 left-3.5 z-20 flex flex-col items-start gap-1 pointer-events-none select-none">
          {/* Pure White Translucent Monochrome Watermark matching uploaded reference */}
          <div
            className={`inline-flex flex-col items-start ${
              variant === 'thumb'
                ? 'opacity-45 scale-[0.65] origin-top-left -mb-1.5'
                : 'opacity-55 drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]'
            }`}
          >
            {/* White Curved Arc Swoosh */}
            <svg
              className="w-full overflow-visible -mb-0.5"
              height="9"
              viewBox="0 0 160 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M 6 12 Q 80 -3 154 12"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
            </svg>
            {/* Monochrome White "Metro Meet" + Translucent White "PRO" Pill */}
            <div className="flex items-center tracking-tight font-black italic leading-none">
              <span className="text-[15px] text-white/90">Metro</span>
              <span className="text-[15px] text-white/90 ml-1">Meet</span>
              <span className="ml-1.5 px-2 py-[2px] text-[8px] not-italic font-black tracking-widest rounded-full bg-white/35 text-white/95 uppercase">
                PRO
              </span>
            </div>
          </div>

          {/* Smaller LIVE + Time strip directly below the logo */}
          <div className="flex items-center gap-1.5 pl-0.5">
            <div
              className={`inline-flex items-center gap-1 rounded bg-black/40 backdrop-blur-sm border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.6)] ${
                variant === 'thumb' ? 'px-1 py-[1px] text-[7px]' : 'px-1.5 py-[2px] text-[8.5px]'
              }`}
            >
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-80" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
              </span>
              <span className="font-bold tracking-[0.16em] uppercase text-white/90 leading-none">
                LIVE
              </span>
              <span className="h-2 w-px bg-white/25" />
              <span className="font-mono font-medium text-white/80 tabular-nums leading-none">
                {formatDuration(callDuration)}
              </span>
            </div>

            {raisedHands[participant.identity] && (
              <div className="flex items-center gap-1 px-2 py-[2px] rounded bg-[#0066FF]/90 backdrop-blur-md text-white font-bold text-[8.5px] shadow-md animate-bounce">
                <span>✋</span>
                {variant !== 'thumb' && <span>Hand Raised</span>}
              </div>
            )}
          </div>
        </div>

        {/* Top-Right Circular Action Badges (Pin + Mic Status, matching reference design) */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
          {variant !== 'thumb' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPinnedTrackKey(isPinned ? null : trackKey);
              }}
              className={`h-9 w-9 rounded-full flex items-center justify-center shadow-md transition-all cursor-pointer active:scale-95 ${
                isPinned
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/95 hover:bg-white text-emerald-600'
              }`}
              title={isPinned ? 'Unpin' : 'Pin to Spotlight'}
            >
              {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
          )}
          <div
            className={`${
              variant === 'thumb' ? 'h-7 w-7' : 'h-9 w-9'
            } rounded-full flex items-center justify-center shadow-md ${
              isMicOn
                ? 'bg-[#2563EB] text-white'
                : 'bg-white/95 text-slate-700'
            }`}
            title={isMicOn ? 'Mic Active' : 'Muted'}
          >
            {isMicOn ? (
              <Mic className={variant === 'thumb' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            ) : (
              <MicOff className={variant === 'thumb' ? 'h-3.5 w-3.5 text-rose-500' : 'h-4 w-4 text-rose-500'} />
            )}
          </div>
        </div>

        {/* Bottom-Left Clean Frosted Nameplate Pill */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between pointer-events-none z-20">
          <BroadcastNameplate
            name={pName}
            isLocal={isLocal}
            isHost={isLocal && isHost}
            isCoHost={Boolean(coHosts[participant.identity])}
            isMuted={!isMicOn}
            isSpeaking={isSpeaking}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      className={`h-screen w-screen flex overflow-hidden select-none relative transition-colors duration-300 ${
        isDarkStudio ? 'bg-[#050a14] text-slate-100' : 'bg-[#F0F4FA] text-slate-900'
      }`}
    >
      {/* Animated International Studio Background (Optical Aurora + Floating Orbs + Subtle Grid) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className={`absolute inset-0 bg-grid-pattern ${
            isDarkStudio ? 'opacity-45' : 'opacity-20'
          }`}
        />
        <div
          className={`absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full blur-[120px] animate-float ${
            isDarkStudio ? 'bg-[#0066FF]/22' : 'bg-[#0066FF]/12'
          }`}
        />
        <div
          className={`absolute -bottom-32 right-1/4 w-[480px] h-[480px] rounded-full blur-[130px] animate-float-slow ${
            isDarkStudio ? 'bg-[#FF7A00]/16' : 'bg-[#FF7A00]/10'
          }`}
        />
        <div
          className={`absolute top-1/3 left-1/3 w-[600px] h-[260px] rounded-full blur-[140px] animate-aurora ${
            isDarkStudio ? 'opacity-65' : 'opacity-25'
          }`}
        />
      </div>

      {/* Floating Reaction Animation */}
      {activeReaction && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-8xl z-50 animate-bounce pointer-events-none drop-shadow-2xl">
          {activeReaction}
        </div>
      )}

      {/* Waiting Room Knocks Notification for Host */}
      {knocks.length > 0 && (
        <div
          className={`absolute top-5 left-1/2 -translate-x-1/2 z-50 rounded-2xl p-3 shadow-2xl backdrop-blur-xl flex items-center gap-4 border animate-in fade-in slide-in-from-top-4 ${
            isDarkStudio
              ? 'bg-[#0d1526]/95 border-[#0066FF]/40 text-white'
              : 'bg-white/95 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#FF5B37] animate-pulse" />
            <span className="text-xs font-semibold">
              <strong className="text-[#2563EB]">{knocks[0].displayName}</strong> wants to join
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAdmit(knocks[0].id)}
              className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              Admit
            </button>
            <button
              onClick={() => handleDeny(knocks[0].id)}
              className="px-3 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 text-xs font-semibold transition-all cursor-pointer"
            >
              Deny
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* LEFT MAIN STAGE COLUMN                                                */}
      {/* ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full px-4 sm:px-6 py-4 gap-3.5 overflow-hidden relative z-10">
        {/* 1. Top Header Bar with MetroMeet Brand Logo */}
        <header className="flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Circular Back Button */}
            <button
              onClick={handleExitClick}
              className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-sm active:scale-95 ${
                isDarkStudio
                  ? 'bg-[#0b1528]/90 hover:bg-[#0066FF]/20 text-white border border-[#0066FF]/30'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80'
              }`}
              title="Leave / Return to Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            {/* MetroMeet PRO Brand Logo (Transparent — no black box behind) */}
            <div className="hidden sm:flex items-center shrink-0">
              <BrandLogo size="sm" showTagline={false} href="" />
            </div>

            <div className="h-6 w-px bg-white/10 hidden sm:block" />

            {/* Title + LIVE Pill + Date & Live Duration */}
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1
                  className={`text-base sm:text-xl font-extrabold tracking-tight truncate max-w-[160px] sm:max-w-xs ${
                    isDarkStudio ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {meetingTitle}
                </h1>
                <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gradient-to-r from-[#0066FF] to-[#00A3FF] text-white text-[11px] font-bold shadow-md shadow-[#0066FF]/30">
                  <Users className="h-3 w-3" />
                  <span>{isHost ? 'Host Meeting' : 'Live Meeting'}</span>
                </span>
              </div>
              <div
                className={`flex items-center gap-2 text-xs font-medium mt-0.5 ${
                  isDarkStudio ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <span>{todayFormatted}</span>
                {recorder.isRecording && (
                  <>
                    <span>•</span>
                    <span className="text-rose-500 font-bold animate-pulse font-mono">
                      REC {recorder.recordingDuration}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Header Studio Utilities: Snapshot, Mirror, Theme, Fullscreen, Record Dot */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCaptureSnapshot}
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 ${
                isDarkStudio
                  ? 'bg-white/[0.07] hover:bg-white/[0.14] text-cyan-300 border border-white/10'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/80'
              }`}
              title="Capture Live Snapshot (PNG)"
            >
              <Camera className="h-4 w-4" />
            </button>

            <button
              onClick={() => {
                const next = !isMirrored;
                setIsMirrored(next);
                toast.info(next ? 'Mirror camera enabled' : 'Mirror camera disabled');
              }}
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 ${
                isMirrored
                  ? 'bg-[#3B82F6]/15 text-[#2563EB] border border-[#3B82F6]/35'
                  : isDarkStudio
                  ? 'bg-white/[0.07] text-slate-300 border border-white/10'
                  : 'bg-white text-slate-500 border border-slate-200/80'
              }`}
              title={isMirrored ? 'Disable Mirror Camera' : 'Enable Mirror Camera'}
            >
              <FlipHorizontal className="h-4 w-4" />
            </button>

            <button
              onClick={() => setIsDarkStudio((d) => !d)}
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 ${
                isDarkStudio
                  ? 'bg-white/[0.07] hover:bg-white/[0.14] text-amber-300 border border-white/10'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/80'
              }`}
              title={isDarkStudio ? 'Switch to Light Studio' : 'Switch to Dark Studio'}
            >
              {isDarkStudio ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              onClick={toggleFullscreen}
              className={`hidden sm:flex h-9 w-9 rounded-full items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 ${
                isDarkStudio
                  ? 'bg-white/[0.07] hover:bg-white/[0.14] text-slate-200 border border-white/10'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/80'
              }`}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>

            {/* Iconic Circular Record Button (top-right coral dot matching reference) */}
            <button
              onClick={handleToggleRecord}
              className={`h-10 w-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 ${
                recorder.isRecording
                  ? 'bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/25'
                  : isDarkStudio
                  ? 'bg-white/[0.1] hover:bg-white/[0.16] border border-white/15'
                  : 'bg-white hover:bg-slate-50 border border-slate-200/80'
              }`}
              title={recorder.isRecording ? 'Stop Recording' : 'Record Vedio & Audio'}
            >
              <span
                className={`h-4 w-4 rounded-full flex items-center justify-center ${
                  recorder.isRecording ? 'bg-white' : 'bg-[#FF5B37]'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    recorder.isRecording ? 'bg-rose-600' : 'bg-white'
                  }`}
                />
              </span>
            </button>
          </div>
        </header>

        {/* 2. Sub-Toolbar Row: Attendee Count + "+ Add People" | Layout Switcher */}
        <div className="flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                isDarkStudio
                  ? 'bg-white/[0.07] text-slate-200 border border-white/10'
                  : 'bg-white text-slate-700 border border-slate-200/80'
              }`}
            >
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span>{totalCount}</span>
            </div>

            <button
              onClick={copyMeetingLink}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#FF7A00] to-[#FF5500] hover:from-[#FF8C1A] hover:to-[#E64D00] text-white text-xs font-bold shadow-md shadow-[#FF7A00]/25 transition-all cursor-pointer active:scale-95"
              title="Copy Invite Link to Add People"
            >
              {isCopied ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              <span>{isCopied ? 'Link Copied' : 'Add People'}</span>
            </button>
          </div>

          {/* Right Layout Switcher (Grid vs Spotlight + Draw Quick Trigger) */}
          <div
            className={`inline-flex items-center gap-1 p-1 rounded-full shadow-sm ${
              isDarkStudio
                ? 'bg-white/[0.06] border border-white/10'
                : 'bg-white border border-slate-200/80'
            }`}
          >
            <button
              onClick={() => setLayoutMode('grid')}
              className={`h-8 w-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                layoutMode === 'grid'
                  ? 'bg-[#3B82F6] text-white shadow-sm'
                  : isDarkStudio
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLayoutMode('spotlight')}
              className={`h-8 w-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                layoutMode === 'spotlight'
                  ? 'bg-[#3B82F6] text-white shadow-sm'
                  : isDarkStudio
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Speaker Spotlight View"
            >
              <Columns2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 3. Main Video Stage (Spotlight + Thumbnails OR Grid View) */}
        <main className="flex-1 min-h-0 flex flex-col gap-3 relative overflow-hidden">
          {/* On-Air Announcement Banner */}
          {broadcastBanner && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-2xl w-[92%] rounded-2xl overflow-hidden shadow-xl border border-[#FF5B37]/40 bg-slate-900/95 backdrop-blur-xl flex items-stretch">
              <div className="px-3 py-1.5 bg-[#FF5B37] text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shrink-0">
                <Megaphone className="h-3.5 w-3.5 animate-pulse" />
                <span>Announcement</span>
              </div>
              <div className="flex-1 px-3.5 py-1.5 flex items-center justify-between gap-2 min-w-0">
                <p className="text-xs font-bold text-white truncate">{broadcastBanner.text}</p>
                {hasHostPrivileges && (
                  <button
                    onClick={() => handleSetBroadcastBanner(null)}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Floating Live Poll Card */}
          {activePoll && (
            <div
              className={`absolute bottom-4 right-4 z-30 w-80 max-w-[92%] rounded-3xl border shadow-2xl p-4 space-y-3 backdrop-blur-2xl ${
                isDarkStudio
                  ? 'bg-[#0d1526]/95 border-[#3B82F6]/40 text-white'
                  : 'bg-white/96 border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#2563EB]">
                    <BarChart2 className="h-3.5 w-3.5 text-[#FF5B37]" />
                    <span>Live Poll • {activePoll.createdBy}</span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-extrabold leading-snug">
                    {activePoll.question}
                  </h4>
                </div>
                {hasHostPrivileges && (
                  <button
                    onClick={handleClosePoll}
                    className="p-1 rounded-lg hover:bg-slate-500/10 text-slate-400 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
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
                            ? 'border-[#3B82F6] bg-[#3B82F6]/10'
                            : isDarkStudio
                            ? 'border-white/10 bg-white/[0.04]'
                            : 'border-slate-200 bg-slate-50 hover:border-[#3B82F6]/50'
                        }`}
                      >
                        <div
                          className="absolute inset-y-0 left-0 bg-[#3B82F6]/20 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                        <div className="relative z-10 flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold truncate">{opt.text}</span>
                          <span className="font-mono text-[11px] font-bold text-[#2563EB] shrink-0">
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

          {layoutMode === 'spotlight' && spotlightTrack ? (
            <>
              {/* Large Main Spotlight Stage */}
              <div className="flex-1 min-h-0">
                {renderVideoTile(spotlightTrack, 'main')}
              </div>

              {/* Bottom Thumbnail Filmstrip Row (when 2+ tiles exist) */}
              {thumbnailTracks.length > 0 && (
                <div className="h-28 sm:h-32 shrink-0 flex items-center gap-3 overflow-x-auto pb-1">
                  {thumbnailTracks.map((t) => renderVideoTile(t, 'thumb'))}
                </div>
              )}
            </>
          ) : (
            <div className={`${getGridClasses()} overflow-y-auto`}>
              {orderedTracks.map((t) => renderVideoTile(t, 'grid'))}
            </div>
          )}
        </main>

        {/* 4. Bottom Control Bar (Exact Reference Aesthetic: Circular Buttons + Center Coral "End Meeting") */}
        <footer className="pt-1 pb-1 flex items-center justify-center gap-2.5 sm:gap-3.5 shrink-0 relative z-30">
          {/* Mobile Participants / Chat Sidebar Toggle */}
          <button
            onClick={() => setShowMobileSidebar((v) => !v)}
            className={`lg:hidden relative h-11 w-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 ${
              isDarkStudio
                ? 'bg-white/[0.09] text-white border border-white/10'
                : 'bg-white text-slate-700 border border-slate-200/80'
            }`}
            title="Participants & Chat"
          >
            <Users className="h-5 w-5" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-[#3B82F6] text-white text-[10px] font-bold flex items-center justify-center">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Screen Share */}
          <button
            onClick={() => localParticipant.setScreenShareEnabled(!localParticipant.isScreenShareEnabled)}
            className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 ${
              localParticipant.isScreenShareEnabled
                ? 'bg-[#3B82F6] text-white shadow-blue-500/30'
                : isDarkStudio
                ? 'bg-white/[0.09] hover:bg-white/[0.15] text-slate-200 border border-white/10'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80'
            }`}
            title={localParticipant.isScreenShareEnabled ? 'Stop Screen Share' : 'Share Screen'}
          >
            <Monitor className="h-5 w-5" />
          </button>

          {/* Mic Toggle */}
          <button
            onClick={() => localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled)}
            className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 ${
              localParticipant.isMicrophoneEnabled
                ? isDarkStudio
                  ? 'bg-white/[0.09] hover:bg-white/[0.15] text-white border border-white/10'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80'
                : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
            }`}
            title={localParticipant.isMicrophoneEnabled ? 'Mute Microphone (M)' : 'Unmute Microphone (M)'}
          >
            {localParticipant.isMicrophoneEnabled ? (
              <Mic className="h-5 w-5" />
            ) : (
              <MicOff className="h-5 w-5" />
            )}
          </button>

          {/* Prominent Center Coral-Red "End Meeting" / "Leave" Pill */}
          <button
            onClick={handleExitClick}
            className="h-11 sm:h-12 px-6 sm:px-8 rounded-full bg-[#FF5B37] hover:bg-[#E84926] text-white font-bold text-xs sm:text-sm shadow-lg shadow-[#FF5B37]/30 transition-all cursor-pointer active:scale-95 flex items-center gap-2"
          >
            <PhoneOff className="h-4 w-4 sm:hidden" />
            <span>{isHost ? 'End Meeting' : 'Leave Meeting'}</span>
          </button>

          {/* Camera (Vedio) Toggle */}
          <button
            onClick={() => localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled)}
            className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 ${
              localParticipant.isCameraEnabled
                ? isDarkStudio
                  ? 'bg-white/[0.09] hover:bg-white/[0.15] text-white border border-white/10'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80'
                : 'bg-[#FF5B37]/15 text-[#FF5B37] border border-[#FF5B37]/30'
            }`}
            title={localParticipant.isCameraEnabled ? 'Turn Off Vedio (V)' : 'Turn On Vedio (V)'}
          >
            {localParticipant.isCameraEnabled ? (
              <Video className="h-5 w-5" />
            ) : (
              <VideoOff className="h-5 w-5" />
            )}
          </button>

          {/* Collaborative Whiteboard / Draw Button */}
          <button
            onClick={() => setShowWhiteboard(true)}
            className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 ${
              showWhiteboard
                ? 'bg-[#3B82F6] text-white shadow-blue-500/30'
                : isDarkStudio
                ? 'bg-white/[0.09] hover:bg-white/[0.15] text-slate-200 border border-white/10'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80'
            }`}
            title="Live Whiteboard & Draw Studio (W)"
          >
            <PenTool className="h-5 w-5" />
          </button>

          {/* More Options (...) Popover: Hand Raise, Reactions, Poll, Banner, Notes, PiP, Shortcuts */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu((v) => !v)}
              className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 ${
                showMoreMenu
                  ? 'bg-[#3B82F6] text-white'
                  : isDarkStudio
                  ? 'bg-white/[0.09] hover:bg-white/[0.15] text-slate-200 border border-white/10'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80'
              }`}
              title="More Studio Tools"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>

            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                <div
                  className={`absolute bottom-14 right-0 z-50 w-60 rounded-2xl p-2 shadow-2xl border space-y-1 animate-in fade-in zoom-in-95 ${
                    isDarkStudio
                      ? 'bg-[#0e1628] border-white/15 text-slate-100'
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  

                  <button
                    onClick={() => {
                      toggleHandRaise();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
                  >
                    <Hand className={`h-4 w-4 ${isHandRaised ? 'text-amber-500' : 'text-[#3B82F6]'}`} />
                    <span>{isHandRaised ? 'Lower Hand' : 'Raise Hand'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowChatAndNotes(true);
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
                  >
                    <FileText className="h-4 w-4 text-emerald-500" />
                    <span>Meeting Notepad</span>
                  </button>

                  {hasHostPrivileges && (
                    <>
                      <button
                        onClick={() => {
                          setShowPollModal(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
                      >
                        <BarChart2 className="h-4 w-4 text-amber-500" />
                        <span>Launch Live Poll</span>
                      </button>
                      <button
                        onClick={() => {
                          setBannerDraft(broadcastBanner?.text || '');
                          setShowBannerModal(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
                      >
                        <Megaphone className="h-4 w-4 text-[#FF5B37]" />
                        <span>Broadcast Announcement</span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => {
                      togglePiP();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
                  >
                    <PictureInPicture2 className="h-4 w-4 text-slate-400" />
                    <span>Picture-in-Picture</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowShortcutsModal(true);
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
                  >
                    <Keyboard className="h-4 w-4 text-slate-400" />
                    <span>Keyboard Shortcuts</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </footer>
      </div>

      {/* ===================================================================== */}
      {/* RIGHT PERMANENT SPLIT SIDEBAR: PARTICIPANTS (TOP) + CHAT (BOTTOM)     */}
      {/* ===================================================================== */}
      <aside
        className={`${
          showMobileSidebar
            ? 'fixed inset-y-0 right-0 z-50 flex w-[340px] max-w-[92vw]'
            : 'hidden lg:flex w-[340px] xl:w-[360px]'
        } h-full flex-col border-l shrink-0 relative z-10 backdrop-blur-2xl transition-colors duration-300 ${
          isDarkStudio
            ? 'bg-[#081020]/90 border-[#0066FF]/20 text-slate-100 shadow-2xl shadow-black/50'
            : 'bg-white/92 border-slate-200/80 text-slate-900'
        }`}
      >
        {/* TOP HALF: PARTICIPANTS PANEL */}
        <div className="flex flex-col max-h-[44%] border-b border-slate-500/15">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight">Participants</h2>
              <span className="px-2 py-0.5 rounded-full bg-[#3B82F6] text-white text-[10px] font-bold">
                {totalCount}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {hasHostPrivileges && (
                <button
                  onClick={() => handleHostControlMedia('ALL', 'Everyone', 'mic', false)}
                  className="text-[11px] font-bold text-[#3B82F6] hover:underline cursor-pointer"
                  title="Mute all participants"
                >
                  Mute All
                </button>
              )}
              {showMobileSidebar && (
                <button
                  onClick={() => setShowMobileSidebar(false)}
                  className="lg:hidden p-1 rounded-lg hover:bg-slate-500/10 text-slate-400 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2">
            {participants.map((p) => {
              const pName = p.name || p.identity || 'Participant';
              const isLocalP = p.isLocal;
              const isPeerCoHost = Boolean(coHosts[p.identity]);
              const isPeerHost = isLocalP && isHost;

              return (
                <div
                  key={p.identity}
                  className={`px-3 py-2.5 rounded-2xl transition-all flex items-center justify-between gap-2 ${
                    isLocalP
                      ? isDarkStudio
                        ? 'bg-white/[0.07]'
                        : 'bg-[#F4F6FA]'
                      : isDarkStudio
                      ? 'hover:bg-white/[0.05]'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#2563EB] text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">
                      {pName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate max-w-[110px]">
                          {isLocalP ? 'Me' : pName}
                        </span>
                        {isPeerHost && (
                          <span className="px-1.5 py-0.2 rounded-full bg-[#FF5B37]/15 text-[#FF5B37] text-[9px] font-bold">
                            Host
                          </span>
                        )}
                        {isPeerCoHost && (
                          <span className="px-1.5 py-0.2 rounded-full bg-[#3B82F6]/15 text-[#3B82F6] text-[9px] font-bold">
                            Co-Host
                          </span>
                        )}
                      </div>
                      {isLocalP && (
                        <p className="text-[10px] text-slate-400 truncate max-w-[115px]">{pName}</p>
                      )}
                    </div>
                  </div>

                  {/* Compact Action Icons: Host Mic On/Off, Vedio On/Off, Co-Host, Private DM */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Mic Status / Host Toggle */}
                    <button
                      disabled={!hasHostPrivileges && !isLocalP}
                      onClick={() =>
                        handleHostControlMedia(p.identity, pName, 'mic', !p.isMicrophoneEnabled)
                      }
                      className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
                        hasHostPrivileges || isLocalP ? 'cursor-pointer hover:bg-slate-500/15' : ''
                      } ${p.isMicrophoneEnabled ? 'text-emerald-500' : 'text-slate-400'}`}
                      title={
                        hasHostPrivileges || isLocalP
                          ? p.isMicrophoneEnabled
                            ? `Mute ${pName}`
                            : `Unmute ${pName}`
                          : p.isMicrophoneEnabled
                          ? 'Mic On'
                          : 'Muted'
                      }
                    >
                      {p.isMicrophoneEnabled ? (
                        <Mic className="h-3.5 w-3.5" />
                      ) : (
                        <MicOff className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {/* Vedio Status / Host Toggle */}
                    <button
                      disabled={!hasHostPrivileges && !isLocalP}
                      onClick={() =>
                        handleHostControlMedia(p.identity, pName, 'cam', !p.isCameraEnabled)
                      }
                      className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
                        hasHostPrivileges || isLocalP ? 'cursor-pointer hover:bg-slate-500/15' : ''
                      } ${p.isCameraEnabled ? 'text-emerald-500' : 'text-slate-400'}`}
                      title={
                        hasHostPrivileges || isLocalP
                          ? p.isCameraEnabled
                            ? `Turn off ${pName}'s vedio`
                            : `Turn on ${pName}'s vedio`
                          : p.isCameraEnabled
                          ? 'Vedio On'
                          : 'Vedio Off'
                      }
                    >
                      {p.isCameraEnabled ? (
                        <Video className="h-3.5 w-3.5" />
                      ) : (
                        <VideoOff className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {/* Private DM Button */}
                    {!isLocalP && (
                      <button
                        onClick={() => {
                          setChatRecipientId(p.identity);
                          toast.info(`Private DM selected for ${pName}`);
                        }}
                        className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                          chatRecipientId === p.identity
                            ? 'bg-violet-500 text-white'
                            : 'text-violet-500 hover:bg-violet-500/15'
                        }`}
                        title={`Send Private Message to ${pName}`}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Promote / Demote Co-Host Button (Host only) */}
                    {isHost && !isLocalP && (
                      <button
                        onClick={() => handleToggleCoHost(p.identity, pName)}
                        className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                          isPeerCoHost
                            ? 'bg-[#3B82F6] text-white'
                            : 'text-[#3B82F6] hover:bg-[#3B82F6]/15'
                        }`}
                        title={isPeerCoHost ? 'Remove Co-Host' : 'Make Co-Host'}
                      >
                        {isPeerCoHost ? (
                          <UserMinus className="h-3.5 w-3.5" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM HALF: ALWAYS-VISIBLE LIVE CHAT & PRIVATE DM FEED */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <h2 className="text-base font-extrabold tracking-tight">Chat</h2>
            <button
              onClick={() => setShowChatAndNotes(true)}
              className="text-[11px] font-bold text-slate-400 hover:text-[#3B82F6] cursor-pointer"
            >
              Notepad &amp; Full
            </button>
          </div>

          {/* Live Chat Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
            {chatMessages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2.5">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5 ${
                    msg.isPrivate
                      ? 'bg-gradient-to-tr from-violet-600 to-indigo-500'
                      : msg.isLocal
                      ? 'bg-gradient-to-tr from-[#3B82F6] to-cyan-500'
                      : 'bg-gradient-to-tr from-slate-500 to-slate-700'
                  }`}
                >
                  {(msg.isLocal ? displayName : msg.sender).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span
                      className={`text-[11px] font-bold ${
                        isDarkStudio ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {msg.isLocal ? 'You' : msg.sender}
                    </span>
                    {msg.isPrivate && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-violet-500/15 text-violet-500 text-[9px] font-bold">
                        <Lock className="h-2.5 w-2.5" />
                        {msg.isLocal ? `To ${msg.recipientName}` : 'Private'}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                  </div>
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed break-words ${
                      msg.isPrivate
                        ? isDarkStudio
                          ? 'bg-violet-500/20 text-violet-100 border border-violet-500/30'
                          : 'bg-violet-50 text-violet-950 border border-violet-200'
                        : isDarkStudio
                        ? 'bg-white/[0.06] text-slate-100'
                        : 'bg-[#F3F5F9] text-slate-800'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            <div ref={sidebarChatEndRef} />
          </div>

          {/* Bottom Rounded Chat Composer (Matching Reference Pill + Recipient Switcher) */}
          <div className="p-3.5 space-y-2 border-t border-slate-500/10">
            {/* Public vs Private DM Recipient Selector */}
            <div className="flex items-center gap-1.5 px-1">
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                {selectedDmPeer ? (
                  <Lock className="h-3 w-3 text-violet-500" />
                ) : (
                  <Users className="h-3 w-3 text-[#3B82F6]" />
                )}
                To:
              </span>
              <select
                value={selectedDmPeer ? selectedDmPeer.id : 'ALL'}
                onChange={(e) => setChatRecipientId(e.target.value)}
                className={`flex-1 rounded-lg px-2 py-1 text-[11px] font-bold outline-none cursor-pointer ${
                  selectedDmPeer
                    ? 'bg-violet-500/15 text-violet-500'
                    : isDarkStudio
                    ? 'bg-white/[0.06] text-slate-200'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                <option value="ALL" className="text-slate-900">
                  Everyone (Public)
                </option>
                {remoteChatPeers.map((p) => (
                  <option key={p.id} value={p.id} className="text-slate-900">
                    Private: {p.name}
                  </option>
                ))}
              </select>
            </div>

            <form
              onSubmit={handleSidebarChatSubmit}
              className={`flex items-center gap-2 p-1.5 rounded-full border transition-all ${
                selectedDmPeer
                  ? 'border-violet-400 bg-violet-500/5'
                  : isDarkStudio
                  ? 'bg-white/[0.06] border-white/10'
                  : 'bg-[#F4F6FA] border-slate-200/80'
              }`}
            >
              <button
                type="button"
                onClick={() => setSidebarChatInput((v) => `${v}😊`)}
                className="h-8 w-8 rounded-full bg-[#FFA726] hover:bg-[#FB8C00] text-white flex items-center justify-center shrink-0 cursor-pointer shadow-sm"
                title="Add Emoji"
              >
                <Smile className="h-4 w-4" />
              </button>
              <input
                type="text"
                placeholder={
                  selectedDmPeer
                    ? `Private to ${selectedDmPeer.name}...`
                    : 'Type a message...'
                }
                value={sidebarChatInput}
                onChange={(e) => setSidebarChatInput(e.target.value)}
                className={`flex-1 bg-transparent text-xs outline-none px-1 ${
                  isDarkStudio
                    ? 'text-white placeholder:text-slate-400'
                    : 'text-slate-800 placeholder:text-slate-400'
                }`}
              />
              <button
                type="submit"
                disabled={!sidebarChatInput.trim()}
                className="h-8 w-8 rounded-full bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 text-white flex items-center justify-center shrink-0 cursor-pointer shadow-sm transition-all"
                title="Send Message"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ===================================================================== */}
      {/* MODALS & COLLABORATIVE WHITEBOARD                                     */}
      {/* ===================================================================== */}
      {showPollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <form
            onSubmit={handleLaunchPoll}
            className="w-full max-w-md p-6 rounded-3xl bg-[#091222] text-white border border-[#3B82F6]/35 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-[#FF5B37]" />
                Launch Live Poll
              </h3>
              <button
                type="button"
                onClick={() => setShowPollModal(false)}
                className="p-1.5 rounded-xl bg-white/[0.06] text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="e.g. Ready to ship this sprint?"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              className="w-full rounded-xl bg-black/50 border border-white/[0.12] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#3B82F6]"
            />
            <div className="space-y-2">
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
                  className="w-full rounded-xl bg-black/50 border border-white/[0.1] px-3 py-2 text-xs text-white outline-none focus:border-[#3B82F6]"
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
                className="px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-xs font-black text-white shadow-lg cursor-pointer"
              >
                Broadcast Poll
              </button>
            </div>
          </form>
        </div>
      )}

      {showBannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#091222] text-white border border-[#FF5B37]/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-[#FF5B37]" />
                Live Announcement Banner
              </h3>
              <button
                onClick={() => setShowBannerModal(false)}
                className="p-1.5 rounded-xl bg-white/[0.06] text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              placeholder="e.g. Q&A starts in 5 minutes..."
              value={bannerDraft}
              onChange={(e) => setBannerDraft(e.target.value)}
              className="w-full rounded-xl bg-black/50 border border-white/[0.12] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#FF5B37]"
            />
            <div className="flex justify-end gap-2">
              {broadcastBanner && (
                <button
                  onClick={() => handleSetBroadcastBanner(null)}
                  className="px-3.5 py-2 rounded-xl bg-rose-600/20 text-xs font-bold text-rose-300 cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() =>
                  bannerDraft.trim()
                    ? handleSetBroadcastBanner({ text: bannerDraft.trim(), author: displayName })
                    : handleSetBroadcastBanner(null)
                }
                className="px-4 py-2 rounded-xl bg-[#FF5B37] hover:bg-[#E84926] text-xs font-black text-white cursor-pointer"
              >
                Show Banner
              </button>
            </div>
          </div>
        </div>
      )}

      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-[#091222] text-white border border-[#3B82F6]/35 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-[#388BFF]" />
                Keyboard Shortcuts
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
                ['V', 'Turn Vedio On / Off'],
                ['W', 'Open / Close Whiteboard'],
                ['F', 'Toggle Fullscreen'],
                ['?', 'Show / Hide Shortcuts'],
              ].map(([k, desc]) => (
                <div
                  key={k}
                  className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04] border border-white/[0.06]"
                >
                  <span className="text-gray-300">{desc}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-[#3B82F6]/20 text-[#388BFF] font-mono font-black">
                    {k}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showHostExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#091222] text-white border border-[#3B82F6]/30 shadow-2xl space-y-4">
            <h3 className="text-lg font-black">Leave or End Meeting?</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              Choose <strong className="text-white">Leave Only</strong> to keep the room open so you can rejoin anytime as the <strong className="text-[#388BFF]">Host</strong>.
            </p>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={() => {
                  setShowHostExitModal(false);
                  onLeave();
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs sm:text-sm font-bold cursor-pointer"
              >
                Leave Only (Rejoin Later as Host)
              </button>
              <button
                onClick={async () => {
                  setShowHostExitModal(false);
                  if (onEndMeeting) await onEndMeeting();
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#FF5B37] hover:bg-[#E84926] text-white text-xs sm:text-sm font-bold cursor-pointer"
              >
                End Meeting for Everyone
              </button>
              <button
                onClick={() => setShowHostExitModal(false)}
                className="w-full py-2 text-xs text-gray-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
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

      {/* Full Notepad & Expanded Chat Drawer */}
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
