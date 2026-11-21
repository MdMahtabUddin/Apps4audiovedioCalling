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
import {
  Track,
  ConnectionState,
  ConnectionQuality,
  VideoPresets,
  AudioPresets,
  VideoQuality,
  LocalVideoTrack,
  LocalAudioTrack,
} from 'livekit-client';
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
  Minus,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Send,
  Sun,
  Moon,
  Lock,
  FileText,
  Subtitles,
  Timer,
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

  // Voice & Vedio Quality Controls
  type VedioQualityLevel = 'low' | 'medium' | 'hd' | 'fhd';
  type VoiceQualityLevel = 'low' | 'standard' | 'high' | 'studio';

  const VEDIO_QUALITY_LEVELS: {
    id: VedioQualityLevel;
    short: string;
    label: string;
    detail: string;
    preset: typeof VideoPresets.h720;
    remoteQuality: VideoQuality;
  }[] = [
    {
      id: 'low',
      short: '360p',
      label: 'Data Saver',
      detail: '360p · 15 fps',
      preset: VideoPresets.h360,
      remoteQuality: VideoQuality.LOW,
    },
    {
      id: 'medium',
      short: '540p',
      label: 'Standard',
      detail: '540p · 24 fps',
      preset: VideoPresets.h540,
      remoteQuality: VideoQuality.MEDIUM,
    },
    {
      id: 'hd',
      short: '720p',
      label: 'HD',
      detail: '720p · 30 fps',
      preset: VideoPresets.h720,
      remoteQuality: VideoQuality.HIGH,
    },
    {
      id: 'fhd',
      short: '1080p',
      label: 'Full HD',
      detail: '1080p · 30 fps',
      preset: VideoPresets.h1080,
      remoteQuality: VideoQuality.HIGH,
    },
  ];

  const VOICE_QUALITY_LEVELS: {
    id: VoiceQualityLevel;
    short: string;
    label: string;
    detail: string;
    preset: typeof AudioPresets.speech;
  }[] = [
    {
      id: 'low',
      short: '20k',
      label: 'Data Saver',
      detail: '20 kbps · Low Bandwidth',
      preset: AudioPresets.telephone,
    },
    {
      id: 'standard',
      short: '32k',
      label: 'Standard Voice',
      detail: '32 kbps · Clear Speech',
      preset: AudioPresets.speech,
    },
    {
      id: 'high',
      short: '64k',
      label: 'High Voice',
      detail: '64 kbps · Broadcast',
      preset: AudioPresets.music,
    },
    {
      id: 'studio',
      short: '96k',
      label: 'Studio HD',
      detail: '96 kbps · Ultra Crisp',
      preset: AudioPresets.musicHighQuality,
    },
  ];

  const [showQualityModal, setShowQualityModal] = useState(false);
  const [vedioQuality, setVedioQuality] = useState<VedioQualityLevel>('hd');
  const [voiceQuality, setVoiceQuality] = useState<VoiceQualityLevel>('high');
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [speakerVolume, setSpeakerVolume] = useState(180); // 0–300% (Default 180% crystal-clear voice boost)
  const [isApplyingQuality, setIsApplyingQuality] = useState(false);

  // Web Audio API Studio Voice Boost & Clarity Engine (up to 300% loud, crystal-clear voice)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const clarityInputRef = useRef<AudioNode | null>(null);
  const connectedAudioTracksRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map());

  useEffect(() => {
    if (!room || typeof window === 'undefined') return;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ensureAudioGraph = () => {
      if (!audioCtxRef.current) {
        const ctx = new AudioCtx();
        // 1. Speech Clarity EQ (gentle +3.5dB presence lift at 2.8kHz so voices sound crisp, never muffled)
        const clarityEq = ctx.createBiquadFilter();
        clarityEq.type = 'peaking';
        clarityEq.frequency.value = 2800;
        clarityEq.Q.value = 1.0;
        clarityEq.gain.value = 3.5;

        // 2. Voice Leveler Compressor (lifts quiet/distant voices automatically)
        const leveler = ctx.createDynamicsCompressor();
        leveler.threshold.value = -24;
        leveler.knee.value = 18;
        leveler.ratio.value = 4;
        leveler.attack.value = 0.005;
        leveler.release.value = 0.15;

        // 3. Master Boost Gain (0.0 to 3.0 = 0% to 300%)
        const masterGain = ctx.createGain();
        masterGain.gain.value = Math.max(0, Math.min(3, speakerVolume / 100));

        // 4. Safety Brickwall Limiter (prevents distortion/clipping at high boost)
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -2;
        limiter.knee.value = 4;
        limiter.ratio.value = 12;
        limiter.attack.value = 0.002;
        limiter.release.value = 0.08;

        clarityEq.connect(leveler);
        leveler.connect(masterGain);
        masterGain.connect(limiter);
        limiter.connect(ctx.destination);

        audioCtxRef.current = ctx;
        clarityInputRef.current = clarityEq;
        masterGainRef.current = masterGain;
      }
      return audioCtxRef.current;
    };

    const syncRemoteAudioTracks = () => {
      const ctx = ensureAudioGraph();
      const inputNode = clarityInputRef.current;
      if (!ctx || !inputNode) return;

      const activeTrackIds = new Set<string>();
      room.remoteParticipants.forEach((rp) => {
        rp.audioTrackPublications.forEach((pub) => {
          const mediaTrack = pub.track?.mediaStreamTrack;
          if (!mediaTrack || mediaTrack.readyState !== 'live') return;
          const key = `${rp.identity}:${mediaTrack.id}`;
          activeTrackIds.add(key);

          if (!connectedAudioTracksRef.current.has(key)) {
            try {
              const stream = new MediaStream([mediaTrack]);
              const source = ctx.createMediaStreamSource(stream);
              source.connect(inputNode);
              connectedAudioTracksRef.current.set(key, source);
            } catch {
              // ignore unsupported track
            }
          }
        });
      });

      // Disconnect stale tracks
      connectedAudioTracksRef.current.forEach((source, key) => {
        if (!activeTrackIds.has(key)) {
          try {
            source.disconnect();
          } catch {
            // ignore
          }
          connectedAudioTracksRef.current.delete(key);
        }
      });

      // Prevent double-audio: when Web Audio boost graph is running, mute raw <audio> tags;
      // otherwise keep raw <audio> tags unmuted at max 1.0 as seamless fallback.
      const usingWebAudio = ctx.state === 'running' && connectedAudioTracksRef.current.size > 0;
      const fallbackVol = Math.max(0, Math.min(1, speakerVolume / 100));
      document.querySelectorAll('audio').forEach((el) => {
        if (usingWebAudio) {
          el.muted = true;
        } else {
          el.muted = false;
          el.volume = fallbackVol;
        }
      });
    };

    const unlockAudio = () => {
      const ctx = ensureAudioGraph();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(syncRemoteAudioTracks).catch(() => {});
      }
    };

    syncRemoteAudioTracks();
    const timer = setInterval(syncRemoteAudioTracks, 1200);
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });

    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [room, participants.length, speakerVolume]);

  // Smooth real-time GainNode volume updates when user moves the slider
  useEffect(() => {
    const gainVal = Math.max(0, Math.min(3, speakerVolume / 100));
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(
        gainVal,
        audioCtxRef.current.currentTime,
        0.04
      );
    }
    const usingWebAudio =
      audioCtxRef.current?.state === 'running' && connectedAudioTracksRef.current.size > 0;
    if (!usingWebAudio) {
      const fallbackVol = Math.max(0, Math.min(1, gainVal));
      document.querySelectorAll('audio').forEach((el) => {
        el.muted = false;
        el.volume = fallbackVol;
      });
    }
  }, [speakerVolume]);

  // Cleanup Web Audio context on unmount
  useEffect(() => {
    return () => {
      connectedAudioTracksRef.current.forEach((src) => {
        try {
          src.disconnect();
        } catch {
          // ignore
        }
      });
      connectedAudioTracksRef.current.clear();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  // Apply remote vedio quality whenever participants or vedioQuality changes
  useEffect(() => {
    if (!room) return;
    const cfg = VEDIO_QUALITY_LEVELS.find((q) => q.id === vedioQuality);
    if (!cfg) return;
    room.remoteParticipants.forEach((rp) => {
      rp.videoTrackPublications.forEach((pub) => {
        try {
          pub.setVideoQuality(cfg.remoteQuality);
        } catch {
          // ignore if track does not support simulcast layers
        }
      });
    });
  }, [room, vedioQuality, participants.length]);

  const applyVedioQuality = async (level: VedioQualityLevel) => {
    const cfg = VEDIO_QUALITY_LEVELS.find((q) => q.id === level);
    if (!cfg) return;
    setVedioQuality(level);
    setIsApplyingQuality(true);
    try {
      // Update remote tracks immediately
      if (room) {
        room.remoteParticipants.forEach((rp) => {
          rp.videoTrackPublications.forEach((pub) => {
            try {
              pub.setVideoQuality(cfg.remoteQuality);
            } catch {
              // ignore
            }
          });
        });
      }
      // Restart local camera track with new resolution & frameRate if active
      const camPub = localParticipant?.getTrackPublication(Track.Source.Camera);
      const localCamTrack = camPub?.track as LocalVideoTrack | undefined;
      if (localCamTrack && localParticipant?.isCameraEnabled) {
        await localCamTrack.restartTrack({
          resolution: cfg.preset.resolution,
        });
      }
      toast.success(`Vedio quality set to ${cfg.label} (${cfg.short})`);
    } catch (err) {
      console.warn('Vedio quality update notice:', err);
      toast.info(`Vedio quality set to ${cfg.label} (${cfg.short})`);
    } finally {
      setIsApplyingQuality(false);
    }
  };

  const applyVoiceQuality = async (
    level: VoiceQualityLevel,
    nextNs: boolean = noiseSuppression,
    nextEc: boolean = echoCancellation
  ) => {
    const cfg = VOICE_QUALITY_LEVELS.find((q) => q.id === level);
    if (!cfg) return;
    setVoiceQuality(level);
    setNoiseSuppression(nextNs);
    setEchoCancellation(nextEc);
    setIsApplyingQuality(true);
    try {
      const micPub = localParticipant?.getTrackPublication(Track.Source.Microphone);
      const localMicTrack = micPub?.track as LocalAudioTrack | undefined;
      if (localParticipant?.isMicrophoneEnabled) {
        if (localMicTrack) {
          await localMicTrack.restartTrack({
            noiseSuppression: nextNs,
            echoCancellation: nextEc,
            autoGainControl: true,
            sampleRate: 48000,
          });
        }
        await localParticipant.setMicrophoneEnabled(
          true,
          {
            noiseSuppression: nextNs,
            echoCancellation: nextEc,
            autoGainControl: true,
            sampleRate: 48000,
          },
          {
            audioPreset: cfg.preset,
            dtx: false,
            red: true,
          }
        );
      }
      toast.success(`Voice quality set to ${cfg.label} (${cfg.short})`);
    } catch (err) {
      console.warn('Voice quality update notice:', err);
      toast.info(`Voice quality set to ${cfg.label} (${cfg.short})`);
    } finally {
      setIsApplyingQuality(false);
    }
  };

  const stepVedioQuality = (delta: -1 | 1) => {
    const idx = VEDIO_QUALITY_LEVELS.findIndex((q) => q.id === vedioQuality);
    const nextIdx = Math.max(0, Math.min(VEDIO_QUALITY_LEVELS.length - 1, idx + delta));
    if (nextIdx !== idx) {
      void applyVedioQuality(VEDIO_QUALITY_LEVELS[nextIdx].id);
    }
  };

  const stepVoiceQuality = (delta: -1 | 1) => {
    const idx = VOICE_QUALITY_LEVELS.findIndex((q) => q.id === voiceQuality);
    const nextIdx = Math.max(0, Math.min(VOICE_QUALITY_LEVELS.length - 1, idx + delta));
    if (nextIdx !== idx) {
      void applyVoiceQuality(VOICE_QUALITY_LEVELS[nextIdx].id);
    }
  };
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
        } else if (data.type === 'live-caption' && data.text) {
          setLiveCaption({
            speaker: data.speaker || participant?.name || participant?.identity || 'Participant',
            text: data.text,
            updatedAt: Date.now(),
          });
        } else if (data.type === 'live-reaction' && data.emoji) {
          const rid = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          setFloatingReactions((prev) => [
            ...prev.slice(-8),
            {
              id: rid,
              emoji: data.emoji,
              sender: data.sender || participant?.name || participant?.identity || 'Participant',
            },
          ]);
          setTimeout(() => {
            setFloatingReactions((prev) => prev.filter((r) => r.id !== rid));
          }, 3200);
        } else if (data.type === 'meeting-timer') {
          setMeetingTimerEndAt(typeof data.endAt === 'number' ? data.endAt : null);
          if (typeof data.endAt === 'number') {
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

  // =========================================================================
  // PRO FEATURES: LIVE CAPTIONS (CC), FLOATING REACTIONS & MEETING TIMER
  // =========================================================================
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionLang, setCaptionLang] = useState<'en-US' | 'bn-BD'>('en-US');
  const [liveCaption, setLiveCaption] = useState<{
    speaker: string;
    text: string;
    updatedAt: number;
  } | null>(null);
  const recognitionRef = useRef<any>(null);

  const [floatingReactions, setFloatingReactions] = useState<
    { id: string; emoji: string; sender: string }[]
  >([]);

  const [meetingTimerEndAt, setMeetingTimerEndAt] = useState<number | null>(null);
  const [meetingTimerRemaining, setMeetingTimerRemaining] = useState<number>(0);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [customTimerMinutes, setCustomTimerMinutes] = useState('15');
  const timerDoneRef = useRef(false);

  // Auto-hide stale caption after 6 seconds of silence
  useEffect(() => {
    if (!liveCaption) return;
    const t = setTimeout(() => {
      setLiveCaption((curr) => (curr && Date.now() - curr.updatedAt >= 5800 ? null : curr));
    }, 6000);
    return () => clearTimeout(t);
  }, [liveCaption]);

  // Browser Web Speech API Live Captions + LiveKit DataChannel broadcast
  useEffect(() => {
    if (!captionsEnabled || typeof window === 'undefined') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      return;
    }

    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      toast.info('Live Captions require Chrome, Edge, or Safari.');
      setCaptionsEnabled(false);
      return;
    }

    const rec = new SpeechRecognitionCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = captionLang;

    rec.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const cleaned = transcript.trim();
      if (!cleaned) return;
      setLiveCaption({ speaker: displayName, text: cleaned, updatedAt: Date.now() });
      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({ type: 'live-caption', speaker: displayName, text: cleaned })
        );
        room?.localParticipant.publishData(payload, { reliable: false });
      } catch {}
    };

    rec.onend = () => {
      if (captionsEnabled && recognitionRef.current === rec) {
        try {
          rec.start();
        } catch {}
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
    } catch {
      setCaptionsEnabled(false);
    }

    return () => {
      try {
        rec.onend = null;
        rec.stop();
      } catch {}
      if (recognitionRef.current === rec) recognitionRef.current = null;
    };
  }, [captionsEnabled, captionLang, displayName, room, toast]);

  const sendLiveReaction = (emoji: string) => {
    const rid = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setFloatingReactions((prev) => [
      ...prev.slice(-8),
      { id: rid, emoji, sender: displayName },
    ]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== rid));
    }, 3200);
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({ type: 'live-reaction', emoji, sender: displayName })
      );
      room?.localParticipant.publishData(payload, { reliable: false });
    } catch {}
  };

  // Synced Meeting Countdown Timer Tick
  useEffect(() => {
    if (!meetingTimerEndAt) {
      setMeetingTimerRemaining(0);
      timerDoneRef.current = false;
      return;
    }
    timerDoneRef.current = false;
    const updateTick = () => {
      const left = Math.max(0, Math.ceil((meetingTimerEndAt - Date.now()) / 1000));
      setMeetingTimerRemaining(left);
      if (left === 0 && !timerDoneRef.current) {
        timerDoneRef.current = true;
        soundEngine.playKnockChime();
        toast.info('Meeting countdown timer finished!');
      }
    };
    updateTick();
    const interval = setInterval(updateTick, 1000);
    return () => clearInterval(interval);
  }, [meetingTimerEndAt, toast]);

  const handleStartMeetingTimer = (minutes: number) => {
    if (!minutes || minutes <= 0) return;
    const endAt = Date.now() + Math.round(minutes * 60 * 1000);
    setMeetingTimerEndAt(endAt);
    setShowTimerModal(false);
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({ type: 'meeting-timer', endAt })
      );
      room?.localParticipant.publishData(payload, { reliable: true });
    } catch {}
    toast.success(`Meeting timer started (${minutes} min)`);
  };

  const handleClearMeetingTimer = () => {
    setMeetingTimerEndAt(null);
    setShowTimerModal(false);
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({ type: 'meeting-timer', endAt: null })
      );
      room?.localParticipant.publishData(payload, { reliable: true });
    } catch {}
  };

  const isPoorNetwork =
    localParticipant?.connectionQuality === ConnectionQuality.Poor ||
    localParticipant?.connectionQuality === ConnectionQuality.Lost;

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

  // Smooth broadcast ticker: shows LIVE | Time for 15s, then scrolls to LIVE | Date for 4s
  const [showDateInLiveBadge, setShowDateInLiveBadge] = useState(false);
  useEffect(() => {
    let hideTimeout: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setShowDateInLiveBadge(true);
      hideTimeout = setTimeout(() => {
        setShowDateInLiveBadge(false);
      }, 4000);
    }, 15000);
    return () => {
      clearInterval(interval);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, []);

  // Google Meet & Zoom Style Responsive Gallery Pagination (6 Mobile / 9 Tablet / 16 Desktop)
  const [galleryPage, setGalleryPage] = useState(0);
  const [pageSize, setPageSize] = useState(16);

  useEffect(() => {
    const updatePageSize = () => {
      if (window.innerWidth < 640) setPageSize(6);
      else if (window.innerWidth < 1024) setPageSize(9);
      else setPageSize(16);
    };
    updatePageSize();
    window.addEventListener('resize', updatePageSize);
    return () => window.removeEventListener('resize', updatePageSize);
  }, []);

  // Auto-enter Presentation Mode ONLY when someone is Screen Sharing or explicitly Pinned (Google Meet / Zoom behavior)
  const activeScreenShareTrack = orderedTracks.find(
    (t) => t.source === Track.Source.ScreenShare
  );
  const pinnedTrack = pinnedTrackKey
    ? orderedTracks.find((t) => `${t.participant.identity}-${t.source}` === pinnedTrackKey)
    : null;
  const presentationTrack = activeScreenShareTrack || pinnedTrack || null;
  const presentationStripTracks = presentationTrack
    ? orderedTracks.filter((t) => t !== presentationTrack)
    : [];

  const totalPages = Math.max(1, Math.ceil(orderedTracks.length / pageSize));
  const safeGalleryPage = Math.min(galleryPage, totalPages - 1);
  const pagedTracks = orderedTracks.slice(
    safeGalleryPage * pageSize,
    safeGalleryPage * pageSize + pageSize
  );

  useEffect(() => {
    if (galleryPage >= totalPages) {
      setGalleryPage(Math.max(0, totalPages - 1));
    }
  }, [galleryPage, totalPages]);

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

  // Exact Google Meet & Zoom Auto-Adaptive Gallery Grid Proportions
  const getGridClasses = (count: number) => {
    if (count <= 1) return 'w-full h-full grid grid-cols-1 grid-rows-1';
    if (count === 2) return 'w-full h-full grid grid-cols-1 sm:grid-cols-2 grid-rows-2 sm:grid-rows-1 gap-2.5 sm:gap-3';
    if (count <= 4) return 'w-full h-full grid grid-cols-2 grid-rows-2 gap-2.5 sm:gap-3';
    if (count <= 6) return 'w-full h-full grid grid-cols-2 sm:grid-cols-3 grid-rows-3 sm:grid-rows-2 gap-2 sm:gap-2.5';
    if (count <= 9) return 'w-full h-full grid grid-cols-2 sm:grid-cols-3 grid-rows-3 gap-2 sm:gap-2.5';
    if (count <= 12) return 'w-full h-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 grid-rows-3 gap-2';
    return 'w-full h-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 grid-rows-4 gap-2';
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

          {/* Broadcast Ticker Pill: Shows LIVE | Time first, then smoothly scrolls to LIVE | Date */}
          <div className="flex items-center pl-0.5">
            <div
              className={`inline-flex items-center gap-1.5 rounded bg-black/45 backdrop-blur-sm border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.6)] ${
                variant === 'thumb' ? 'px-1 py-[1px] text-[7px]' : 'px-1.5 py-[2.5px] text-[8.5px]'
              }`}
            >
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-80" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
              </span>
              <span className="font-bold tracking-[0.16em] uppercase text-white/95 leading-none shrink-0">
                LIVE
              </span>
              <span className="h-2 w-px bg-white/25 shrink-0" />
              {/* Vertical Smooth-Scroll Ticker Slot (Time <-> Date) */}
              <div
                className={`overflow-hidden relative ${
                  variant === 'thumb' ? 'h-[10px]' : 'h-[12px]'
                }`}
              >
                <div
                  className={`flex flex-col transition-transform duration-500 ease-in-out ${
                    showDateInLiveBadge && variant !== 'thumb'
                      ? '-translate-y-1/2'
                      : 'translate-y-0'
                  }`}
                >
                  <span
                    className={`font-mono font-medium text-white/85 tabular-nums flex items-center whitespace-nowrap ${
                      variant === 'thumb' ? 'h-[10px]' : 'h-[12px]'
                    }`}
                  >
                    {formatDuration(callDuration)}
                  </span>
                  <span
                    className={`font-mono font-medium text-white/85 tabular-nums flex items-center whitespace-nowrap ${
                      variant === 'thumb' ? 'h-[10px]' : 'h-[12px]'
                    }`}
                  >
                    {todayFormatted}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top-Right Glassmorphic Action Badges (Hand Raised + Pin + Mic Status) */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          {raisedHands[participant.identity] && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-[#0066FF]/90 to-[#00A3FF]/90 backdrop-blur-md border border-white/25 text-white font-bold text-[11px] shadow-[0_4px_16px_rgba(0,102,255,0.45)] animate-pulse">
              <span>✋</span>
              {variant !== 'thumb' && <span>Hand Raised</span>}
            </div>
          )}
          {variant !== 'thumb' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPinnedTrackKey(isPinned ? null : trackKey);
              }}
              className={`h-8 w-8 rounded-full flex items-center justify-center backdrop-blur-md border shadow-md transition-all cursor-pointer active:scale-95 ${
                isPinned
                  ? 'bg-emerald-500/90 border-emerald-300/40 text-white shadow-emerald-500/30'
                  : 'bg-black/45 hover:bg-black/65 border-white/15 text-white/90 hover:text-white'
              }`}
              title={isPinned ? 'Unpin' : 'Pin to Spotlight'}
            >
              {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
          )}
          <div
            className={`${
              variant === 'thumb' ? 'h-7 w-7' : 'h-8 w-8'
            } rounded-full flex items-center justify-center backdrop-blur-md border shadow-md transition-colors ${
              isMicOn
                ? 'bg-[#0066FF]/85 border-white/20 text-white shadow-[0_4px_14px_rgba(0,102,255,0.4)]'
                : 'bg-black/55 border-rose-500/40 text-rose-400'
            }`}
            title={isMicOn ? 'Mic Active' : 'Muted'}
          >
            {isMicOn ? (
              <Mic className={variant === 'thumb' ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5'} />
            ) : (
              <MicOff className={variant === 'thumb' ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5'} />
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
        {/* 1. International-Standard Frosted-Glass Studio Header Bar */}
        <header
          className={`flex items-center justify-between gap-3 shrink-0 px-3 sm:px-4 py-2 rounded-2xl backdrop-blur-2xl border transition-all ${
            isDarkStudio
              ? 'bg-[#071022]/78 border-white/[0.09] shadow-[0_8px_32px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.07)]'
              : 'bg-white/88 border-slate-200/80 shadow-[0_6px_24px_rgba(15,23,42,0.08)]'
          }`}
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            {/* Refined Back Button */}
            <button
              onClick={handleExitClick}
              className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-95 ${
                isDarkStudio
                  ? 'bg-white/[0.06] hover:bg-white/[0.14] text-slate-300 hover:text-white border border-white/10'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200/80'
              }`}
              title="Leave / Return to Dashboard"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
            </button>

            {/* MetroMeet PRO Brand Logo */}
            <div className="hidden sm:flex items-center shrink-0">
              <BrandLogo size="sm" showTagline={false} href="" />
            </div>

            <div className={`h-6 w-px shrink-0 hidden sm:block ${isDarkStudio ? 'bg-white/10' : 'bg-slate-200'}`} />

            {/* Title + Sleek Glass Status & Share Pills */}
            <div className="min-w-0 flex-1">
              <h1
                title={meetingTitle}
                className={`text-xs sm:text-[15px] font-bold tracking-tight leading-snug line-clamp-2 ${
                  isDarkStudio ? 'text-white' : 'text-slate-900'
                }`}
              >
                {(() => {
                  const words = (meetingTitle || '').trim().split(/\s+/).filter(Boolean);
                  return words.length > 150 ? `${words.slice(0, 150).join(' ')}…` : meetingTitle;
                })()}
              </h1>
              <div className="flex items-center flex-wrap gap-1.5 mt-1">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-[2px] rounded-full text-[10px] font-semibold border ${
                    isDarkStudio
                      ? 'bg-[#0066FF]/15 text-[#60A5FA] border-[#0066FF]/30'
                      : 'bg-blue-50 text-[#0066FF] border-blue-200'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00A3FF]" />
                  <span>{isHost ? 'Host Meeting' : 'Live Meeting'}</span>
                </span>

                <button
                  onClick={copyMeetingLink}
                  className={`inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[10px] font-semibold border transition-all cursor-pointer active:scale-95 ${
                    isCopied
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                      : isDarkStudio
                      ? 'bg-[#FF7A00]/15 hover:bg-[#FF7A00]/25 text-[#FFB366] hover:text-white border-[#FF7A00]/35'
                      : 'bg-orange-50 hover:bg-orange-100 text-[#EA580C] border-orange-200'
                  }`}
                  title="Copy Meeting Invite Link"
                >
                  {isCopied ? (
                    <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
                  ) : (
                    <Copy className="h-2.5 w-2.5" strokeWidth={2.2} />
                  )}
                  <span>{isCopied ? 'Link Copied' : 'Share Link'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Header Unified Glass Utility Cluster + Broadcast Record Pill */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`flex items-center gap-0.5 p-1 rounded-full border ${
                isDarkStudio
                  ? 'bg-white/[0.04] border-white/[0.09]'
                  : 'bg-slate-100/90 border-slate-200/80'
              }`}
            >
              <button
                onClick={() => {
                  const next = !isMirrored;
                  setIsMirrored(next);
                  toast.info(next ? 'Mirror camera enabled' : 'Mirror camera disabled');
                }}
                className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  isMirrored
                    ? 'bg-[#0066FF]/25 text-[#60A5FA]'
                    : isDarkStudio
                    ? 'text-slate-300 hover:text-white hover:bg-white/10'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
                title={isMirrored ? 'Disable Mirror Camera' : 'Enable Mirror Camera'}
              >
                <FlipHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
              </button>

              <button
                onClick={() => setIsDarkStudio((d) => !d)}
                className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  isDarkStudio
                    ? 'text-amber-300 hover:bg-white/10'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
                title={isDarkStudio ? 'Switch to Light Studio' : 'Switch to Dark Studio'}
              >
                {isDarkStudio ? (
                  <Sun className="h-3.5 w-3.5" strokeWidth={2} />
                ) : (
                  <Moon className="h-3.5 w-3.5" strokeWidth={2} />
                )}
              </button>

              <button
                onClick={toggleFullscreen}
                className={`hidden sm:flex h-8 w-8 rounded-full items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  isDarkStudio
                    ? 'text-slate-300 hover:text-white hover:bg-white/10'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize className="h-3.5 w-3.5" strokeWidth={2} />
                ) : (
                  <Maximize className="h-3.5 w-3.5" strokeWidth={2} />
                )}
              </button>
            </div>

            {/* Studio Broadcast Record Pill */}
            <button
              onClick={handleToggleRecord}
              className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-full flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border text-[10.5px] font-extrabold tracking-wider uppercase ${
                recorder.isRecording
                  ? 'bg-rose-600 border-rose-400/50 text-white shadow-[0_0_20px_rgba(225,29,72,0.45)] animate-pulse'
                  : isDarkStudio
                  ? 'bg-white/[0.06] hover:bg-rose-500/20 border-white/12 hover:border-rose-500/40 text-slate-200 hover:text-white'
                  : 'bg-white hover:bg-rose-50 border-slate-200 hover:border-rose-300 text-slate-700'
              }`}
              title={recorder.isRecording ? 'Stop Recording' : 'Record Vedio & Audio'}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full flex items-center justify-center shrink-0 ${
                  recorder.isRecording ? 'bg-white' : 'bg-[#FF4D3A] shadow-[0_0_8px_rgba(255,77,58,0.8)]'
                }`}
              />
              <span className="hidden sm:inline font-mono">
                {recorder.isRecording ? recorder.recordingDuration : 'REC'}
              </span>
            </button>
          </div>
        </header>

        {/* 2. Main Video Stage + Floating Glassmorphic Bottom Control Dock */}
        <div className="flex-1 min-h-0 relative flex flex-col">
        <main className="flex-1 min-h-0 flex flex-col gap-2.5 relative overflow-hidden">
          {/* On-Air Announcement Banner (Clean non-overlapping studio broadcast bar above video) */}
          {broadcastBanner && (
            <div
              className={`shrink-0 rounded-2xl overflow-hidden flex items-center backdrop-blur-xl transition-all ${
                isDarkStudio
                  ? 'bg-[#081124]/90 border border-white/12 shadow-[0_8px_24px_rgba(0,0,0,0.4)]'
                  : 'bg-white/95 border border-slate-200/90 shadow-md'
              }`}
            >
              <div className="px-3.5 py-2 bg-gradient-to-r from-[#FF7A00] to-[#FF4D2E] text-white text-[10px] font-black uppercase tracking-[0.14em] flex items-center gap-1.5 shrink-0 self-stretch">
                <Megaphone className="h-3.5 w-3.5 animate-pulse" />
                <span>Announcement</span>
              </div>
              <div className="flex-1 px-3.5 py-2 flex items-center justify-between gap-3 min-w-0">
                <p
                  className={`text-xs sm:text-[13px] font-semibold truncate ${
                    isDarkStudio ? 'text-white/95' : 'text-slate-800'
                  }`}
                >
                  {broadcastBanner.text}
                </p>
                {hasHostPrivileges && (
                  <button
                    onClick={() => handleSetBroadcastBanner(null)}
                    className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                      isDarkStudio
                        ? 'text-slate-400 hover:text-white hover:bg-white/10'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                    title="Dismiss Announcement"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Auto Network Quality Guard Banner (only when connection is Poor & not already on 360p) */}
          {isPoorNetwork && vedioQuality !== 'low' && (
            <div className="shrink-0 rounded-2xl px-3.5 py-2 bg-amber-500/15 border border-amber-500/35 backdrop-blur-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-amber-200 font-semibold min-w-0">
                <Wifi className="h-3.5 w-3.5 text-amber-400 shrink-0 animate-pulse" />
                <span className="truncate">Unstable network detected — switch to Data Saver for smoother audio &amp; vedio.</span>
              </div>
              <button
                onClick={() => void applyVedioQuality('low')}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-extrabold shrink-0 cursor-pointer transition-colors"
              >
                Use 360p
              </button>
            </div>
          )}

          {/* Synced Host Meeting Countdown Timer Pill */}
          {meetingTimerEndAt && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
              <div
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-2xl border shadow-xl text-xs font-mono font-extrabold ${
                  meetingTimerRemaining === 0
                    ? 'bg-rose-600/90 border-rose-300/40 text-white animate-pulse'
                    : meetingTimerRemaining <= 60
                    ? 'bg-amber-500/90 border-amber-300/50 text-slate-950 animate-pulse'
                    : 'bg-[#060c1a]/82 border-[#00A3FF]/35 text-white'
                }`}
              >
                <Timer className="h-3.5 w-3.5" />
                <span>
                  {meetingTimerRemaining === 0
                    ? "Time's Up!"
                    : `${String(Math.floor(meetingTimerRemaining / 60)).padStart(2, '0')}:${String(
                        meetingTimerRemaining % 60
                      ).padStart(2, '0')}`}
                </span>
                {hasHostPrivileges && (
                  <button
                    onClick={handleClearMeetingTimer}
                    className="ml-0.5 h-4 w-4 rounded-full bg-black/25 hover:bg-black/45 flex items-center justify-center cursor-pointer"
                    title="Clear Timer"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Floating Synced Live Emoji Reactions */}
          {floatingReactions.length > 0 && (
            <div className="absolute bottom-20 left-4 z-30 flex flex-col gap-1.5 pointer-events-none">
              {floatingReactions.map((r) => (
                <div
                  key={r.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#060c1a]/80 backdrop-blur-xl border border-white/15 shadow-lg text-white text-xs font-semibold animate-in fade-in slide-in-from-bottom-4 duration-300"
                >
                  <span className="text-base leading-none">{r.emoji}</span>
                  <span className="max-w-[120px] truncate">{r.sender}</span>
                </div>
              ))}
            </div>
          )}

          {/* Live Auto Captions / Subtitles Overlay (CC) */}
          {(captionsEnabled || liveCaption) && (
            <div className="absolute bottom-16 sm:bottom-18 left-1/2 -translate-x-1/2 z-30 max-w-xl w-[92%] pointer-events-auto">
              <div className="rounded-2xl bg-black/78 backdrop-blur-xl border border-white/15 px-4 py-2.5 shadow-2xl flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#0066FF]/30 text-cyan-300 text-[9px] font-black uppercase tracking-wider">
                      <Subtitles className="h-2.5 w-2.5" />
                      CC
                    </span>
                    <span className="text-[11px] font-bold text-cyan-300 truncate">
                      {liveCaption ? liveCaption.speaker : displayName}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-white/95 font-medium leading-snug">
                    {liveCaption?.text || 'Listening... start speaking to display live captions'}
                  </p>
                </div>
                {captionsEnabled && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setCaptionLang((l) => (l === 'en-US' ? 'bn-BD' : 'en-US'))}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white cursor-pointer"
                      title="Switch Caption Language (English / বাংলা)"
                    >
                      {captionLang === 'en-US' ? 'EN' : 'বাংলা'}
                    </button>
                    <button
                      onClick={() => {
                        setCaptionsEnabled(false);
                        setLiveCaption(null);
                      }}
                      className="h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center cursor-pointer"
                      title="Turn Off Captions"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Floating Live Poll Card (Glassmorphic Broadcast Overlay) */}
          {activePoll && (
            <div
              className={`absolute bottom-20 right-4 z-30 w-[290px] sm:w-[315px] max-w-[92%] rounded-2xl overflow-hidden border shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl ${
                isDarkStudio
                  ? 'bg-[#070f20]/82 border-white/15 text-white'
                  : 'bg-white/92 border-slate-200/90 text-slate-900'
              }`}
            >
              {/* Top MetroMeet Brand Gradient Accent Line */}
              <div className="h-[2.5px] w-full bg-gradient-to-r from-[#0066FF] via-[#00A3FF] to-[#FF7A00]" />
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0066FF]/20 border border-[#0066FF]/35 text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-cyan-300">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF7A00] opacity-80" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#FF7A00]" />
                        </span>
                        Live Poll
                      </span>
                      <span
                        className={`text-[10.5px] font-medium truncate ${
                          isDarkStudio ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        by {activePoll.createdBy}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold leading-snug tracking-tight pt-0.5">
                      {activePoll.question}
                    </h4>
                  </div>
                  {hasHostPrivileges && (
                    <button
                      onClick={handleClosePoll}
                      className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        isDarkStudio
                          ? 'text-slate-400 hover:text-white hover:bg-white/10'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                      title="Close Poll"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {(() => {
                  const totalVotes = activePoll.options.reduce((s, o) => s + o.votes.length, 0);
                  const myId = localParticipant?.identity || 'local';
                  return (
                    <>
                      <div className="space-y-2">
                        {activePoll.options.map((opt) => {
                          const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
                          const voted = opt.votes.includes(myId);
                          return (
                            <button
                              key={opt.id}
                              onClick={() => handleVotePoll(opt.id)}
                              className={`w-full text-left relative overflow-hidden rounded-xl border px-3 py-2.5 transition-all cursor-pointer group ${
                                voted
                                  ? 'border-[#00A3FF]/70 bg-[#0066FF]/15 shadow-[0_0_16px_rgba(0,102,255,0.2)]'
                                  : isDarkStudio
                                  ? 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20'
                                  : 'border-slate-200 bg-slate-50/80 hover:border-[#0066FF]/40'
                              }`}
                            >
                              <div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#0066FF]/35 to-[#00A3FF]/20 transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                              <div className="relative z-10 flex items-center justify-between gap-2.5 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                                      voted
                                        ? 'bg-[#0066FF] border-[#00A3FF] text-white'
                                        : isDarkStudio
                                        ? 'border-white/25 group-hover:border-cyan-400/60'
                                        : 'border-slate-300 group-hover:border-[#0066FF]'
                                    }`}
                                  >
                                    {voted && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                                  </span>
                                  <span className="font-semibold truncate">{opt.text}</span>
                                </div>
                                <span
                                  className={`font-mono text-[11px] font-bold tabular-nums shrink-0 ${
                                    voted
                                      ? isDarkStudio
                                        ? 'text-cyan-300'
                                        : 'text-[#0066FF]'
                                      : isDarkStudio
                                      ? 'text-slate-300'
                                      : 'text-slate-600'
                                  }`}
                                >
                                  {pct}%{' '}
                                  <span className="opacity-65 font-normal">({opt.votes.length})</span>
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div
                        className={`pt-1.5 border-t flex items-center justify-between text-[10.5px] font-medium ${
                          isDarkStudio
                            ? 'border-white/10 text-slate-400'
                            : 'border-slate-200/80 text-slate-500'
                        }`}
                      >
                        <span>
                          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <BarChart2 className="h-3 w-3 text-[#FF7A00]" />
                          Live results
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {presentationTrack ? (
            /* Google Meet & Zoom Presentation Mode (Auto when Screen Sharing or Pinned) */
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2.5 pb-16 sm:pb-14">
              {/* Primary Presentation / Pinned Stage */}
              <div className="flex-1 min-h-0">
                {renderVideoTile(presentationTrack, 'main')}
              </div>

              {/* Compact Side Filmstrip on Desktop, Bottom Strip on Mobile */}
              {presentationStripTracks.length > 0 && (
                <div className="h-28 lg:h-full lg:w-56 xl:w-64 shrink-0 flex lg:flex-col items-stretch gap-2 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto pb-1 lg:pb-0">
                  {presentationStripTracks.map((t) => (
                    <div key={`${t.participant.identity}-${t.source}`} className="w-40 lg:w-full h-full lg:h-36 shrink-0">
                      {renderVideoTile(t, 'thumb')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Google Meet & Zoom Adaptive Gallery Grid with Smart Pagination (up to 50+ participants) */
            <div className="flex-1 min-h-0 relative pb-16 sm:pb-14">
              <div className={getGridClasses(pagedTracks.length)}>
                {pagedTracks.map((t) => renderVideoTile(t, 'grid'))}
              </div>

              {/* Zoom-Style Floating Gallery Pagination Controls (visible when 2+ pages) */}
              {totalPages > 1 && (
                <>
                  <button
                    onClick={() => setGalleryPage((p) => Math.max(0, p - 1))}
                    disabled={safeGalleryPage === 0}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 z-30 h-10 w-10 rounded-full bg-[#060c1a]/80 hover:bg-[#0066FF] text-white border border-white/15 backdrop-blur-xl shadow-xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed active:scale-95"
                    title="Previous Page"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <button
                    onClick={() => setGalleryPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={safeGalleryPage >= totalPages - 1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 z-30 h-10 w-10 rounded-full bg-[#060c1a]/80 hover:bg-[#0066FF] text-white border border-white/15 backdrop-blur-xl shadow-xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed active:scale-95"
                    title="Next Page"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>

                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-[#060c1a]/80 backdrop-blur-xl border border-white/15 text-[11px] font-bold text-white shadow-lg flex items-center gap-2">
                    <span>
                      Page {safeGalleryPage + 1} / {totalPages}
                    </span>
                    <span className="h-3 w-px bg-white/20" />
                    <span className="text-cyan-300">{orderedTracks.length} online</span>
                  </div>
                </>
              )}
            </div>
          )}
        </main>

        {/* 4. Floating Glassmorphic Control Dock (Native Mobile App Bar on mobile, Compact Floating Capsule on desktop) */}
        <footer className="absolute bottom-2.5 inset-x-2.5 sm:inset-x-auto sm:bottom-3.5 sm:left-1/2 sm:-translate-x-1/2 z-40 sm:max-w-[96%]">
          <div
            className={`px-2 py-2 sm:px-2.5 sm:py-1.5 rounded-2xl sm:rounded-full flex items-center justify-around sm:justify-center gap-1 sm:gap-1.5 backdrop-blur-2xl border transition-all ${
              isDarkStudio
                ? 'bg-[#060c1a]/88 sm:bg-[#060c1a]/78 border-white/14 shadow-[0_12px_36px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.14)]'
                : 'bg-white/92 sm:bg-white/88 border-white/75 shadow-[0_12px_32px_rgba(15,23,42,0.16)]'
            }`}
          >
            {/* Screen Share (Desktop Dock; also inside Mobile Bottom Sheet) */}
            <button
              onClick={() => localParticipant.setScreenShareEnabled(!localParticipant.isScreenShareEnabled)}
              className={`hidden sm:flex h-9 w-9 rounded-full items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 ${
                localParticipant.isScreenShareEnabled
                  ? 'bg-gradient-to-br from-[#0066FF] to-[#00A3FF] text-white shadow-[0_4px_14px_rgba(0,102,255,0.45)]'
                  : isDarkStudio
                  ? 'bg-white/[0.06] hover:bg-white/[0.16] text-slate-200 hover:text-white border border-white/[0.08] hover:border-white/20'
                  : 'bg-slate-100/90 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
              }`}
              title={localParticipant.isScreenShareEnabled ? 'Stop Screen Share' : 'Share Screen'}
            >
              <Monitor className="h-4 w-4" strokeWidth={1.9} />
            </button>

            {/* Mic Toggle */}
            <button
              onClick={() => localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled)}
              className="flex flex-col items-center gap-0.5 sm:block cursor-pointer group"
              title={localParticipant.isMicrophoneEnabled ? 'Mute Microphone (M)' : 'Unmute Microphone (M)'}
            >
              <span
                className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-active:scale-95 ${
                  localParticipant.isMicrophoneEnabled
                    ? isDarkStudio
                      ? 'bg-white/[0.08] sm:bg-white/[0.06] group-hover:bg-white/[0.16] text-slate-100 group-hover:text-white border border-white/[0.1] sm:border-white/[0.08]'
                      : 'bg-slate-100/90 group-hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                    : 'bg-rose-500/20 group-hover:bg-rose-500/30 text-rose-400 border border-rose-500/35'
                }`}
              >
                {localParticipant.isMicrophoneEnabled ? (
                  <Mic className="h-4 w-4" strokeWidth={1.9} />
                ) : (
                  <MicOff className="h-4 w-4" strokeWidth={1.9} />
                )}
              </span>
              <span className={`sm:hidden text-[9.5px] font-semibold ${isDarkStudio ? 'text-slate-300' : 'text-slate-600'}`}>
                {localParticipant.isMicrophoneEnabled ? 'Mic' : 'Muted'}
              </span>
            </button>

            {/* Camera (Vedio) Toggle */}
            <button
              onClick={() => localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled)}
              className="flex flex-col items-center gap-0.5 sm:block cursor-pointer group"
              title={localParticipant.isCameraEnabled ? 'Turn Off Vedio (V)' : 'Turn On Vedio (V)'}
            >
              <span
                className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-active:scale-95 ${
                  localParticipant.isCameraEnabled
                    ? isDarkStudio
                      ? 'bg-white/[0.08] sm:bg-white/[0.06] group-hover:bg-white/[0.16] text-slate-100 group-hover:text-white border border-white/[0.1] sm:border-white/[0.08]'
                      : 'bg-slate-100/90 group-hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                    : 'bg-rose-500/20 group-hover:bg-rose-500/30 text-rose-400 border border-rose-500/35'
                }`}
              >
                {localParticipant.isCameraEnabled ? (
                  <Video className="h-4 w-4" strokeWidth={1.9} />
                ) : (
                  <VideoOff className="h-4 w-4" strokeWidth={1.9} />
                )}
              </span>
              <span className={`sm:hidden text-[9.5px] font-semibold ${isDarkStudio ? 'text-slate-300' : 'text-slate-600'}`}>
                Vedio
              </span>
            </button>

            {/* Subtle Divider */}
            <div className={`hidden sm:block h-4 w-px mx-1 ${isDarkStudio ? 'bg-white/12' : 'bg-slate-300/75'}`} />

            {/* Compact Refined "End Meeting" / "Leave" Pill */}
            <button
              onClick={handleExitClick}
              className="flex flex-col items-center gap-0.5 sm:block cursor-pointer group"
            >
              <span className="h-9 px-4 sm:px-4 rounded-full bg-gradient-to-r from-[#FF4D3A] to-[#E11D48] group-hover:from-[#FF5E4D] group-hover:to-[#F43F5E] text-white font-semibold text-xs tracking-wide shadow-[0_4px_16px_rgba(225,29,72,0.42)] transition-all duration-200 group-hover:scale-[1.03] group-active:scale-95 flex items-center gap-1.5">
                <PhoneOff className="h-3.5 w-3.5" strokeWidth={2.2} />
                <span className="hidden sm:inline whitespace-nowrap">{isHost ? 'End' : 'Leave'}</span>
              </span>
              <span className="sm:hidden text-[9.5px] font-bold text-rose-400">
                {isHost ? 'End' : 'Leave'}
              </span>
            </button>

            {/* Subtle Divider */}
            <div className={`hidden sm:block h-4 w-px mx-1 ${isDarkStudio ? 'bg-white/12' : 'bg-slate-300/75'}`} />

            {/* Collaborative Whiteboard / Draw Button (Desktop Dock; also inside Mobile Bottom Sheet) */}
            <button
              onClick={() => setShowWhiteboard(true)}
              className={`hidden sm:flex h-9 w-9 rounded-full items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 ${
                showWhiteboard
                  ? 'bg-gradient-to-br from-[#0066FF] to-[#00A3FF] text-white shadow-[0_4px_14px_rgba(0,102,255,0.45)]'
                  : isDarkStudio
                  ? 'bg-white/[0.06] hover:bg-white/[0.16] text-slate-200 hover:text-white border border-white/[0.08] hover:border-white/20'
                  : 'bg-slate-100/90 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
              }`}
              title="Live Whiteboard & Draw Studio (W)"
            >
              <PenTool className="h-4 w-4" strokeWidth={1.9} />
            </button>

            {/* Participants & Chat Toggle Button (Right before 3 dots) */}
            <button
              onClick={() => {
                setShowMobileSidebar((v) => {
                  const next = !v;
                  if (next) setUnreadChatCount(0);
                  return next;
                });
              }}
              className="flex flex-col items-center gap-0.5 sm:block cursor-pointer group"
              title="Participants & Chat"
            >
              <span
                className={`relative h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-active:scale-95 ${
                  showMobileSidebar
                    ? 'bg-gradient-to-br from-[#0066FF] to-[#00A3FF] text-white shadow-[0_4px_14px_rgba(0,102,255,0.45)]'
                    : isDarkStudio
                    ? 'bg-white/[0.08] sm:bg-white/[0.06] group-hover:bg-white/[0.16] text-slate-200 group-hover:text-white border border-white/[0.1] sm:border-white/[0.08]'
                    : 'bg-slate-100/90 group-hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                }`}
              >
                <Users className="h-4 w-4" strokeWidth={1.9} />
                <span
                  className={`absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center ring-2 ${
                    isDarkStudio ? 'ring-[#060c1a]' : 'ring-white'
                  } ${
                    unreadChatCount > 0
                      ? 'bg-[#FF7A00] text-white animate-pulse'
                      : 'bg-[#0066FF] text-white'
                  }`}
                >
                  {unreadChatCount > 0 ? unreadChatCount : totalCount}
                </span>
              </span>
              <span className={`sm:hidden text-[9.5px] font-semibold ${isDarkStudio ? 'text-slate-300' : 'text-slate-600'}`}>
                People
              </span>
            </button>

            {/* More Options (...) — Native Mobile Bottom Sheet on mobile, Popover on desktop */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu((v) => !v)}
                className="flex flex-col items-center gap-0.5 sm:block cursor-pointer group"
                title="More Studio Tools"
              >
                <span
                  className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-active:scale-95 ${
                    showMoreMenu
                      ? 'bg-gradient-to-br from-[#0066FF] to-[#00A3FF] text-white shadow-[0_4px_14px_rgba(0,102,255,0.45)]'
                      : isDarkStudio
                      ? 'bg-white/[0.08] sm:bg-white/[0.06] group-hover:bg-white/[0.16] text-slate-200 group-hover:text-white border border-white/[0.1] sm:border-white/[0.08]'
                      : 'bg-slate-100/90 group-hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  <MoreHorizontal className="h-4 w-4" strokeWidth={1.9} />
                </span>
                <span className={`sm:hidden text-[9.5px] font-semibold ${isDarkStudio ? 'text-slate-300' : 'text-slate-600'}`}>
                  More
                </span>
              </button>

            {showMoreMenu && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/55 sm:bg-transparent backdrop-blur-[2px] sm:backdrop-blur-none"
                  onClick={() => setShowMoreMenu(false)}
                />
                <div
                  className={`fixed inset-x-0 bottom-0 sm:inset-auto sm:absolute sm:bottom-14 sm:right-0 z-50 w-full sm:w-60 rounded-t-3xl sm:rounded-2xl p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-2 shadow-2xl border-t sm:border space-y-1.5 sm:space-y-1 animate-in fade-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 ${
                    isDarkStudio
                      ? 'bg-[#091224]/98 sm:bg-[#0e1628] border-white/15 text-slate-100'
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  {/* Native Mobile Sheet Drag Handle & Header */}
                  <div className="sm:hidden flex flex-col items-center pb-2 mb-1 border-b border-white/10">
                    <div className="w-10 h-1 rounded-full bg-white/25 mb-2.5" />
                    <div className="w-full flex items-center justify-between px-1">
                      <span className="text-sm font-extrabold tracking-tight">Meeting Menu</span>
                      <button
                        onClick={() => setShowMoreMenu(false)}
                        className="h-7 w-7 rounded-full flex items-center justify-center bg-white/10 text-slate-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Live Emoji Reactions Bar */}
                  <div
                    className={`flex items-center justify-between gap-1 px-2 py-1.5 rounded-xl border mb-1 ${
                      isDarkStudio
                        ? 'bg-white/[0.04] border-white/10'
                        : 'bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    {['👍', '👏', '❤️', '😂', '🎉', '🔥'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          sendLiveReaction(emoji);
                          setShowMoreMenu(false);
                        }}
                        className="h-8 w-8 rounded-lg hover:bg-white/10 active:scale-90 flex items-center justify-center text-base transition-transform cursor-pointer"
                        title={`React with ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {/* Mobile-only Quick Access for Screen Share & Whiteboard */}
                  <button
                    onClick={() => {
                      localParticipant.setScreenShareEnabled(!localParticipant.isScreenShareEnabled);
                      setShowMoreMenu(false);
                    }}
                    className="sm:hidden w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-[#3B82F6]/15 text-xs font-semibold cursor-pointer"
                  >
                    <Monitor className="h-4 w-4 text-[#00A3FF]" />
                    <span>{localParticipant.isScreenShareEnabled ? 'Stop Screen Share' : 'Share Screen'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowWhiteboard(true);
                      setShowMoreMenu(false);
                    }}
                    className="sm:hidden w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-[#3B82F6]/15 text-xs font-semibold cursor-pointer"
                  >
                    <PenTool className="h-4 w-4 text-purple-400" />
                    <span>Live Whiteboard</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowQualityModal(true);
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-3 sm:gap-2.5 px-3.5 py-2.5 sm:px-3 sm:py-2 rounded-xl bg-white/[0.04] sm:bg-transparent hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
                  >
                    <SlidersHorizontal className="h-4 w-4 text-cyan-400" />
                    <span>Voice &amp; Vedio Quality</span>
                  </button>

                  <button
                    onClick={() => {
                      setCaptionsEnabled((prev) => !prev);
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center justify-between gap-3 sm:gap-2.5 px-3.5 py-2.5 sm:px-3 sm:py-2 rounded-xl bg-white/[0.04] sm:bg-transparent hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
                  >
                    <span className="flex items-center gap-3 sm:gap-2.5">
                      <Subtitles className={`h-4 w-4 ${captionsEnabled ? 'text-emerald-400' : 'text-sky-400'}`} />
                      <span>{captionsEnabled ? 'Stop Live Captions (CC)' : 'Live Captions (CC)'}</span>
                    </span>
                    {captionsEnabled && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-black">
                        ON
                      </span>
                    )}
                  </button>

                  {hasHostPrivileges && (
                    <button
                      onClick={() => {
                        setShowTimerModal(true);
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center gap-3 sm:gap-2.5 px-3.5 py-2.5 sm:px-3 sm:py-2 rounded-xl bg-white/[0.04] sm:bg-transparent hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
                    >
                      <Timer className="h-4 w-4 text-amber-400" />
                      <span>{meetingTimerEndAt ? 'Manage Meeting Timer' : 'Start Meeting Timer'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      toggleHandRaise();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-3 sm:gap-2.5 px-3.5 py-2.5 sm:px-3 sm:py-2 rounded-xl bg-white/[0.04] sm:bg-transparent hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
                  >
                    <Hand className={`h-4 w-4 ${isHandRaised ? 'text-amber-500' : 'text-[#3B82F6]'}`} />
                    <span>{isHandRaised ? 'Lower Hand' : 'Raise Hand'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowChatAndNotes(true);
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-3 sm:gap-2.5 px-3.5 py-2.5 sm:px-3 sm:py-2 rounded-xl bg-white/[0.04] sm:bg-transparent hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
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
                        className="w-full flex items-center gap-3 sm:gap-2.5 px-3.5 py-2.5 sm:px-3 sm:py-2 rounded-xl bg-white/[0.04] sm:bg-transparent hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
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
                        className="w-full flex items-center gap-3 sm:gap-2.5 px-3.5 py-2.5 sm:px-3 sm:py-2 rounded-xl bg-white/[0.04] sm:bg-transparent hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
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
                    className="w-full flex items-center gap-3 sm:gap-2.5 px-3.5 py-2.5 sm:px-3 sm:py-2 rounded-xl bg-white/[0.04] sm:bg-transparent hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
                  >
                    <PictureInPicture2 className="h-4 w-4 text-slate-400" />
                    <span>Picture-in-Picture</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowShortcutsModal(true);
                      setShowMoreMenu(false);
                    }}
                    className="hidden sm:flex w-full items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
                  >
                    <Keyboard className="h-4 w-4 text-slate-400" />
                    <span>Keyboard Shortcuts</span>
                  </button>
                </div>
              </>
            )}
            </div>
          </div>
        </footer>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* COLLAPSIBLE PANEL: NATIVE BOTTOM SHEET ON MOBILE, SIDEBAR ON DESKTOP  */}
      {/* ===================================================================== */}
      <aside
        className={`${
          showMobileSidebar
            ? 'fixed inset-x-0 bottom-0 top-14 rounded-t-3xl border-t lg:rounded-none lg:border-t-0 lg:border-l lg:inset-auto lg:relative lg:z-10 z-50 flex lg:w-[340px] xl:w-[360px]'
            : 'hidden'
        } lg:h-full flex-col shrink-0 backdrop-blur-2xl transition-all duration-300 ${
          isDarkStudio
            ? 'bg-[#081020]/98 lg:bg-[#081020]/95 border-[#0066FF]/25 text-slate-100 shadow-2xl shadow-black/60'
            : 'bg-white/98 lg:bg-white/95 border-slate-200/80 text-slate-900'
        }`}
      >
        {/* Native Mobile Sheet Drag Handle */}
        <div className="lg:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/25" />
        </div>
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
              <button
                onClick={() => setShowMobileSidebar(false)}
                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-slate-500/15 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Close Participants & Chat"
              >
                <X className="h-4 w-4" />
              </button>
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

      {/* Voice & Vedio Quality Control Studio (Native Bottom Sheet on Mobile, Glass Modal on Desktop) */}
      {showQualityModal && (() => {
        const activeVedioIdx = VEDIO_QUALITY_LEVELS.findIndex((q) => q.id === vedioQuality);
        const activeVedioCfg = VEDIO_QUALITY_LEVELS[activeVedioIdx] || VEDIO_QUALITY_LEVELS[2];
        const activeVoiceIdx = VOICE_QUALITY_LEVELS.findIndex((q) => q.id === voiceQuality);
        const activeVoiceCfg = VOICE_QUALITY_LEVELS[activeVoiceIdx] || VOICE_QUALITY_LEVELS[1];

        return (
          <div
            className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4"
            onClick={() => setShowQualityModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full sm:max-w-[430px] max-h-[90dvh] sm:max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden border-t sm:border shadow-[0_24px_72px_rgba(0,0,0,0.75)] backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 ${
                isDarkStudio
                  ? 'bg-[#070f20]/96 border-white/15 text-white'
                  : 'bg-white/98 border-slate-200 text-slate-900'
              }`}
            >
              {/* MetroMeet Top Brand Gradient Accent */}
              <div className="h-[3px] w-full shrink-0 bg-gradient-to-r from-[#0066FF] via-[#00A3FF] to-[#FF7A00]" />

              {/* Native Mobile Drag Handle */}
              <div className="sm:hidden flex justify-center pt-2 shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/25" />
              </div>

              {/* Pinned Header (Always visible on every screen height) */}
              <div
                className={`shrink-0 px-5 pt-3.5 pb-3 border-b flex items-center justify-between gap-3 ${
                  isDarkStudio ? 'border-white/[0.08]' : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-[#0066FF] via-[#0088FF] to-[#00A3FF] text-white flex items-center justify-center shadow-lg shadow-[#0066FF]/35">
                    <SlidersHorizontal className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-extrabold tracking-tight leading-tight">
                      Audio &amp; Vedio Quality
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className={`text-[11px] font-medium ${isDarkStudio ? 'text-slate-400' : 'text-slate-500'}`}>
                        {activeVedioCfg.short} {activeVedioCfg.label} · {activeVoiceCfg.short} Audio
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowQualityModal(false)}
                  className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    isDarkStudio
                      ? 'bg-white/[0.06] text-slate-300 hover:text-white hover:bg-white/15'
                      : 'bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable Body (Never clips on laptops or phones) */}
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3.5 space-y-3">

                {/* 1. VEDIO QUALITY CARD */}
                <div
                  className={`rounded-2xl p-3.5 border space-y-3 ${
                    isDarkStudio
                      ? 'bg-white/[0.03] border-white/10'
                      : 'bg-slate-50/90 border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-7 w-7 rounded-xl bg-[#0066FF]/15 border border-[#00A3FF]/25 flex items-center justify-center text-[#00A3FF]">
                        <Video className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="text-xs font-extrabold tracking-tight">Vedio Resolution</p>
                        <p className={`text-[10.5px] ${isDarkStudio ? 'text-slate-400' : 'text-slate-500'}`}>
                          {activeVedioCfg.label} · {activeVedioCfg.detail}
                        </p>
                      </div>
                    </div>

                    {/* Signal Strength Bars + Stepper */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-end gap-[2.5px] h-3.5 pr-1">
                        {[0, 1, 2, 3].map((bar) => (
                          <span
                            key={bar}
                            style={{ height: `${6 + bar * 3}px` }}
                            className={`w-[3px] rounded-full transition-all duration-300 ${
                              bar <= activeVedioIdx
                                ? 'bg-gradient-to-t from-[#0066FF] to-[#00D2FF]'
                                : isDarkStudio
                                ? 'bg-white/15'
                                : 'bg-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => stepVedioQuality(-1)}
                        disabled={isApplyingQuality || vedioQuality === 'low'}
                        className={`h-7 w-7 rounded-full flex items-center justify-center border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 ${
                          isDarkStudio
                            ? 'bg-white/[0.07] border-white/12 hover:bg-white/[0.16] text-white'
                            : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                        title="Decrease Vedio Quality"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => stepVedioQuality(1)}
                        disabled={isApplyingQuality || vedioQuality === 'fhd'}
                        className={`h-7 w-7 rounded-full flex items-center justify-center border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 ${
                          isDarkStudio
                            ? 'bg-white/[0.07] border-white/12 hover:bg-white/[0.16] text-white'
                            : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                        title="Increase Vedio Quality"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 4-Step Segmented Pill Selector */}
                  <div
                    className={`grid grid-cols-4 gap-1 p-1 rounded-xl border ${
                      isDarkStudio
                        ? 'bg-black/35 border-white/[0.07]'
                        : 'bg-slate-200/60 border-slate-200'
                    }`}
                  >
                    {VEDIO_QUALITY_LEVELS.map((item) => {
                      const active = vedioQuality === item.id;
                      return (
                        <button
                          key={item.id}
                          disabled={isApplyingQuality}
                          onClick={() => void applyVedioQuality(item.id)}
                          className={`py-2 px-1 rounded-lg text-center transition-all cursor-pointer ${
                            active
                              ? 'bg-gradient-to-br from-[#0066FF] to-[#0099FF] text-white shadow-md shadow-[#0066FF]/35'
                              : isDarkStudio
                              ? 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                          }`}
                        >
                          <div className="text-[11px] font-extrabold font-mono leading-none">
                            {item.short}
                          </div>
                          <div className={`text-[9px] font-semibold mt-1 truncate ${active ? 'text-white/90' : 'opacity-70'}`}>
                            {item.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. AUDIO / VOICE QUALITY CARD */}
                <div
                  className={`rounded-2xl p-3.5 border space-y-3 ${
                    isDarkStudio
                      ? 'bg-white/[0.03] border-white/10'
                      : 'bg-slate-50/90 border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-7 w-7 rounded-xl bg-[#FF7A00]/15 border border-[#FF7A00]/30 flex items-center justify-center text-[#FF7A00]">
                        <Mic className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="text-xs font-extrabold tracking-tight">Audio Bitrate</p>
                        <p className={`text-[10.5px] ${isDarkStudio ? 'text-slate-400' : 'text-slate-500'}`}>
                          {activeVoiceCfg.label} · {activeVoiceCfg.detail}
                        </p>
                      </div>
                    </div>

                    {/* Audio Level Bars + Stepper */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-end gap-[2.5px] h-3.5 pr-1">
                        {[0, 1, 2, 3].map((bar) => (
                          <span
                            key={bar}
                            style={{ height: `${6 + bar * 3}px` }}
                            className={`w-[3px] rounded-full transition-all duration-300 ${
                              bar <= activeVoiceIdx
                                ? 'bg-gradient-to-t from-[#FF5500] to-[#FFB347]'
                                : isDarkStudio
                                ? 'bg-white/15'
                                : 'bg-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => stepVoiceQuality(-1)}
                        disabled={isApplyingQuality || voiceQuality === 'low'}
                        className={`h-7 w-7 rounded-full flex items-center justify-center border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 ${
                          isDarkStudio
                            ? 'bg-white/[0.07] border-white/12 hover:bg-white/[0.16] text-white'
                            : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                        title="Decrease Audio Quality"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => stepVoiceQuality(1)}
                        disabled={isApplyingQuality || voiceQuality === 'studio'}
                        className={`h-7 w-7 rounded-full flex items-center justify-center border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 ${
                          isDarkStudio
                            ? 'bg-white/[0.07] border-white/12 hover:bg-white/[0.16] text-white'
                            : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                        title="Increase Audio Quality"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 4-Step Segmented Pill Selector */}
                  <div
                    className={`grid grid-cols-4 gap-1 p-1 rounded-xl border ${
                      isDarkStudio
                        ? 'bg-black/35 border-white/[0.07]'
                        : 'bg-slate-200/60 border-slate-200'
                    }`}
                  >
                    {VOICE_QUALITY_LEVELS.map((item) => {
                      const active = voiceQuality === item.id;
                      return (
                        <button
                          key={item.id}
                          disabled={isApplyingQuality}
                          onClick={() => void applyVoiceQuality(item.id)}
                          className={`py-2 px-1 rounded-lg text-center transition-all cursor-pointer ${
                            active
                              ? 'bg-gradient-to-br from-[#FF7A00] to-[#FF4D2E] text-white shadow-md shadow-[#FF7A00]/35'
                              : isDarkStudio
                              ? 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                          }`}
                        >
                          <div className="text-[11px] font-extrabold font-mono leading-none">
                            {item.short}
                          </div>
                          <div className={`text-[9px] font-semibold mt-1 truncate ${active ? 'text-white/90' : 'opacity-70'}`}>
                            {item.label.split(' ')[0]}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. SMART AUDIO ENHANCEMENTS & SPEAKER VOLUME */}
                <div
                  className={`rounded-2xl p-3.5 border space-y-3 ${
                    isDarkStudio
                      ? 'bg-white/[0.03] border-white/10'
                      : 'bg-slate-50/90 border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold">Noise Suppression</p>
                      <p className={`text-[10px] ${isDarkStudio ? 'text-slate-400' : 'text-slate-500'}`}>
                        Reduce fan &amp; background noise
                      </p>
                    </div>
                    <button
                      onClick={() => void applyVoiceQuality(voiceQuality, !noiseSuppression, echoCancellation)}
                      className={`w-11 h-6 rounded-full transition-all duration-200 relative cursor-pointer shrink-0 ${
                        noiseSuppression
                          ? 'bg-gradient-to-r from-[#0066FF] to-[#00A3FF] shadow-inner'
                          : isDarkStudio
                          ? 'bg-white/15'
                          : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                          noiseSuppression ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  <div className={`h-px ${isDarkStudio ? 'bg-white/[0.07]' : 'bg-slate-200/80'}`} />

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold">Echo Cancellation</p>
                      <p className={`text-[10px] ${isDarkStudio ? 'text-slate-400' : 'text-slate-500'}`}>
                        Prevent speaker echo feedback
                      </p>
                    </div>
                    <button
                      onClick={() => void applyVoiceQuality(voiceQuality, noiseSuppression, !echoCancellation)}
                      className={`w-11 h-6 rounded-full transition-all duration-200 relative cursor-pointer shrink-0 ${
                        echoCancellation
                          ? 'bg-gradient-to-r from-[#0066FF] to-[#00A3FF] shadow-inner'
                          : isDarkStudio
                          ? 'bg-white/15'
                          : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                          echoCancellation ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  <div className={`h-px ${isDarkStudio ? 'bg-white/[0.07]' : 'bg-slate-200/80'}`} />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <button
                        onClick={() => setSpeakerVolume((v) => (v === 0 ? 180 : 0))}
                        className="font-bold flex items-center gap-2 cursor-pointer hover:opacity-80"
                        title={speakerVolume === 0 ? 'Unmute Speaker' : 'Mute Speaker'}
                      >
                        {speakerVolume === 0 ? (
                          <VolumeX className="h-4 w-4 text-rose-400" />
                        ) : (
                          <Volume2 className="h-4 w-4 text-emerald-400" />
                        )}
                        <span>Speaker Volume &amp; Boost</span>
                      </button>
                      <span
                        className={`px-2 py-0.5 rounded-full font-mono text-[10.5px] font-extrabold ${
                          speakerVolume > 100
                            ? 'bg-[#FF7A00]/20 text-[#FFA033]'
                            : 'bg-[#0066FF]/15 text-cyan-300'
                        }`}
                      >
                        {speakerVolume}%{speakerVolume > 100 ? ' Boost' : ''}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={300}
                      step={10}
                      value={speakerVolume}
                      onChange={(e) => setSpeakerVolume(Number(e.target.value))}
                      className="w-full accent-[#00A3FF] cursor-pointer h-1.5 rounded-full"
                    />
                    <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                      {[100, 180, 250, 300].map((val) => (
                        <button
                          key={val}
                          onClick={() => setSpeakerVolume(val)}
                          className={`py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                            speakerVolume === val
                              ? 'bg-[#0066FF] text-white shadow-sm'
                              : isDarkStudio
                              ? 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.12]'
                              : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pinned Footer Action Button */}
              <div
                className={`shrink-0 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 border-t ${
                  isDarkStudio ? 'border-white/[0.08]' : 'border-slate-200/80'
                }`}
              >
                <button
                  onClick={() => setShowQualityModal(false)}
                  className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#0066FF] via-[#0088FF] to-[#00A3FF] hover:opacity-95 text-white text-xs font-extrabold tracking-wide shadow-lg shadow-[#0066FF]/30 active:scale-[0.99] transition-all cursor-pointer"
                >
                  Apply &amp; Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Synced Host Meeting Countdown Timer Modal */}
      {showTimerModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setShowTimerModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden border-t sm:border shadow-2xl backdrop-blur-2xl ${
              isDarkStudio
                ? 'bg-[#070f20]/96 border-white/15 text-white'
                : 'bg-white/98 border-slate-200 text-slate-900'
            }`}
          >
            <div className="h-[3px] w-full bg-gradient-to-r from-[#0066FF] via-[#00A3FF] to-[#FF7A00]" />
            <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#FF7A00] to-[#FF4D2E] text-white flex items-center justify-center shadow-lg shadow-[#FF7A00]/30">
                    <Timer className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold tracking-tight">Meeting Countdown Timer</h3>
                    <p className={`text-[11px] ${isDarkStudio ? 'text-slate-400' : 'text-slate-500'}`}>
                      Visible live to all participants
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTimerModal(false)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 30].map((m) => (
                  <button
                    key={m}
                    onClick={() => handleStartMeetingTimer(m)}
                    className={`py-2.5 rounded-xl border text-xs font-extrabold transition-all cursor-pointer active:scale-95 ${
                      isDarkStudio
                        ? 'bg-white/[0.05] hover:bg-[#0066FF] border-white/10 hover:border-[#00A3FF] text-white'
                        : 'bg-slate-100 hover:bg-[#0066FF] hover:text-white border-slate-200 text-slate-800'
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const mins = Number(customTimerMinutes);
                  if (mins > 0 && mins <= 240) handleStartMeetingTimer(mins);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={customTimerMinutes}
                  onChange={(e) => setCustomTimerMinutes(e.target.value)}
                  placeholder="Minutes"
                  className={`flex-1 rounded-xl px-3.5 py-2.5 text-xs font-mono outline-none border ${
                    isDarkStudio
                      ? 'bg-black/40 border-white/15 text-white focus:border-[#00A3FF]'
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#0066FF]'
                  }`}
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00A3FF] text-white text-xs font-bold shadow-md shadow-[#0066FF]/30 cursor-pointer"
                >
                  Start
                </button>
              </form>

              {meetingTimerEndAt && (
                <button
                  onClick={handleClearMeetingTimer}
                  className="w-full py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 text-xs font-bold cursor-pointer"
                >
                  Stop &amp; Clear Active Timer
                </button>
              )}
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
      options={{
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
          channelCount: 1,
        },
        publishDefaults: {
          audioPreset: AudioPresets.music,
          dtx: false,
          red: true,
        },
        adaptiveStream: true,
        dynacast: true,
      }}
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
