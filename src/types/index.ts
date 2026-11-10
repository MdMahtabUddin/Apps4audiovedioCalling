export type UserRole = 'HOST' | 'CO_HOST' | 'PARTICIPANT';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingItem {
  id: string;
  title: string;
  hostId: string;
  hostName?: string;
  hostEmail?: string;
  password?: string | null;
  isLocked: boolean;
  waitingRoom: boolean;
  isActive: boolean;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number;
  participantCount?: number;
  createdAt: string;
}

export interface ScheduledMeetingItem {
  id: string;
  title: string;
  hostId: string;
  date: string;
  startTime: string;
  duration: number;
  timeZone: string;
  password?: string | null;
  waitingRoom: boolean;
  meetingId?: string | null;
  createdAt: string;
}

export interface MeetingMessageItem {
  id: string;
  meetingId: string;
  senderId?: string | null;
  senderName: string;
  content: string;
  isSystem: boolean;
  createdAt: string;
}

export interface MeetingSettingsItem {
  allowChat: boolean;
  allowScreenShare: boolean;
  muteOnEntry: boolean;
  allowReactions: boolean;
}

export interface Participant {
  id: string;
  userId?: string | null;
  name: string;
  role: UserRole;
  avatar?: string | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isApproved: boolean;
  isMutedByHost?: boolean;
  joinedAt: string;
}

export interface PreJoinSettings {
  displayName: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  selectedAudioInput?: string;
  selectedVideoInput?: string;
  selectedAudioOutput?: string;
}

export interface MeetingValidationResponse {
  exists: boolean;
  id: string;
  title: string;
  hostId: string;
  hostName: string;
  isHost: boolean;
  requiresPassword: boolean;
  isLocked: boolean;
  waitingRoom: boolean;
  isActive: boolean;
  error?: string;
}
