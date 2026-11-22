'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import {
  UnifiedStudioShell,
  StudioParticipantItem,
  StudioTile,
} from './unified-studio-shell';
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

  // Keep meeting session alive on server so shared links stay active for all joining guests
  const remoteCountRef = useRef(remoteUsers.length);
  useEffect(() => {
    remoteCountRef.current = remoteUsers.length;
  }, [remoteUsers.length]);

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

  // Automatic Agora usage telemetry for Admin Panel:
  // Pauses when Host is alone and on another tab/page; resumes automatically on return or when 2+ participants join
  useEffect(() => {
    if (!isHost) return;
    const sendUsage = (deltaSeconds: number) => {
      const count = 1 + remoteCountRef.current;
      const isTabHidden = typeof document !== 'undefined' && document.visibilityState !== 'visible';
      if (deltaSeconds > 0 && count <= 1 && isTabHidden) return;
      fetch('/api/usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId,
          meetingTitle,
          provider: 'agora',
          participantCount: count,
          deltaSeconds,
        }),
      }).catch(() => {});
    };
    sendUsage(0);
    const id = setInterval(() => sendUsage(10), 10000);
    return () => clearInterval(id);
  }, [isHost, meetingId, meetingTitle]);

  useEffect(() => {
    let mounted = true;

    const initAgora = async () => {
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        AgoraRTC.setLogLevel(3);

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

        if (mounted) setIsConnected(true);
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
      } catch {}
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
      } catch {}
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

  const handleQualityChange = async (preset: 'low' | 'medium' | 'hd' | 'fhd') => {
    const cam = camTrackRef.current;
    if (!cam) return;
    const map = {
      low: '360p_1',
      medium: '480p_1',
      hd: '720p_1',
      fhd: '1080p_1',
    } as const;
    try {
      await cam.setEncoderConfiguration(map[preset]);
    } catch {}
  };

  const handleLeave = async () => {
    try {
      await clientRef.current?.leave();
    } catch {}
    onLeave();
  };

  const handleEnd = async () => {
    try {
      await clientRef.current?.leave();
    } catch {}
    if (onEndMeeting) await onEndMeeting();
  };

  const tiles: StudioTile[] = useMemo(() => {
    const list: StudioTile[] = [
      {
        key: 'local-primary',
        id: String(uid),
        name: displayName,
        isLocal: true,
        isHost,
        isMicOn: micOn,
        isScreenShare: screenOn,
        hasVideo: Boolean((screenOn && localScreenTrack) || (camOn && localCamTrack)),
        renderVideo: (mirrored) =>
          screenOn && localScreenTrack ? (
            <AgoraVideoPlayer videoTrack={localScreenTrack} />
          ) : (
            <AgoraVideoPlayer videoTrack={localCamTrack!} mirror={mirrored} />
          ),
      },
      ...remoteUsers.map((user) => ({
        key: `remote-${user.uid}`,
        id: String(user.uid),
        name: `Participant #${String(user.uid).slice(-3)}`,
        isLocal: false,
        isMicOn: user.hasAudio,
        hasVideo: Boolean(user.hasVideo && user.videoTrack),
        renderVideo: () => <AgoraVideoPlayer videoTrack={user.videoTrack} />,
      })),
    ];
    return list;
  }, [uid, displayName, isHost, micOn, camOn, screenOn, localCamTrack, localScreenTrack, remoteUsers]);

  const participants: StudioParticipantItem[] = useMemo(
    () => [
      {
        id: String(uid),
        name: displayName,
        isLocal: true,
        isHost,
        isMicOn: micOn,
        isCamOn: camOn,
      },
      ...remoteUsers.map((u) => ({
        id: String(u.uid),
        name: `Participant #${String(u.uid).slice(-3)}`,
        isLocal: false,
        isMicOn: u.hasAudio,
        isCamOn: u.hasVideo,
      })),
    ],
    [uid, displayName, isHost, micOn, camOn, remoteUsers]
  );

  return (
    <UnifiedStudioShell
      meetingId={meetingId}
      meetingTitle={meetingTitle}
      isHost={isHost}
      displayName={displayName}
      tiles={tiles}
      participants={participants}
      isMicOn={micOn}
      isCamOn={camOn}
      isScreenSharing={screenOn}
      onToggleMic={() => void toggleMic()}
      onToggleCam={() => void toggleCam()}
      onToggleScreenShare={() => void toggleScreenShare()}
      onLeave={() => void handleLeave()}
      onEndMeeting={onEndMeeting ? handleEnd : undefined}
      onQualityChange={(p) => void handleQualityChange(p)}
      isConnecting={!isConnected}
      connectError={connectError}
    />
  );
}
