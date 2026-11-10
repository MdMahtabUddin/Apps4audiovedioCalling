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
  role: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
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
    isAudioEnabled,
    isVideoEnabled,
  } = useVideo();

  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  >('disconnected');
  const [participants, setParticipants] = useState<SocketParticipant[]>([]);
  const [activeReaction, setActiveReaction] = useState<{ emoji: string; sender: string } | null>(null);

  // Determine signaling gateway URL
  const getSignalingUrl = useCallback(() => {
    if (process.env.NEXT_PUBLIC_SIGNALING_URL) {
      return process.env.NEXT_PUBLIC_SIGNALING_URL;
    }
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const hostname = window.location.hostname;
      // In production deployment with custom domain / same host or port 3001
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
        role,
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
      // Keep connection status informative without crashing
    });

    // 1. Initial Room Users List
    socket.on('room-users', async ({ participants: existingPeers }: { participants: SocketParticipant[] }) => {
      console.log(`[Socket] Discovered ${existingPeers.length} existing peers in room:`, existingPeers);
      setParticipants(existingPeers);

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
    });

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
    role,
    connectToPeer,
    handlePeerOffer,
    handlePeerAnswer,
    handlePeerIceCandidate,
    registerIceCandidateHandler,
    disconnectPeer,
    getSignalingUrl,
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

  const endMeetingForAll = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('end-meeting');
    }
  }, []);

  return {
    connectionStatus,
    participants,
    activeReaction,
    sendReaction,
    endMeetingForAll,
    socket: socketRef.current,
  };
}
