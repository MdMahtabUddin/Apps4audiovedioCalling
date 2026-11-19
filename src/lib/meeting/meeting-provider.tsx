'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole, Participant, MeetingSettingsItem } from '@/types';
import { soundEngine } from '@/lib/audio/sound-engine';
import { useToast } from '@/components/ui/toast';

export interface MeetingContextType {
  meetingId: string;
  title: string;
  hostId: string;
  hostName: string;
  isHost: boolean;
  myRole: UserRole;
  isLocked: boolean;
  waitingRoom: boolean;
  isWaitingApproval: boolean;
  isJoined: boolean;
  myDisplayName: string;
  myParticipantId: string | null;
  participants: Participant[];
  settings: MeetingSettingsItem;
  joinRoom: (displayName: string, password?: string, isHostCandidate?: boolean) => Promise<{ success: boolean; error?: string }>;
  leaveRoom: () => void;
  endRoom: () => Promise<void>;
  toggleLock: () => Promise<void>;
}

const defaultSettings: MeetingSettingsItem = {
  allowChat: true,
  allowScreenShare: true,
  muteOnEntry: false,
  allowReactions: true,
};

const MeetingContext = createContext<MeetingContextType | null>(null);

export function MeetingProvider({
  meetingId,
  children,
}: {
  meetingId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('Meeting');
  const [hostId, setHostId] = useState('');
  const [hostName, setHostName] = useState('Host');
  const [isHost, setIsHost] = useState(false);
  const [myRole, setMyRole] = useState<UserRole>('PARTICIPANT');
  const [isLocked, setIsLocked] = useState(false);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [myDisplayName, setMyDisplayName] = useState('');
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [settings, setSettings] = useState<MeetingSettingsItem>(defaultSettings);

  const sessionRef = useRef<{ participantId: string | null; isHost: boolean; isJoined: boolean }>({
    participantId: null,
    isHost: false,
    isJoined: false,
  });

  useEffect(() => {
    sessionRef.current = { participantId: myParticipantId, isHost, isJoined };
  }, [myParticipantId, isHost, isJoined]);

  const joinRoom = useCallback(
    async (displayName: string, password?: string, isHostCandidate?: boolean) => {
      try {
        setMyDisplayName(displayName);
        const res = await fetch(`/api/meetings/${meetingId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName, password, isHostCandidate }),
        });

        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error || 'Failed to join meeting' };
        }

        setTitle(data.meeting.title);
        setHostId(data.meeting.hostId);
        setHostName(data.meeting.hostName);
        setIsHost(data.participant.isHost);
        setMyRole(data.participant.role);
        setIsLocked(data.meeting.isLocked);
        setWaitingRoom(data.meeting.waitingRoom);
        if (data.participant?.id) setMyParticipantId(data.participant.id);
        if (data.meeting.settings) setSettings(data.meeting.settings);

        if (data.status === 'WAITING_ROOM') {
          setIsWaitingApproval(true);
          setIsJoined(false);
          soundEngine.startCallingRingtone();
        } else {
          setIsWaitingApproval(false);
          setIsJoined(true);
          soundEngine.stopCallingRingtone();
        }

        return { success: true };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Network error joining room',
        };
      }
    },
    [meetingId]
  );

  // Polling for admission while in Waiting Room
  useEffect(() => {
    if (!isWaitingApproval || !myParticipantId) return;

    soundEngine.startCallingRingtone();

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/knocks?participantId=${myParticipantId}`);
        if (!res.ok) return;

        const data = await res.json();
        if (data.status === 'APPROVED') {
          clearInterval(interval);
          soundEngine.stopCallingRingtone();
          soundEngine.playAdmittedChime();
          setIsWaitingApproval(false);
          setIsJoined(true);
          toast.success('The host admitted you to the meeting!');
        } else if (data.status === 'DENIED') {
          clearInterval(interval);
          soundEngine.stopCallingRingtone();
          setIsWaitingApproval(false);
          setIsJoined(false);
          toast.error('The host declined your request to join.');
          router.push('/');
        }
      } catch (e) {
        console.warn('Knock check polling note:', e);
      }
    }, 1500);

    return () => {
      clearInterval(interval);
      soundEngine.stopCallingRingtone();
    };
  }, [isWaitingApproval, myParticipantId, meetingId, toast, router]);

  const sendLeave = useCallback(() => {
    const partId = sessionRef.current.participantId || myParticipantId;
    if (!partId || typeof window === 'undefined') return;
    const url = `/api/meetings/${meetingId}/leave`;
    const body = JSON.stringify({
      participantId: partId,
      isHost: sessionRef.current.isHost,
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      } else {
        fetch(url, { method: 'POST', body, keepalive: true }).catch(() => {});
      }
    } catch {}
  }, [meetingId, myParticipantId]);

  // Periodic heartbeat while active + record leave on tab close or client navigation
  useEffect(() => {
    if (!isJoined || !myParticipantId) return;

    // Send heartbeat every 25 seconds to track real presence
    const interval = setInterval(() => {
      fetch(`/api/meetings/${meetingId}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: myParticipantId }),
      }).catch(() => {});
    }, 25000);

    const onLeaveWindow = () => sendLeave();
    window.addEventListener('pagehide', onLeaveWindow);
    window.addEventListener('beforeunload', onLeaveWindow);

    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', onLeaveWindow);
      window.removeEventListener('beforeunload', onLeaveWindow);
      // Unmount cleanup on client-side route navigation
      sendLeave();
    };
  }, [isJoined, myParticipantId, meetingId, sendLeave]);

  const leaveRoom = useCallback(() => {
    soundEngine.stopCallingRingtone();
    sendLeave();
    setIsJoined(false);
    setIsWaitingApproval(false);
    router.push('/dashboard');
  }, [router, sendLeave]);

  const endRoom = useCallback(async () => {
    try {
      soundEngine.stopCallingRingtone();
      await fetch(`/api/meetings/${meetingId}/end`, { method: 'POST' });
      setIsJoined(false);
      router.push('/dashboard');
    } catch (e) {
      console.error('Failed to end meeting:', e);
      router.push('/dashboard');
    }
  }, [meetingId, router]);

  const toggleLock = useCallback(async () => {
    const next = !isLocked;
    setIsLocked(next);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: next }),
      });
      if (!res.ok) setIsLocked(!next);
    } catch {
      setIsLocked(!next);
    }
  }, [isLocked, meetingId]);

  return (
    <MeetingContext.Provider
      value={{
        meetingId,
        title,
        hostId,
        hostName,
        isHost,
        myRole,
        isLocked,
        waitingRoom,
        isWaitingApproval,
        isJoined,
        myDisplayName,
        myParticipantId,
        participants,
        settings,
        joinRoom,
        leaveRoom,
        endRoom,
        toggleLock,
      }}
    >
      {children}
    </MeetingContext.Provider>
  );
}

export function useMeeting() {
  const context = useContext(MeetingContext);
  if (!context) {
    throw new Error('useMeeting must be used within a MeetingProvider');
  }
  return context;
}
