'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  ShieldCheck,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { useToast } from '@/components/ui/toast';
import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  ILocalVideoTrack,
  IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng';

interface AgoraBackupStageProps {
  meetingId: string;
  meetingTitle: string;
  isHost: boolean;
  appId: string;
  channel: string;
  uid: number;
  token: string | null;
  displayName: string;
  onLeave: () => void;
  onEndMeeting?: () => Promise<void>;
}

function AgoraVideoPlayer({
  videoTrack,
  mirror = false,
}: {
  videoTrack: ICameraVideoTrack | ILocalVideoTrack | IAgoraRTCRemoteUser['videoTrack'];
  mirror?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !videoTrack) return;
    videoTrack.play(el);
    return () => {
      try {
        videoTrack.stop();
      } catch {
        // ignore
      }
    };
  }, [videoTrack]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${mirror ? '[&_video]:scale-x-[-1]' : ''} [&_video]:object-cover`}
    />
  );
}

export function AgoraBackupStage({
  meetingId,
  meetingTitle,
  isHost,
  appId,
  channel,
  uid,
  token,
  displayName,
  onLeave,
  onEndMeeting,
}: AgoraBackupStageProps) {
  const toast = useToast();

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const micTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const camTrackRef = useRef<ICameraVideoTrack | null>(null);
  const screenTrackRef = useRef<ILocalVideoTrack | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);
  const [localCamTrack, setLocalCamTrack] = useState<ICameraVideoTrack | null>(null);
  const [localScreenTrack, setLocalScreenTrack] = useState<ILocalVideoTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCallDuration((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Keep meeting session alive on server so shared links stay active for all joining guests
  useEffect(() => {
    const sendHeartbeat = () => {
      fetch(`/api/meetings/${encodeURIComponent(meetingId)}/heartbeat`, {
        method: 'POST',
      }).catch(() => {});
    };
    sendHeartbeat();
    const hb = setInterval(sendHeartbeat, 25000);
    return () => clearInterval(hb);
  }, [meetingId]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  useEffect(() => {
    let mounted = true;

    const initAgora = async () => {
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        AgoraRTC.setLogLevel(3); // errors only

        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = client;

        const syncUsers = () => {
          if (!mounted) return;
          setRemoteUsers([...client.remoteUsers]);
        };

        client.on('user-published', async (user, mediaType) => {
          try {
            await client.subscribe(user, mediaType);
            if (mediaType === 'audio' && user.audioTrack) {
              user.audioTrack.play();
            }
            syncUsers();
          } catch (err) {
            console.warn('Agora subscribe notice:', err);
          }
        });

        client.on('user-unpublished', () => syncUsers());
        client.on('user-joined', () => syncUsers());
        client.on('user-left', () => syncUsers());

        await client.join(appId, channel, token || null, uid);
        if (!mounted) {
          await client.leave();
          return;
        }

        try {
          const [micTrack, camTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
            { AEC: true, ANS: true, AGC: true },
            { encoderConfig: '720p_1' }
          );
          if (!mounted) {
            micTrack.close();
            camTrack.close();
            return;
          }
          micTrackRef.current = micTrack;
          camTrackRef.current = camTrack;
          setLocalCamTrack(camTrack);
          await client.publish([micTrack, camTrack]);
        } catch (mediaErr) {
          console.warn('Agora media capture notice:', mediaErr);
          toast.info('Joined meeting room (camera/mic permission pending)');
          setCamOn(false);
          setMicOn(false);
        }

        if (mounted) {
          setIsConnected(true);
        }
      } catch (err) {
        console.error('Agora connection error:', err);
        if (mounted) {
          setConnectError(
            err instanceof Error ? err.message : 'Could not connect to the meeting room'
          );
        }
      }
    };

    void initAgora();

    return () => {
      mounted = false;
      try {
        micTrackRef.current?.stop();
        micTrackRef.current?.close();
        camTrackRef.current?.stop();
        camTrackRef.current?.close();
        screenTrackRef.current?.stop();
        screenTrackRef.current?.close();
        clientRef.current?.leave().catch(() => {});
      } catch {
        // ignore cleanup errors
      }
    };
  }, [appId, channel, token, uid, toast]);

  const toggleMic = async () => {
    const track = micTrackRef.current;
    if (!track) return;
    const next = !micOn;
    await track.setEnabled(next);
    setMicOn(next);
  };

  const toggleCam = async () => {
    const track = camTrackRef.current;
    if (!track) return;
    const next = !camOn;
    await track.setEnabled(next);
    setCamOn(next);
  };

  const toggleScreenShare = async () => {
    const client = clientRef.current;
    if (!client) return;

    if (screenOn && screenTrackRef.current) {
      try {
        await client.unpublish(screenTrackRef.current);
        screenTrackRef.current.stop();
        screenTrackRef.current.close();
        screenTrackRef.current = null;
        setLocalScreenTrack(null);
        setScreenOn(false);
        if (camTrackRef.current && camOn) {
          await client.publish(camTrackRef.current);
        }
      } catch {
        // ignore
      }
      return;
    }

    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      const screenResult = await AgoraRTC.createScreenVideoTrack({}, 'disable');
      const sTrack = Array.isArray(screenResult) ? screenResult[0] : screenResult;

      if (camTrackRef.current) {
        await client.unpublish(camTrackRef.current).catch(() => {});
      }
      await client.publish(sTrack);
      screenTrackRef.current = sTrack;
      setLocalScreenTrack(sTrack);
      setScreenOn(true);

      sTrack.on('track-ended', async () => {
        try {
          await client.unpublish(sTrack);
          sTrack.close();
        } catch {}
        screenTrackRef.current = null;
        setLocalScreenTrack(null);
        setScreenOn(false);
        if (camTrackRef.current && camOn) {
          await client.publish(camTrackRef.current).catch(() => {});
        }
      });
    } catch {
      toast.info('Screen share cancelled');
    }
  };

  const copyMeetingLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(`${window.location.origin}/meeting/${meetingId}`).catch(() => {});
    setIsCopied(true);
    toast.success('Meeting link copied!');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleExit = async () => {
    try {
      await clientRef.current?.leave();
    } catch {}
    if (isHost && onEndMeeting) {
      await onEndMeeting();
    } else {
      onLeave();
    }
  };

  const totalTiles = 1 + remoteUsers.length;
  const gridClass =
    totalTiles <= 1
      ? 'grid-cols-1 grid-rows-1'
      : totalTiles === 2
      ? 'grid-cols-1 sm:grid-cols-2 grid-rows-2 sm:grid-rows-1'
      : totalTiles <= 4
      ? 'grid-cols-2 grid-rows-2'
      : totalTiles <= 9
      ? 'grid-cols-2 sm:grid-cols-3 grid-rows-3'
      : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';

  return (
    <div className="h-screen w-screen bg-[#050a14] text-white flex flex-col overflow-hidden p-3 sm:p-4 gap-3 relative">
      {/* Frosted Studio Header Bar */}
      <header className="flex items-center justify-between gap-3 shrink-0 px-3 sm:px-4 py-2 rounded-2xl bg-[#071022]/80 backdrop-blur-2xl border border-white/[0.09] shadow-xl z-20">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <button
            onClick={onLeave}
            className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-white/[0.06] hover:bg-white/[0.14] text-slate-300 hover:text-white border border-white/10 cursor-pointer"
            title="Leave Meeting"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div className="hidden sm:flex items-center shrink-0">
            <BrandLogo size="sm" showTagline={false} href="" />
          </div>
          <div className="h-6 w-px bg-white/10 hidden sm:block shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xs sm:text-[15px] font-bold tracking-tight truncate text-white">
              {meetingTitle}
            </h1>
            <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
              <span className="inline-flex items-center gap-1.5 px-2 py-[2px] rounded-full text-[10px] font-semibold bg-[#0066FF]/15 text-[#60A5FA] border border-[#0066FF]/30">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00A3FF]" />
                <span>{isHost ? 'Host Meeting' : 'Live Meeting'}</span>
              </span>
              <button
                onClick={copyMeetingLink}
                className={`inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${
                  isCopied
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                    : 'bg-[#FF7A00]/15 hover:bg-[#FF7A00]/25 text-[#FFB366] border-[#FF7A00]/35'
                }`}
              >
                {isCopied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                <span>{isCopied ? 'Link Copied' : 'Share Link'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-xs font-bold text-slate-200 shrink-0">
          <Users className="h-3.5 w-3.5 text-cyan-400" />
          <span>{totalTiles}</span>
        </div>
      </header>

      {/* Main Video Gallery Stage */}
      <div className="flex-1 min-h-0 relative pb-16 sm:pb-14">
        {connectError ? (
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
        ) : !isConnected ? (
          <div className="h-full w-full rounded-2xl border border-white/10 bg-[#081020] flex flex-col items-center justify-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#0066FF]/20 border border-[#00A3FF]/40 flex items-center justify-center">
              <Video className="h-5 w-5 text-[#00A3FF] animate-pulse" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Connecting to meeting room...
            </p>
          </div>
        ) : (
          <div className={`w-full h-full grid ${gridClass} gap-2.5`}>
            {/* Local User Tile */}
            <div className="relative rounded-2xl overflow-hidden bg-[#0a1326] border border-white/10 shadow-xl">
              {screenOn && localScreenTrack ? (
                <AgoraVideoPlayer videoTrack={localScreenTrack} />
              ) : camOn && localCamTrack ? (
                <AgoraVideoPlayer videoTrack={localCamTrack} mirror={true} />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#131e36] to-[#0b1220]">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-[#0066FF] to-[#00A3FF] flex items-center justify-center text-xl font-black">
                    {displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs text-slate-300 font-semibold">{displayName} (You)</span>
                </div>
              )}

              {/* Monochrome Watermark + LIVE Timer */}
              <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1 pointer-events-none select-none">
                <div className="opacity-55 text-xs font-black italic text-white drop-shadow">
                  Metro Meet <span className="not-italic text-[8px] px-1.5 py-0.5 rounded-full bg-white/30">PRO</span>
                </div>
                <div className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded bg-black/45 border border-white/10 text-[8.5px] font-mono">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="font-bold tracking-wider">LIVE</span>
                  <span className="opacity-40">|</span>
                  <span>{formatDuration(callDuration)}</span>
                </div>
              </div>

              {/* Nameplate */}
              <div className="absolute bottom-3 left-3 z-10 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-xs font-semibold flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>{displayName} (You)</span>
                {isHost && (
                  <span className="px-1.5 py-[1px] rounded bg-amber-500/25 text-amber-300 text-[9px] font-extrabold">
                    HOST
                  </span>
                )}
              </div>
            </div>

            {/* Remote Participants Tiles */}
            {remoteUsers.map((user) => (
              <div
                key={String(user.uid)}
                className="relative rounded-2xl overflow-hidden bg-[#0a1326] border border-white/10 shadow-xl"
              >
                {user.hasVideo && user.videoTrack ? (
                  <AgoraVideoPlayer videoTrack={user.videoTrack} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#131e36] to-[#0b1220]">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-[#FF7A00] to-amber-500 flex items-center justify-center text-xl font-black">
                      P
                    </div>
                    <span className="text-xs text-slate-300 font-semibold">
                      Participant #{String(user.uid).slice(-3)}
                    </span>
                  </div>
                )}

                <div className="absolute bottom-3 left-3 z-10 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-xs font-semibold flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <span>Participant #{String(user.uid).slice(-3)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Compact Glassmorphic Bottom Control Dock */}
      <footer className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40">
        <div className="px-2.5 py-1.5 rounded-full bg-[#060c1a]/82 backdrop-blur-2xl border border-white/14 shadow-2xl flex items-center gap-1.5">
          <button
            onClick={toggleScreenShare}
            className={`h-9 w-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              screenOn
                ? 'bg-[#0066FF] text-white'
                : 'bg-white/[0.08] hover:bg-white/[0.16] text-slate-200 border border-white/10'
            }`}
            title="Share Screen"
          >
            <Monitor className="h-4 w-4" />
          </button>

          <button
            onClick={toggleMic}
            className={`h-9 w-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              micOn
                ? 'bg-white/[0.08] hover:bg-white/[0.16] text-white border border-white/10'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
            }`}
            title={micOn ? 'Mute Mic' : 'Unmute Mic'}
          >
            {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>

          <button
            onClick={toggleCam}
            className={`h-9 w-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              camOn
                ? 'bg-white/[0.08] hover:bg-white/[0.16] text-white border border-white/10'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
            }`}
            title={camOn ? 'Turn Off Vedio' : 'Turn On Vedio'}
          >
            {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </button>

          <div className="h-4 w-px bg-white/15 mx-1" />

          <button
            onClick={handleExit}
            className="h-9 px-4 rounded-full bg-gradient-to-r from-[#FF4D3A] to-[#E11D48] text-white font-semibold text-xs shadow-lg shadow-rose-600/35 flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            <span>{isHost ? 'End' : 'Leave'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
