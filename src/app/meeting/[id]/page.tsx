'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Video, AlertCircle, ArrowLeft, Lock, Calendar, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MeetingProvider, useMeeting } from '@/lib/meeting/meeting-provider';
import { VideoProvider } from '@/lib/webrtc/video-provider';
import { PreJoinScreen } from '@/components/meeting/pre-join-screen';
import { WaitingRoomScreen } from '@/components/meeting/waiting-room-screen';
import { MeetingRoomView } from '@/components/meeting/meeting-room-view';
import { LiveKitMeetingStage } from '@/components/meeting/livekit-meeting-stage';
import { DailyBackupStage } from '@/components/meeting/daily-backup-stage';
import { MeetingValidationResponse, UserProfile } from '@/types';
import { generateMeetingId } from '@/lib/utils';

function MeetingContainer({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [meetingInfo, setMeetingInfo] = useState<MeetingValidationResponse | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [livekitData, setLivekitData] = useState<{ token: string; wsUrl: string } | null>(null);
  const [livekitFailed, setLivekitFailed] = useState(false);
  const [dailyBackupData, setDailyBackupData] = useState<{
    roomUrl: string;
    token?: string | null;
  } | null>(null);
  const [dailyBackupChecked, setDailyBackupChecked] = useState(false);

  const { isJoined, isWaitingApproval, leaveRoom, endRoom, myDisplayName } = useMeeting();

  // Primary Provider: LiveKit Cloud (100% untouched default flow)
  useEffect(() => {
    if (!isJoined) return;
    const nameToUse = myDisplayName || currentUser?.name || 'Participant';
    fetch(`/api/livekit/token?room=${encodeURIComponent(meetingId)}&username=${encodeURIComponent(nameToUse)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.isConfigured && data?.token && data?.wsUrl) {
          setLivekitData({ token: data.token, wsUrl: data.wsUrl });
        } else {
          setLivekitFailed(true);
        }
      })
      .catch((e) => {
        console.warn('LiveKit token fetch note:', e);
        setLivekitFailed(true);
      });
  }, [isJoined, meetingId, myDisplayName, currentUser?.name]);

  // Backup Provider Failover: Daily.co (ONLY runs if LiveKit fails / quota exhausted)
  useEffect(() => {
    if (!isJoined || !livekitFailed) return;
    const nameToUse = myDisplayName || currentUser?.name || 'Participant';
    const isHostFlag =
      (currentUser?.id && meetingInfo?.hostId && currentUser.id === meetingInfo.hostId) ||
      (typeof window !== 'undefined' && localStorage.getItem(`metromeet_host_${meetingId}`) === 'true');

    fetch(
      `/api/backup/daily/room?room=${encodeURIComponent(meetingId)}&username=${encodeURIComponent(
        nameToUse
      )}&host=${isHostFlag ? 'true' : 'false'}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.isConfigured && data?.roomUrl) {
          setDailyBackupData({ roomUrl: data.roomUrl, token: data.token || null });
        }
      })
      .catch((e) => {
        console.warn('Daily backup check note:', e);
      })
      .finally(() => {
        setDailyBackupChecked(true);
      });
  }, [isJoined, livekitFailed, meetingId, myDisplayName, currentUser?.name, currentUser?.id, meetingInfo?.hostId]);

  useEffect(() => {
    // 1. Fetch current user if logged in
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch(() => {});

    // 2. Validate meeting existence and access
    fetch(`/api/meetings/${meetingId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Meeting not found or invalid.');
        }
        setMeetingInfo(data);
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load meeting');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [meetingId]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#06080e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 animate-ping absolute inset-0" />
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center relative z-10 shadow-xl shadow-indigo-600/50">
              <Video className="h-6 w-6 text-white animate-pulse" />
            </div>
          </div>
          <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase">Entering Meeting Room...</p>
        </div>
      </div>
    );
  }

  // Error States (Not Found, Locked, Ended)
  if (fetchError || !meetingInfo) {
    return (
      <div className="h-screen w-screen bg-[#06080e] text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-3xl bg-[#0c101c] border border-white/[0.08] shadow-2xl text-center space-y-6">
          <div className="h-16 w-16 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/15">
            <AlertCircle className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Meeting Unavailable</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              {fetchError || 'The meeting code you entered is invalid or the meeting has concluded.'}
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <Button
              className="w-full text-xs font-bold shadow-lg shadow-indigo-600/30"
              onClick={() => {
                const newId = generateMeetingId();
                router.push(`/meeting/${newId}`);
              }}
            >
              <Video className="h-4 w-4 mr-1.5" />
              Start New Instant Meeting
            </Button>

            <Link href="/" className="block w-full">
              <Button variant="secondary" className="w-full text-xs font-bold">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Return to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // If waiting room approval is active
  if (isWaitingApproval) {
    return (
      <WaitingRoomScreen
        meetingTitle={meetingInfo.title}
        hostName={meetingInfo.hostName}
        onLeave={leaveRoom}
      />
    );
  }

  // If already joined, show LiveKit stage if configured, or WebRTC view
  if (isJoined) {
    if (!livekitData && !livekitFailed) {
      return (
        <div className="h-screen w-screen bg-[#06080e] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-2xl bg-[#0066FF]/30 border border-[#0066FF]/40 animate-ping absolute inset-0" />
              <div className="h-12 w-12 rounded-2xl bg-[#0066FF] flex items-center justify-center relative z-10 shadow-xl shadow-[#0066FF]/50">
                <Video className="h-6 w-6 text-white animate-pulse" />
              </div>
            </div>
            <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase">Connecting to media stage...</p>
          </div>
        </div>
      );
    }

    const isMeetingHost =
      (currentUser?.id && currentUser.id === meetingInfo.hostId) ||
      (typeof window !== 'undefined' && localStorage.getItem(`metromeet_host_${meetingId}`) === 'true');

    if (livekitData?.token && livekitData?.wsUrl && !livekitFailed) {
      return (
        <LiveKitMeetingStage
          meetingId={meetingId}
          meetingTitle={meetingInfo.title}
          isHost={isMeetingHost}
          token={livekitData.token}
          serverUrl={livekitData.wsUrl}
          displayName={myDisplayName || currentUser?.name || 'Participant'}
          onLeave={leaveRoom}
          onEndMeeting={endRoom}
          onFallback={() => setLivekitFailed(true)}
        />
      );
    }

    if (livekitFailed && !dailyBackupChecked) {
      return (
        <div className="h-screen w-screen bg-[#06080e] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-2xl bg-[#FF7A00]/30 border border-[#FF7A00]/40 animate-ping absolute inset-0" />
              <div className="h-12 w-12 rounded-2xl bg-[#FF7A00] flex items-center justify-center relative z-10 shadow-xl shadow-[#FF7A00]/40">
                <Video className="h-6 w-6 text-white animate-pulse" />
              </div>
            </div>
            <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase">
              Switching to Backup Cloud Infrastructure...
            </p>
          </div>
        </div>
      );
    }

    if (dailyBackupData?.roomUrl) {
      return (
        <DailyBackupStage
          meetingId={meetingId}
          meetingTitle={meetingInfo.title}
          isHost={isMeetingHost}
          roomUrl={dailyBackupData.roomUrl}
          token={dailyBackupData.token}
          displayName={myDisplayName || currentUser?.name || 'Participant'}
          onLeave={leaveRoom}
          onEndMeeting={endRoom}
        />
      );
    }

    return <MeetingRoomView />;
  }

  // Otherwise, show the pre-join lobby screen
  return (
    <PreJoinScreen
      meetingInfo={meetingInfo}
      initialName={currentUser?.name || ''}
      onJoinSuccess={() => {}}
    />
  );
}

export default function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const meetingId = resolvedParams.id;

  return (
    <MeetingProvider meetingId={meetingId}>
      <VideoProvider>
        <MeetingContainer meetingId={meetingId} />
      </VideoProvider>
    </MeetingProvider>
  );
}
