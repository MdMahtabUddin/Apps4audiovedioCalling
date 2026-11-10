'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole, Participant, MeetingSettingsItem } from '@/types';

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
  participants: Participant[];
  settings: MeetingSettingsItem;
  joinRoom: (displayName: string, password?: string) => Promise<{ success: boolean; error?: string }>;
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
  const [title, setTitle] = useState('Meeting');
  const [hostId, setHostId] = useState('');
  const [hostName, setHostName] = useState('Host');
  const [isHost, setIsHost] = useState(false);
  const [myRole, setMyRole] = useState<UserRole>('PARTICIPANT');
  const [isLocked, setIsLocked] = useState(false);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [settings, setSettings] = useState<MeetingSettingsItem>(defaultSettings);

  const joinRoom = useCallback(
    async (displayName: string, password?: string) => {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName, password }),
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
        if (data.meeting.settings) setSettings(data.meeting.settings);

        if (data.status === 'WAITING_ROOM') {
          setIsWaitingApproval(true);
          setIsJoined(false);
        } else {
          setIsWaitingApproval(false);
          setIsJoined(true);
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

  const leaveRoom = useCallback(() => {
    setIsJoined(false);
    setIsWaitingApproval(false);
    router.push('/dashboard');
  }, [router]);

  const endRoom = useCallback(async () => {
    try {
      await fetch(`/api/meetings/${meetingId}/end`, { method: 'POST' });
      setIsJoined(false);
      router.push('/dashboard');
    } catch (e) {
      console.error('Failed to end meeting:', e);
      router.push('/dashboard');
    }
  }, [meetingId, router]);

  const toggleLock = useCallback(async () => {
    // Toggles room lock for host
    setIsLocked((prev) => !prev);
  }, []);

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
