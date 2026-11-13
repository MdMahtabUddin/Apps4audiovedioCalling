'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useVideo } from '@/lib/webrtc/video-provider';
import { useToast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';

export interface SocketParticipant {
  socketId: string;
  userId: string;
  displayName: string;
  role: 'HOST' | 'CO_HOST' | 'PARTICIPANT' | string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isHandRaised?: boolean;
  handRaisedAt?: number | null;
  joinedAt: number;
}

export interface UseMeetingSocketProps {
  meetingId: string;
  userId?: string;
  displayName: string;
  role?: string;
  isJoined: boolean;
}

export function useMeetingSocket({
  meetingId,
  userId,
  displayName,
  role = 'PARTICIPANT',
  isJoined,
}: UseMeetingSocketProps) {
  const router = useRouter();
  const toast = useToast();
  const {
    connectToPeer,
    handlePeerOffer,
    handlePeerAnswer,
    handlePeerIceCandidate,
    registerIceCandidateHandler,
    disconnectPeer,
    toggleAudio,
    isAudioEnabled,
    isVideoEnabled,
  } = useVideo();

  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  >('disconnected');
  const [currentRole, setCurrentRole] = useState<string>(role);
  const [participants, setParticipants] = useState<SocketParticipant[]>([]);
  const [isRoomLocked, setIsRoomLocked] = useState<boolean>(false);
  const [isHandRaised, setIsHandRaised] = useState<boolean>(false);
  const [activeReaction, setActiveReaction] = useState<{ emoji: string; sender: string } | null>(null);

  // Sync role prop
  useEffect(() => {
    setCurrentRole(role);
  }, [role]);

  // Determine signaling gateway URL
  const getSignalingUrl = useCallback(() => {
    if (process.env.NEXT_PUBLIC_SIGNALING_URL) {
      return process.env.NEXT_PUBLIC_SIGNALING_URL;
    }
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//${hostname}:3001`;
      }
      return `${protocol}//${hostname}:3001`;
    }
    return 'http://localhost:3001';
  }, []);

  // Connect & Join Room
  useEffect(() => {
    if (!isJoined || !meetingId) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');
    const signalingUrl = getSignalingUrl();

    const socket = io(signalingUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      console.log(`[Socket] Connected to signaling gateway: ${socket.id}`);

      // Announce presence in meeting room
      socket.emit('join-room', {
        meetingId,
        userId: userId || `usr_${(socket.id || 'peer').slice(0, 5)}`,
        displayName: displayName || 'Participant',
        role: currentRole,
        isAudioEnabled,
        isVideoEnabled,
      });
    });

    socket.on('reconnect_attempt', () => {
      setConnectionStatus('reconnecting');
    });

    socket.on('reconnect', () => {
      setConnectionStatus('connected');
      toast.success('Reconnected to meeting');
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection note:', err.message);
    });

    // Room locked error upon joining
    socket.on('room-locked-error', ({ message }: { message: string }) => {
      toast.error(message || 'Meeting is locked by the host.');
      router.push('/dashboard');
    });

    // 1. Initial Room Users List
    socket.on(
      'room-users',
      async ({
        participants: existingPeers,
        isLocked,
      }: {
        participants: SocketParticipant[];
        isLocked?: boolean;
      }) => {
        console.log(`[Socket] Discovered ${existingPeers.length} existing peers in room:`, existingPeers);
        setParticipants(existingPeers);
        if (isLocked !== undefined) setIsRoomLocked(isLocked);

        // Create WebRTC Offer for each existing participant
        for (const peer of existingPeers) {
          try {
            const offer = await connectToPeer(peer.socketId);
            socket.emit('signal-offer', {
              targetSocketId: peer.socketId,
              offer,
            });
          } catch (err) {
            console.warn(`[Socket] Failed to initiate WebRTC offer to ${peer.socketId}:`, err);
          }
        }
      }
    );

    // 2. WebRTC SDP Offer Received
    socket.on('signal-offer', async ({ callerSocketId, callerInfo, offer }) => {
      try {
        console.log(`[Socket] Received SDP offer from ${callerSocketId}`);
        const answer = await handlePeerOffer(callerSocketId, offer);
        socket.emit('signal-answer', {
          targetSocketId: callerSocketId,
          answer,
        });

        if (callerInfo) {
          setParticipants((prev) => {
            if (prev.some((p) => p.socketId === callerSocketId)) return prev;
            return [...prev, callerInfo];
          });
        }
      } catch (err) {
        console.warn(`[Socket] Failed to handle SDP offer from ${callerSocketId}:`, err);
      }
    });

    // 3. WebRTC SDP Answer Received
    socket.on('signal-answer', async ({ responderSocketId, answer }) => {
      try {
        console.log(`[Socket] Received SDP answer from ${responderSocketId}`);
        await handlePeerAnswer(responderSocketId, answer);
      } catch (err) {
        console.warn(`[Socket] Failed to handle SDP answer from ${responderSocketId}:`, err);
      }
    });

    // 4. ICE Candidate Received
    socket.on('ice-candidate', async ({ fromSocketId, candidate }) => {
      try {
        await handlePeerIceCandidate(fromSocketId, candidate);
      } catch (err) {
        console.warn(`[Socket] Failed to add ICE candidate from ${fromSocketId}:`, err);
      }
    });

    // 5. Another Participant Joined Room
    socket.on('participant-joined', (participant: SocketParticipant) => {
      console.log(`[Socket] Participant joined: ${participant.displayName} (${participant.socketId})`);
      setParticipants((prev) => {
        if (prev.some((p) => p.socketId === participant.socketId)) return prev;
        return [...prev, participant];
      });
      toast.info(`${participant.displayName} joined the meeting`);
    });

    // 6. Participant Left Room
    socket.on('participant-left', ({ socketId, displayName }: { socketId: string; displayName?: string }) => {
      console.log(`[Socket] Participant left: ${socketId}`);
      disconnectPeer(socketId);
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
      if (displayName) {
        toast.info(`${displayName} left the meeting`);
      }
    });

    // 7. Participant Audio/Video State Changed
    socket.on('participant-media-changed', ({ socketId, isAudioEnabled: a, isVideoEnabled: v }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, isAudioEnabled: a, isVideoEnabled: v } : p))
      );
    });

    // 8. Live Reaction Received
    socket.on('reaction-received', ({ emoji, senderName }: { emoji: string; senderName: string }) => {
      setActiveReaction({ emoji, sender: senderName });
      setTimeout(() => setActiveReaction(null), 2500);
    });

    // 9. Host Concluded Meeting
    socket.on('meeting-ended', ({ reason }: { reason?: string }) => {
      toast.info(reason || 'The host has concluded this meeting.');
      router.push('/dashboard');
    });

    // 10. Hand Raise Updated (Phase 5)
    socket.on(
      'participant-hand-raised',
      ({
        socketId,
        displayName: peerName,
        isHandRaised: raised,
      }: {
        socketId: string;
        displayName: string;
        isHandRaised: boolean;
      }) => {
        if (socketId === socket.id) {
          setIsHandRaised(raised);
        } else {
          setParticipants((prev) =>
            prev.map((p) => (p.socketId === socketId ? { ...p, isHandRaised: raised } : p))
          );
          if (raised) {
            toast.info(`✋ ${peerName} raised their hand`);
          }
        }
      }
    );

    // 11. Force Mute by Host (Phase 5)
    socket.on('force-mute-audio', ({ mutedBy }: { mutedBy?: string }) => {
      if (isAudioEnabled) {
        toggleAudio();
      }
      toast.warning(`You were muted by ${mutedBy || 'the host'}.`);
    });

    // 12. Participant Kicked by Host (Phase 5)
    socket.on('participant-kicked', ({ reason }: { reason?: string }) => {
      toast.error(reason || 'You have been removed from the meeting.');
      router.push('/dashboard');
    });

    // 13. Role Updated (Phase 5)
    socket.on('role-updated', ({ role: updatedRole }: { role: string }) => {
      setCurrentRole(updatedRole);
      toast.success(`Your meeting role was updated to ${updatedRole}`);
    });

    // 14. Room Participant Role Changed (Phase 5)
    socket.on('participant-role-changed', ({ socketId, role: updatedRole }: { socketId: string; role: string }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, role: updatedRole } : p))
      );
    });

    // 15. Room Lock Changed (Phase 5)
    socket.on('room-lock-changed', ({ isLocked }: { isLocked: boolean }) => {
      setIsRoomLocked(isLocked);
      toast.info(isLocked ? '🔒 Meeting has been locked by the host.' : '🔓 Meeting has been unlocked.');
    });

    // Wire local ICE candidates to socket signaling
    registerIceCandidateHandler((targetPeerId, candidate) => {
      socket.emit('ice-candidate', {
        targetSocketId: targetPeerId,
        candidate,
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    isJoined,
    meetingId,
    userId,
    displayName,
    currentRole,
    connectToPeer,
    handlePeerOffer,
    handlePeerAnswer,
    handlePeerIceCandidate,
    registerIceCandidateHandler,
    disconnectPeer,
    getSignalingUrl,
    toggleAudio,
    isAudioEnabled,
    isVideoEnabled,
    toast,
    router,
  ]);

  // Sync local mic/camera toggles to other peers
  useEffect(() => {
    if (socketRef.current && isJoined) {
      socketRef.current.emit('media-state', {
        isAudioEnabled,
        isVideoEnabled,
      });
    }
  }, [isAudioEnabled, isVideoEnabled, isJoined]);

  // Public Actions
  const sendReaction = useCallback((emoji: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('send-reaction', { emoji });
    }
  }, []);

  const toggleHandRaise = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      const nextState = !isHandRaised;
      setIsHandRaised(nextState);
      socketRef.current.emit('toggle-hand-raise', { isHandRaised: nextState });
    }
  }, [isHandRaised]);

  const muteParticipant = useCallback((targetSocketId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('mute-participant', { targetSocketId });
    }
  }, []);

  const muteAll = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('mute-all');
      toast.info('All participants have been muted.');
    }
  }, [toast]);

  const kickParticipant = useCallback((targetSocketId: string, reason?: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('kick-participant', { targetSocketId, reason });
    }
  }, []);

  const assignRole = useCallback((targetSocketId: string, newRole: 'HOST' | 'CO_HOST' | 'PARTICIPANT' | string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('assign-role', { targetSocketId, newRole });
    }
  }, []);

  const toggleRoomLock = useCallback((locked: boolean) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('lock-meeting', { isLocked: locked });
    }
  }, []);

  const endMeetingForAll = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('end-meeting');
    }
  }, []);

  const getSocket = useCallback(() => socketRef.current, []);

  return {
    connectionStatus,
    participants,
    currentRole,
    isRoomLocked,
    isHandRaised,
    activeReaction,
    sendReaction,
    toggleHandRaise,
    muteParticipant,
    muteAll,
    kickParticipant,
    assignRole,
    toggleRoomLock,
    endMeetingForAll,
    getSocket,
  };
}
