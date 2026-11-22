'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  FlipHorizontal,
  Hand,
  Maximize,
  Mic,
  MicOff,
  Minimize,
  Minus,
  Monitor,
  Moon,
  MoreHorizontal,
  PenTool,
  PhoneOff,
  PictureInPicture2,
  Pin,
  PinOff,
  Plus,
  Send,
  Share2,
  SlidersHorizontal,
  Subtitles,
  Sun,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { BroadcastNameplate } from './broadcast-nameplate';
import { ChatAndNotesDrawer, ChatMessage } from './chat-and-notes-drawer';
import { WhiteboardCanvas, WhiteboardElement } from './whiteboard-canvas';
import { useToast } from '@/components/ui/toast';
import { useMeetingRecorder } from '@/lib/recording/use-meeting-recorder';

export interface StudioTile {
  key: string;
  id: string;
  name: string;
  isLocal: boolean;
  isHost?: boolean;
  isMicOn: boolean;
  isSpeaking?: boolean;
  isScreenShare?: boolean;
  hasVideo: boolean;
  renderVideo: (mirrored: boolean) => React.ReactNode;
}

export interface StudioParticipantItem {
  id: string;
  name: string;
  isLocal: boolean;
  isHost?: boolean;
  isMicOn: boolean;
  isCamOn: boolean;
}

interface UnifiedStudioShellProps {
  meetingId: string;
  meetingTitle: string;
  isHost: boolean;
  displayName: string;
  tiles: StudioTile[];
  participants: StudioParticipantItem[];
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onLeave: () => void;
  onEndMeeting?: () => Promise<void> | void;
  messages?: ChatMessage[];
  onSendMessage?: (text: string) => void;
  onQualityChange?: (vedioPreset: 'low' | 'medium' | 'hd' | 'fhd') => void;
  isConnecting?: boolean;
  connectError?: string | null;
}

const VEDIO_LEVELS = [
  { id: 'low' as const, short: '360p', label: 'Data Saver', detail: '360p · 15 fps' },
  { id: 'medium' as const, short: '540p', label: 'Standard', detail: '540p · 24 fps' },
  { id: 'hd' as const, short: '720p', label: 'HD', detail: '720p · 30 fps' },
  { id: 'fhd' as const, short: '1080p', label: 'Full HD', detail: '1080p · 30 fps' },
];

export function UnifiedStudioShell({
  meetingId,
  meetingTitle,
  isHost,
  displayName,
  tiles,
  participants,
  isMicOn,
  isCamOn,
  isScreenSharing,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onLeave,
  onEndMeeting,
  messages: externalMessages,
  onSendMessage,
  onQualityChange,
  isConnecting = false,
  connectError = null,
}: UnifiedStudioShellProps) {
  const toast = useToast();
  const recorder = useMeetingRecorder(meetingTitle);

  const [isDarkStudio, setIsDarkStudio] = useState(true);
  const [isMirrored, setIsMirrored] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [isHandRaised, setIsHandRaised] = useState(false);

  // Drawers, Panels & Modals
  const [showSidebar, setShowSidebar] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showChatAndNotes, setShowChatAndNotes] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [showHostExitModal, setShowHostExitModal] = useState(false);

  // Quality & Boost state
  const [vedioQuality, setVedioQuality] = useState<'low' | 'medium' | 'hd' | 'fhd'>('hd');
  const [speakerVolume, setSpeakerVolume] = useState(180);

  // Local Chat fallback if parent doesn't supply messages
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_studio',
      sender: 'MetroMeet Bot',
      isLocal: false,
      text: 'Welcome! You can chat with Everyone during the meeting.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatMessages = externalMessages ?? localMessages;

  // Whiteboard local elements
  const [wbElements, setWbElements] = useState<WhiteboardElement[]>([]);
  const [wbRedoStack, setWbRedoStack] = useState<WhiteboardElement[]>([]);

  // Live Captions (CC) & Floating Reactions
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionLang, setCaptionLang] = useState<'en-US' | 'bn-BD'>('en-US');
  const [liveCaption, setLiveCaption] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const [floatingReactions, setFloatingReactions] = useState<
    { id: string; emoji: string; sender: string }[]
  >([]);

  // Live Duration Clock: pauses when alone and tab is hidden; resumes automatically on return or when 2+ participants connect
  const participantsCountRef = useRef(participants.length);
  useEffect(() => {
    participantsCountRef.current = participants.length;
  }, [participants.length]);

  useEffect(() => {
    const id = setInterval(() => {
      const isSingleUser = participantsCountRef.current <= 1;
      const isTabHidden = typeof document !== 'undefined' && document.visibilityState !== 'visible';
      if (isSingleUser && isTabHidden) return;
      setCallDuration((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const todayFormatted = useMemo(
    () =>
      new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    []
  );

  // Broadcast 15s vertical-scroll ticker (LIVE | Time -> LIVE | Date)
  const [showDateInLiveBadge, setShowDateInLiveBadge] = useState(false);
  useEffect(() => {
    let hideTimeout: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setShowDateInLiveBadge(true);
      hideTimeout = setTimeout(() => setShowDateInLiveBadge(false), 4000);
    }, 15000);
    return () => {
      clearInterval(interval);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, []);

  // Speaker volume sync
  useEffect(() => {
    const vol = Math.max(0, Math.min(1, speakerVolume / 100));
    const apply = () => {
      document.querySelectorAll('audio, video').forEach((el) => {
        if (el instanceof HTMLMediaElement && !el.muted) {
          el.volume = vol;
        }
      });
    };
    apply();
    const id = setInterval(apply, 1500);
    return () => clearInterval(id);
  }, [speakerVolume, tiles.length]);

  // Live Captions via Browser Web Speech API
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
    const Ctor =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!Ctor) {
      toast.info('Live Captions require Chrome, Edge, or Safari.');
      setCaptionsEnabled(false);
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = captionLang;
    rec.onresult = (event: any) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      if (text.trim()) setLiveCaption(text.trim());
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
  }, [captionsEnabled, captionLang, toast]);

  // Responsive Gallery Pagination (6 Mobile / 9 Tablet / 16 Desktop)
  const [galleryPage, setGalleryPage] = useState(0);
  const [pageSize, setPageSize] = useState(16);
  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 640) setPageSize(6);
      else if (window.innerWidth < 1024) setPageSize(9);
      else setPageSize(16);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const presentationTile = useMemo(() => {
    const screenTile = tiles.find((t) => t.isScreenShare);
    if (screenTile) return screenTile;
    if (pinnedKey) return tiles.find((t) => t.key === pinnedKey) || null;
    return null;
  }, [tiles, pinnedKey]);

  const stripTiles = useMemo(
    () => (presentationTile ? tiles.filter((t) => t.key !== presentationTile.key) : []),
    [tiles, presentationTile]
  );

  const totalPages = Math.max(1, Math.ceil(tiles.length / pageSize));
  const safePage = Math.min(galleryPage, totalPages - 1);
  const pagedTiles = tiles.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const getGridClasses = (count: number) => {
    if (count <= 1) return 'w-full h-full grid grid-cols-1 grid-rows-1';
    if (count === 2) return 'w-full h-full grid grid-cols-1 sm:grid-cols-2 grid-rows-2 sm:grid-rows-1 gap-2.5 sm:gap-3';
    if (count <= 4) return 'w-full h-full grid grid-cols-2 grid-rows-2 gap-2.5 sm:gap-3';
    if (count <= 6) return 'w-full h-full grid grid-cols-2 sm:grid-cols-3 grid-rows-3 sm:grid-rows-2 gap-2 sm:gap-2.5';
    if (count <= 9) return 'w-full h-full grid grid-cols-2 sm:grid-cols-3 grid-rows-3 gap-2 sm:gap-2.5';
    if (count <= 12) return 'w-full h-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 grid-rows-3 gap-2';
    return 'w-full h-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 grid-rows-4 gap-2';
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        const video = document.querySelector('video');
        if (video && 'requestPictureInPicture' in video) {
          await (video as HTMLVideoElement).requestPictureInPicture();
        } else {
          toast.info('No active vedio available for Picture-in-Picture');
        }
      }
    } catch {
      toast.info('Picture-in-Picture is not supported on this browser');
    }
  };

  const copyMeetingLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(`${window.location.origin}/meeting/${meetingId}`).catch(() => {});
    setIsCopied(true);
    toast.success('Meeting link copied!');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleCopyFormattedInvite = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/meeting/${meetingId}`;
    const inviteText = [
      `MetroMeet PRO — Meeting Invitation`,
      `Topic: ${meetingTitle}`,
      `Join Link: ${url}`,
      `Room Code: ${meetingId}`,
    ].join('\n');
    navigator.clipboard.writeText(inviteText).catch(() => {});
    toast.success('Full WhatsApp / Email invitation copied!');
  };

  const handleExportAttendanceCSV = () => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const rows = [
      ['Meeting Title', 'Room Code', 'Date', 'Participant Name', 'Role', 'Captured At'],
      ...participants.map((p) => [
        `"${(meetingTitle || 'Meeting').replace(/"/g, '""')}"`,
        meetingId,
        todayFormatted,
        `"${p.name.replace(/"/g, '""')}"`,
        p.isHost ? 'Host' : 'Participant',
        nowTime,
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MetroMeet-Attendance-${meetingId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Attendance exported (${participants.length} participant${participants.length === 1 ? '' : 's'})`);
  };

  const handleToggleRecord = async () => {
    if (recorder.isRecording) {
      recorder.stopRecording();
      toast.success('Recording saved! Download starting.');
    } else {
      const started = await recorder.startRecording();
      if (started) toast.success('Recording started!');
      else toast.error('Recording cancelled or permission not granted.');
    }
  };

  const handleExitClick = () => {
    if (recorder.isRecording) recorder.stopRecording();
    if (isHost && onEndMeeting) setShowHostExitModal(true);
    else onLeave();
  };

  const sendReaction = (emoji: string) => {
    const rid = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setFloatingReactions((prev) => [...prev.slice(-8), { id: rid, emoji, sender: displayName }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== rid));
    }, 3200);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    if (onSendMessage) {
      onSendMessage(text);
    } else {
      setLocalMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}`,
          sender: displayName,
          isLocal: true,
          text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
    setChatInput('');
  };

  const renderTile = (tile: StudioTile, variant: 'main' | 'thumb' | 'grid') => {
    const isPinned = pinnedKey === tile.key;
    return (
      <div
        key={tile.key}
        onClick={() => {
          if (variant === 'thumb') setPinnedKey(isPinned ? null : tile.key);
        }}
        className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
          variant === 'thumb' ? 'w-full h-full cursor-pointer' : 'w-full h-full'
        } ${
          tile.isSpeaking
            ? 'ring-2 ring-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.3)]'
            : isDarkStudio
            ? 'bg-[#0b1326] border border-white/10 shadow-xl'
            : 'bg-slate-200 border border-slate-300/80 shadow-md'
        }`}
      >
        {tile.hasVideo ? (
          tile.renderVideo(tile.isLocal && !tile.isScreenShare && isMirrored)
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
              {tile.name.slice(0, 2).toUpperCase()}
            </div>
            {variant !== 'thumb' && (
              <p className={`text-xs font-semibold ${isDarkStudio ? 'text-slate-300' : 'text-slate-600'}`}>
                {tile.name} {tile.isLocal ? '(You)' : ''}
              </p>
            )}
          </div>
        )}

        {/* Top-Left Monochrome White MetroMeet PRO Watermark + 15s Broadcast LIVE Ticker */}
        <div className="absolute top-3.5 left-3.5 z-20 flex flex-col items-start gap-1 pointer-events-none select-none">
          <div
            className={`inline-flex flex-col items-start ${
              variant === 'thumb'
                ? 'opacity-45 scale-[0.65] origin-top-left -mb-1.5'
                : 'opacity-55 drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]'
            }`}
          >
            <svg className="w-full overflow-visible -mb-0.5" height="9" viewBox="0 0 160 14" fill="none">
              <path
                d="M 6 12 Q 80 -3 154 12"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
            </svg>
            <div className="flex items-center tracking-tight font-black italic leading-none">
              <span className="text-[15px] text-white/90">Metro</span>
              <span className="text-[15px] text-white/90 ml-1">Meet</span>
              <span className="ml-1.5 px-2 py-[2px] text-[8px] not-italic font-black tracking-widest rounded-full bg-white/35 text-white/95 uppercase">
                PRO
              </span>
            </div>
          </div>

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
              <div className={`overflow-hidden relative ${variant === 'thumb' ? 'h-[10px]' : 'h-[12px]'}`}>
                <div
                  className={`flex flex-col transition-transform duration-500 ease-in-out ${
                    showDateInLiveBadge && variant !== 'thumb' ? '-translate-y-1/2' : 'translate-y-0'
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

        {/* Top-Right Glassmorphic Badges (Hand Raised + Pin + Mic Status) */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          {tile.isLocal && isHandRaised && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-[#0066FF]/90 to-[#00A3FF]/90 backdrop-blur-md border border-white/25 text-white font-bold text-[11px] shadow-lg animate-pulse">
              <span>✋</span>
              {variant !== 'thumb' && <span>Hand Raised</span>}
            </div>
          )}
          {variant !== 'thumb' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPinnedKey(isPinned ? null : tile.key);
              }}
              className={`h-8 w-8 rounded-full flex items-center justify-center backdrop-blur-md border shadow-md transition-all cursor-pointer active:scale-95 ${
                isPinned
                  ? 'bg-emerald-500/90 border-emerald-300/40 text-white'
                  : 'bg-black/45 hover:bg-black/65 border-white/15 text-white/90 hover:text-white'
              }`}
              title={isPinned ? 'Unpin' : 'Pin'}
            >
              {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
          )}
          <div
            className={`${
              variant === 'thumb' ? 'h-7 w-7' : 'h-8 w-8'
            } rounded-full flex items-center justify-center backdrop-blur-md border shadow-md ${
              tile.isMicOn
                ? 'bg-[#0066FF]/85 border-white/20 text-white'
                : 'bg-black/55 border-rose-500/40 text-rose-400'
            }`}
          >
            {tile.isMicOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
          </div>
        </div>

        {/* Bottom-Left Broadcast Nameplate */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between pointer-events-none z-20">
          <BroadcastNameplate
            name={tile.name}
            isLocal={tile.isLocal}
            isHost={Boolean(tile.isHost)}
            isCoHost={false}
            isSpeaking={Boolean(tile.isSpeaking)}
            isMuted={!tile.isMicOn}
          />
        </div>
      </div>
    );
  };

  const activeVedioIdx = VEDIO_LEVELS.findIndex((q) => q.id === vedioQuality);
  const activeVedioCfg = VEDIO_LEVELS[activeVedioIdx] || VEDIO_LEVELS[2];

  return (
    <div
      className={`h-screen w-screen flex overflow-hidden relative transition-colors duration-500 ${
        isDarkStudio ? 'bg-[#050a14] text-slate-100' : 'bg-[#F3F6FB] text-slate-900'
      }`}
    >
      {/* Animated Optical Aurora Studio Background (Identical to LiveKit Stage) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        {isDarkStudio ? (
          <>
            <div className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full bg-[#0066FF]/18 blur-[120px] animate-pulse" />
            <div
              className="absolute -bottom-36 right-1/4 w-[480px] h-[480px] rounded-full bg-[#FF7A00]/14 blur-[130px] animate-pulse"
              style={{ animationDelay: '1.5s', animationDuration: '5s' }}
            />
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, #388BFF 1px, transparent 1px), linear-gradient(to bottom, #388BFF 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
          </>
        ) : (
          <>
            <div className="absolute -top-28 -left-20 w-[440px] h-[440px] rounded-full bg-[#0066FF]/10 blur-[110px]" />
            <div className="absolute -bottom-28 right-1/4 w-[420px] h-[420px] rounded-full bg-[#FF7A00]/10 blur-[120px]" />
          </>
        )}
      </div>

      {/* LEFT MAIN STAGE COLUMN */}
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

            <div className="hidden sm:flex items-center shrink-0">
              <BrandLogo size="sm" showTagline={false} href="" />
            </div>

            <div className={`h-6 w-px shrink-0 hidden sm:block ${isDarkStudio ? 'bg-white/10' : 'bg-slate-200'}`} />

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
                >
                  {isCopied ? <Check className="h-2.5 w-2.5" strokeWidth={2.5} /> : <Copy className="h-2.5 w-2.5" strokeWidth={2.2} />}
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
                title="Toggle Mirror Camera"
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
                title="Switch Studio Theme"
              >
                {isDarkStudio ? <Sun className="h-3.5 w-3.5" strokeWidth={2} /> : <Moon className="h-3.5 w-3.5" strokeWidth={2} />}
              </button>

              <button
                onClick={toggleFullscreen}
                className={`hidden sm:flex h-8 w-8 rounded-full items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  isDarkStudio
                    ? 'text-slate-300 hover:text-white hover:bg-white/10'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize className="h-3.5 w-3.5" strokeWidth={2} /> : <Maximize className="h-3.5 w-3.5" strokeWidth={2} />}
              </button>
            </div>

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
                className={`h-2.5 w-2.5 rounded-full shrink-0 ${
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
            {/* Floating Reactions */}
            {floatingReactions.length > 0 && (
              <div className="absolute bottom-20 left-4 z-30 flex flex-col gap-1.5 pointer-events-none">
                {floatingReactions.map((r) => (
                  <div
                    key={r.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#060c1a]/80 backdrop-blur-xl border border-white/15 shadow-lg text-white text-xs font-semibold"
                  >
                    <span className="text-base leading-none">{r.emoji}</span>
                    <span className="max-w-[120px] truncate">{r.sender}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Live Captions (CC) */}
            {(captionsEnabled || liveCaption) && (
              <div className="absolute bottom-16 sm:bottom-18 left-1/2 -translate-x-1/2 z-30 max-w-xl w-[92%]">
                <div className="rounded-2xl bg-black/78 backdrop-blur-xl border border-white/15 px-4 py-2.5 shadow-2xl flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#0066FF]/30 text-cyan-300 text-[9px] font-black uppercase">
                        <Subtitles className="h-2.5 w-2.5" /> CC
                      </span>
                      <span className="text-[11px] font-bold text-cyan-300 truncate">{displayName}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-white/95 font-medium leading-snug">
                      {liveCaption || 'Listening... start speaking to display live captions'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setCaptionLang((l) => (l === 'en-US' ? 'bn-BD' : 'en-US'))}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white cursor-pointer"
                    >
                      {captionLang === 'en-US' ? 'EN' : 'বাংলা'}
                    </button>
                    <button
                      onClick={() => {
                        setCaptionsEnabled(false);
                        setLiveCaption(null);
                      }}
                      className="h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {connectError ? (
              <div className="flex-1 min-h-0 pb-16 sm:pb-14">
                <div className="h-full w-full rounded-2xl border border-rose-500/30 bg-[#081020] flex flex-col items-center justify-center p-6 text-center gap-3">
                  <p className="text-sm font-bold text-rose-400">Connection Notice</p>
                  <p className="text-xs text-slate-400 max-w-md">{connectError}</p>
                  <button
                    onClick={onLeave}
                    className="px-4 py-2 rounded-xl bg-[#0066FF] text-white text-xs font-bold cursor-pointer"
                  >
                    Return to Dashboard
                  </button>
                </div>
              </div>
            ) : isConnecting ? (
              <div className="flex-1 min-h-0 pb-16 sm:pb-14">
                <div className="h-full w-full rounded-2xl border border-white/10 bg-[#081020] flex flex-col items-center justify-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-[#0066FF]/20 border border-[#00A3FF]/40 flex items-center justify-center">
                    <Video className="h-5 w-5 text-[#00A3FF] animate-pulse" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Connecting to meeting room...
                  </p>
                </div>
              </div>
            ) : presentationTile ? (
              <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2.5 pb-16 sm:pb-14">
                <div className="flex-1 min-h-0">{renderTile(presentationTile, 'main')}</div>
                {stripTiles.length > 0 && (
                  <div className="h-28 lg:h-full lg:w-56 xl:w-64 shrink-0 flex lg:flex-col items-stretch gap-2 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto pb-1 lg:pb-0">
                    {stripTiles.map((t) => (
                      <div key={t.key} className="w-40 lg:w-full h-full lg:h-36 shrink-0">
                        {renderTile(t, 'thumb')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 min-h-0 relative pb-16 sm:pb-14">
                <div className={getGridClasses(pagedTiles.length)}>
                  {pagedTiles.map((t) => renderTile(t, 'grid'))}
                </div>

                {totalPages > 1 && (
                  <>
                    <button
                      onClick={() => setGalleryPage((p) => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 z-30 h-10 w-10 rounded-full bg-[#060c1a]/80 hover:bg-[#0066FF] text-white border border-white/15 backdrop-blur-xl shadow-xl flex items-center justify-center cursor-pointer disabled:opacity-25"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setGalleryPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={safePage >= totalPages - 1}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 z-30 h-10 w-10 rounded-full bg-[#060c1a]/80 hover:bg-[#0066FF] text-white border border-white/15 backdrop-blur-xl shadow-xl flex items-center justify-center cursor-pointer disabled:opacity-25"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-[#060c1a]/80 backdrop-blur-xl border border-white/15 text-[11px] font-bold text-white shadow-lg flex items-center gap-2">
                      <span>
                        Page {safePage + 1} / {totalPages}
                      </span>
                      <span className="h-3 w-px bg-white/20" />
                      <span className="text-cyan-300">{tiles.length} online</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </main>

          {/* 3. Exact Floating Glassmorphic Bottom Control Dock */}
          <footer className="absolute bottom-2.5 inset-x-2.5 sm:inset-x-auto sm:bottom-3.5 sm:left-1/2 sm:-translate-x-1/2 z-40 sm:max-w-[96%]">
            <div
              className={`px-2 py-2 sm:px-2.5 sm:py-1.5 rounded-2xl sm:rounded-full flex items-center justify-around sm:justify-center gap-1 sm:gap-1.5 backdrop-blur-2xl border transition-all ${
                isDarkStudio
                  ? 'bg-[#060c1a]/88 sm:bg-[#060c1a]/78 border-white/14 shadow-[0_12px_36px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.14)]'
                  : 'bg-white/92 sm:bg-white/88 border-white/75 shadow-[0_12px_32px_rgba(15,23,42,0.16)]'
              }`}
            >
              {/* Screen Share */}
              <button
                onClick={onToggleScreenShare}
                className={`hidden sm:flex h-9 w-9 rounded-full items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 ${
                  isScreenSharing
                    ? 'bg-gradient-to-br from-[#0066FF] to-[#00A3FF] text-white shadow-[0_4px_14px_rgba(0,102,255,0.45)]'
                    : isDarkStudio
                    ? 'bg-white/[0.06] hover:bg-white/[0.16] text-slate-200 hover:text-white border border-white/[0.08]'
                    : 'bg-slate-100/90 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                }`}
                title="Share Screen"
              >
                <Monitor className="h-4 w-4" strokeWidth={1.9} />
              </button>

              {/* Mic Toggle */}
              <button
                onClick={onToggleMic}
                className="flex flex-col items-center gap-0.5 sm:block cursor-pointer group"
                title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                <span
                  className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-active:scale-95 ${
                    isMicOn
                      ? isDarkStudio
                        ? 'bg-white/[0.08] sm:bg-white/[0.06] group-hover:bg-white/[0.16] text-slate-100 border border-white/[0.1]'
                        : 'bg-slate-100/90 group-hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                      : 'bg-rose-500/20 group-hover:bg-rose-500/30 text-rose-400 border border-rose-500/35'
                  }`}
                >
                  {isMicOn ? <Mic className="h-4 w-4" strokeWidth={1.9} /> : <MicOff className="h-4 w-4" strokeWidth={1.9} />}
                </span>
                <span className={`sm:hidden text-[9.5px] font-semibold ${isDarkStudio ? 'text-slate-300' : 'text-slate-600'}`}>
                  {isMicOn ? 'Mic' : 'Muted'}
                </span>
              </button>

              {/* Vedio Toggle */}
              <button
                onClick={onToggleCam}
                className="flex flex-col items-center gap-0.5 sm:block cursor-pointer group"
                title={isCamOn ? 'Turn Off Vedio' : 'Turn On Vedio'}
              >
                <span
                  className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-active:scale-95 ${
                    isCamOn
                      ? isDarkStudio
                        ? 'bg-white/[0.08] sm:bg-white/[0.06] group-hover:bg-white/[0.16] text-slate-100 border border-white/[0.1]'
                        : 'bg-slate-100/90 group-hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                      : 'bg-rose-500/20 group-hover:bg-rose-500/30 text-rose-400 border border-rose-500/35'
                  }`}
                >
                  {isCamOn ? <Video className="h-4 w-4" strokeWidth={1.9} /> : <VideoOff className="h-4 w-4" strokeWidth={1.9} />}
                </span>
                <span className={`sm:hidden text-[9.5px] font-semibold ${isDarkStudio ? 'text-slate-300' : 'text-slate-600'}`}>
                  Vedio
                </span>
              </button>

              <div className={`hidden sm:block h-4 w-px mx-1 ${isDarkStudio ? 'bg-white/12' : 'bg-slate-300/75'}`} />

              {/* End / Leave Pill */}
              <button onClick={handleExitClick} className="flex flex-col items-center gap-0.5 sm:block cursor-pointer group">
                <span className="h-9 px-4 rounded-full bg-gradient-to-r from-[#FF4D3A] to-[#E11D48] text-white font-semibold text-xs tracking-wide shadow-[0_4px_16px_rgba(225,29,72,0.42)] transition-all duration-200 group-hover:scale-[1.03] group-active:scale-95 flex items-center gap-1.5">
                  <PhoneOff className="h-3.5 w-3.5" strokeWidth={2.2} />
                  <span className="hidden sm:inline">{isHost ? 'End' : 'Leave'}</span>
                </span>
                <span className="sm:hidden text-[9.5px] font-bold text-rose-400">{isHost ? 'End' : 'Leave'}</span>
              </button>

              <div className={`hidden sm:block h-4 w-px mx-1 ${isDarkStudio ? 'bg-white/12' : 'bg-slate-300/75'}`} />

              {/* Whiteboard */}
              <button
                onClick={() => setShowWhiteboard(true)}
                className={`hidden sm:flex h-9 w-9 rounded-full items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 ${
                  showWhiteboard
                    ? 'bg-gradient-to-br from-[#0066FF] to-[#00A3FF] text-white'
                    : isDarkStudio
                    ? 'bg-white/[0.06] hover:bg-white/[0.16] text-slate-200 border border-white/[0.08]'
                    : 'bg-slate-100/90 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                }`}
                title="Live Whiteboard"
              >
                <PenTool className="h-4 w-4" strokeWidth={1.9} />
              </button>

              {/* Participants & Chat (Right before 3 dots) */}
              <button
                onClick={() => setShowSidebar((v) => !v)}
                className="flex flex-col items-center gap-0.5 sm:block cursor-pointer group"
                title="Participants & Chat"
              >
                <span
                  className={`relative h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-active:scale-95 ${
                    showSidebar
                      ? 'bg-gradient-to-br from-[#0066FF] to-[#00A3FF] text-white shadow-[0_4px_14px_rgba(0,102,255,0.45)]'
                      : isDarkStudio
                      ? 'bg-white/[0.08] sm:bg-white/[0.06] group-hover:bg-white/[0.16] text-slate-200 border border-white/[0.1]'
                      : 'bg-slate-100/90 group-hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  <Users className="h-4 w-4" strokeWidth={1.9} />
                  <span
                    className={`absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center ring-2 bg-[#0066FF] text-white ${
                      isDarkStudio ? 'ring-[#060c1a]' : 'ring-white'
                    }`}
                  >
                    {participants.length}
                  </span>
                </span>
                <span className={`sm:hidden text-[9.5px] font-semibold ${isDarkStudio ? 'text-slate-300' : 'text-slate-600'}`}>
                  People
                </span>
              </button>

              {/* More (...) */}
              <div className="relative">
                <button
                  onClick={() => setShowMoreMenu((v) => !v)}
                  className="flex flex-col items-center gap-0.5 sm:block cursor-pointer group"
                  title="More Studio Tools"
                >
                  <span
                    className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-active:scale-95 ${
                      showMoreMenu
                        ? 'bg-gradient-to-br from-[#0066FF] to-[#00A3FF] text-white'
                        : isDarkStudio
                        ? 'bg-white/[0.08] sm:bg-white/[0.06] group-hover:bg-white/[0.16] text-slate-200 border border-white/[0.1]'
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
                      className={`fixed inset-x-0 bottom-0 sm:inset-auto sm:absolute sm:bottom-14 sm:right-0 z-50 w-full sm:w-60 rounded-t-3xl sm:rounded-2xl p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-2 shadow-2xl border-t sm:border space-y-1.5 sm:space-y-1 ${
                        isDarkStudio
                          ? 'bg-[#091224]/98 sm:bg-[#0e1628] border-white/15 text-slate-100'
                          : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="sm:hidden flex flex-col items-center pb-2 mb-1 border-b border-white/10">
                        <div className="w-10 h-1 rounded-full bg-white/25 mb-2.5" />
                        <div className="w-full flex items-center justify-between px-1">
                          <span className="text-sm font-extrabold">Meeting Menu</span>
                          <button
                            onClick={() => setShowMoreMenu(false)}
                            className="h-7 w-7 rounded-full flex items-center justify-center bg-white/10 text-slate-300"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div
                        className={`flex items-center justify-between gap-1 px-2 py-1.5 rounded-xl border mb-1 ${
                          isDarkStudio ? 'bg-white/[0.04] border-white/10' : 'bg-slate-50 border-slate-200/80'
                        }`}
                      >
                        {['👍', '👏', '❤️', '😂', '🎉', '🔥'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              sendReaction(emoji);
                              setShowMoreMenu(false);
                            }}
                            className="h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-base cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => {
                          onToggleScreenShare();
                          setShowMoreMenu(false);
                        }}
                        className="sm:hidden w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-[#3B82F6]/15 text-xs font-semibold cursor-pointer"
                      >
                        <Monitor className="h-4 w-4 text-[#00A3FF]" />
                        <span>{isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}</span>
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
                          setCaptionsEnabled((v) => !v);
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-3 sm:gap-2.5 px-3.5 py-2.5 sm:px-3 sm:py-2 rounded-xl bg-white/[0.04] sm:bg-transparent hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
                      >
                        <Subtitles className={`h-4 w-4 ${captionsEnabled ? 'text-emerald-400' : 'text-sky-400'}`} />
                        <span>{captionsEnabled ? 'Stop Live Captions (CC)' : 'Live Captions (CC)'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsHandRaised((v) => !v);
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

                      <button
                        onClick={() => {
                          handleCopyFormattedInvite();
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-3 sm:gap-2.5 px-3.5 py-2.5 sm:px-3 sm:py-2 rounded-xl bg-white/[0.04] sm:bg-transparent hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
                      >
                        <Share2 className="h-4 w-4 text-[#FF7A00]" />
                        <span>Copy Full Invite</span>
                      </button>

                      {isHost && (
                        <button
                          onClick={() => {
                            handleExportAttendanceCSV();
                            setShowMoreMenu(false);
                          }}
                          className="w-full flex items-center gap-3 sm:gap-2.5 px-3.5 py-2.5 sm:px-3 sm:py-2 rounded-xl bg-white/[0.04] sm:bg-transparent hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
                        >
                          <Download className="h-4 w-4 text-emerald-400" />
                          <span>Export Attendance (CSV)</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          void togglePiP();
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-3 sm:gap-2.5 px-3.5 py-2.5 sm:px-3 sm:py-2 rounded-xl bg-white/[0.04] sm:bg-transparent hover:bg-[#3B82F6]/10 text-xs font-semibold cursor-pointer"
                      >
                        <PictureInPicture2 className="h-4 w-4 text-slate-400" />
                        <span>Picture-in-Picture</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* COLLAPSIBLE PARTICIPANTS & CHAT PANEL (Native Bottom Sheet on Mobile, Right Sidebar on Desktop) */}
      <aside
        className={`${
          showSidebar
            ? 'fixed inset-x-0 bottom-0 top-14 rounded-t-3xl border-t lg:rounded-none lg:border-t-0 lg:border-l lg:inset-auto lg:relative lg:z-10 z-50 flex lg:w-[340px] xl:w-[360px]'
            : 'hidden'
        } lg:h-full flex-col shrink-0 backdrop-blur-2xl transition-all duration-300 ${
          isDarkStudio
            ? 'bg-[#081020]/98 lg:bg-[#081020]/95 border-[#0066FF]/25 text-slate-100 shadow-2xl shadow-black/60'
            : 'bg-white/98 lg:bg-white/95 border-slate-200/80 text-slate-900'
        }`}
      >
        <div className="lg:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/25" />
        </div>

        {/* Participants List */}
        <div className="flex flex-col max-h-[44%] border-b border-slate-500/15">
          <div className="px-5 pt-4 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight">Participants</h2>
              <span className="px-2 py-0.5 rounded-full bg-[#3B82F6] text-white text-[10px] font-bold">
                {participants.length}
              </span>
            </div>
            <button
              onClick={() => setShowSidebar(false)}
              className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-slate-500/15 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2">
            {participants.map((p) => (
              <div
                key={p.id}
                className={`px-3 py-2.5 rounded-2xl flex items-center justify-between gap-2 ${
                  isDarkStudio ? 'bg-white/[0.04]' : 'bg-slate-100/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#0066FF] to-[#00A3FF] text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">
                      {p.name} {p.isLocal ? '(You)' : ''}
                    </p>
                    {p.isHost && (
                      <span className="text-[9.5px] font-bold text-amber-400 uppercase">Host</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {p.isMicOn ? (
                    <Mic className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <MicOff className="h-3.5 w-3.5 text-rose-400" />
                  )}
                  {p.isCamOn ? (
                    <Video className="h-3.5 w-3.5 text-cyan-400" />
                  ) : (
                    <VideoOff className="h-3.5 w-3.5 text-slate-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Chat */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <h2 className="text-base font-extrabold tracking-tight">Chat</h2>
            <button
              onClick={() => setShowChatAndNotes(true)}
              className="text-[11px] font-bold text-[#388BFF] hover:underline cursor-pointer"
            >
              Notepad &amp; Full
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2.5">
            {chatMessages.map((msg) => (
              <div key={msg.id} className="space-y-0.5">
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="font-bold text-slate-200">{msg.isLocal ? 'You' : msg.sender}</span>
                  <span>{msg.timestamp}</span>
                </div>
                <div
                  className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    msg.isLocal
                      ? 'bg-[#0066FF]/20 border border-[#0066FF]/35 text-white'
                      : isDarkStudio
                      ? 'bg-white/[0.05] text-slate-200'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleChatSubmit} className="p-3 border-t border-slate-500/15 flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className={`flex-1 rounded-xl px-3 py-2 text-xs outline-none border ${
                isDarkStudio
                  ? 'bg-white/[0.06] border-white/10 text-white placeholder:text-slate-500 focus:border-[#00A3FF]'
                  : 'bg-slate-100 border-slate-200 text-slate-900'
              }`}
            />
            <button
              type="submit"
              className="h-9 w-9 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00A3FF] text-white flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </aside>

      {/* AUDIO & VEDIO QUALITY MODAL (Identical Pinned Header/Footer Design) */}
      {showQualityModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setShowQualityModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full sm:max-w-[430px] max-h-[90dvh] sm:max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden border-t sm:border shadow-2xl backdrop-blur-2xl ${
              isDarkStudio ? 'bg-[#070f20]/96 border-white/15 text-white' : 'bg-white/98 border-slate-200 text-slate-900'
            }`}
          >
            <div className="h-[3px] w-full shrink-0 bg-gradient-to-r from-[#0066FF] via-[#00A3FF] to-[#FF7A00]" />
            <div className="shrink-0 px-5 pt-3.5 pb-3 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#00A3FF] text-white flex items-center justify-center">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-[15px] font-extrabold">Audio &amp; Vedio Quality</h3>
                  <p className="text-[11px] text-slate-400">
                    {activeVedioCfg.short} {activeVedioCfg.label} · Vol {speakerVolume}%
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQualityModal(false)}
                className="h-8 w-8 rounded-full bg-white/[0.06] text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3.5 space-y-3">
              <div className="rounded-2xl p-3.5 border border-white/10 bg-white/[0.03] space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-extrabold">Vedio Resolution</p>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const prev = VEDIO_LEVELS[Math.max(0, activeVedioIdx - 1)];
                        setVedioQuality(prev.id);
                        onQualityChange?.(prev.id);
                      }}
                      className="h-7 w-7 rounded-full bg-white/[0.07] border border-white/12 flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        const next = VEDIO_LEVELS[Math.min(VEDIO_LEVELS.length - 1, activeVedioIdx + 1)];
                        setVedioQuality(next.id);
                        onQualityChange?.(next.id);
                      }}
                      className="h-7 w-7 rounded-full bg-white/[0.07] border border-white/12 flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-black/35 border border-white/[0.07]">
                  {VEDIO_LEVELS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setVedioQuality(item.id);
                        onQualityChange?.(item.id);
                        toast.success(`Vedio quality set to ${item.label} (${item.short})`);
                      }}
                      className={`py-2 px-1 rounded-lg text-center cursor-pointer ${
                        vedioQuality === item.id
                          ? 'bg-gradient-to-br from-[#0066FF] to-[#0099FF] text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="text-[11px] font-extrabold font-mono">{item.short}</div>
                      <div className="text-[9px] font-semibold mt-0.5 truncate">{item.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-3.5 border border-white/10 bg-white/[0.03] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold flex items-center gap-2">
                    {speakerVolume === 0 ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
                    Speaker Volume &amp; Boost
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#FF7A00]/20 text-[#FFA033] font-mono text-[10.5px] font-extrabold">
                    {speakerVolume}%
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
              </div>
            </div>
            <div className="shrink-0 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 border-t border-white/[0.08]">
              <button
                onClick={() => setShowQualityModal(false)}
                className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#0066FF] to-[#00A3FF] text-white text-xs font-extrabold cursor-pointer"
              >
                Apply &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HOST EXIT MODAL */}
      {showHostExitModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowHostExitModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#091224] border border-white/15 p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-extrabold text-white">End or Leave Meeting?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Choose <strong className="text-white">Leave Only</strong> to keep the room open, or{' '}
              <strong className="text-white">End Meeting for Everyone</strong>.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setShowHostExitModal(false);
                  onLeave();
                }}
                className="w-full py-2.5 rounded-2xl bg-[#0066FF] text-white text-xs font-bold cursor-pointer"
              >
                Leave Only (Rejoin Later as Host)
              </button>
              <button
                onClick={async () => {
                  setShowHostExitModal(false);
                  if (onEndMeeting) await onEndMeeting();
                }}
                className="w-full py-2.5 rounded-2xl bg-[#FF5B37] text-white text-xs font-bold cursor-pointer"
              >
                End Meeting for Everyone
              </button>
              <button
                onClick={() => setShowHostExitModal(false)}
                className="w-full py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Whiteboard & Notepad */}
      <WhiteboardCanvas
        isOpen={showWhiteboard}
        onClose={() => setShowWhiteboard(false)}
        meetingTitle={meetingTitle}
        authorName={displayName}
        elements={wbElements}
        onAddElement={(el) => {
          setWbElements((prev) => [...prev, el]);
          setWbRedoStack([]);
        }}
        onUndo={() => {
          setWbElements((prev) => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            setWbRedoStack((r) => [...r, last]);
            return prev.slice(0, -1);
          });
        }}
        onRedo={() => {
          setWbRedoStack((prev) => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            setWbElements((els) => [...els, last]);
            return prev.slice(0, -1);
          });
        }}
        canUndo={wbElements.length > 0}
        canRedo={wbRedoStack.length > 0}
        onClear={() => {
          setWbElements([]);
          setWbRedoStack([]);
        }}
      />

      <ChatAndNotesDrawer
        isOpen={showChatAndNotes}
        onClose={() => setShowChatAndNotes(false)}
        meetingId={meetingId}
        meetingTitle={meetingTitle}
        localUserName={displayName}
        messages={chatMessages}
        onSendMessage={(text) => {
          if (onSendMessage) onSendMessage(text);
          else {
            setLocalMessages((prev) => [
              ...prev,
              {
                id: `${Date.now()}`,
                sender: displayName,
                isLocal: true,
                text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
          }
        }}
        participants={participants.map((p) => ({
          id: p.id,
          name: p.name,
          isLocal: p.isLocal,
        }))}
      />
    </div>
  );
}
