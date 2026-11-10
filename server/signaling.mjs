/**
 * MeetFlow Real-time WebRTC Signaling Gateway (Phase 4)
 * High-performance WebSocket server using Socket.IO for peer negotiation,
 * room orchestration, and media state synchronization.
 */

import http from 'http';
import { Server } from 'socket.io';

const PORT = process.env.SIGNALING_PORT || 3001;

// In-memory room store: Map<meetingId, Map<socketId, ParticipantInfo>>
const rooms = new Map();

export function createSignalingServer(serverInstance) {
  const io = new Server(serverInstance, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  io.on('connection', (socket) => {
    let currentMeetingId = null;
    let currentUser = null;

    console.log(`[Signaling] Socket connected: ${socket.id}`);

    // 1. Join Room
    socket.on('join-room', ({ meetingId, userId, displayName, role, isAudioEnabled = true, isVideoEnabled = true }) => {
      currentMeetingId = meetingId;
      currentUser = {
        socketId: socket.id,
        userId: userId || `guest_${socket.id.slice(0, 5)}`,
        displayName: displayName || 'Guest',
        role: role || 'PARTICIPANT',
        isAudioEnabled,
        isVideoEnabled,
        joinedAt: Date.now(),
      };

      socket.join(meetingId);

      if (!rooms.has(meetingId)) {
        rooms.set(meetingId, new Map());
      }
      const roomParticipants = rooms.get(meetingId);

      // Collect existing participants in the room before adding the new one
      const existing = Array.from(roomParticipants.values());

      // Add current user to room store
      roomParticipants.set(socket.id, currentUser);

      console.log(`[Signaling] ${currentUser.displayName} (${socket.id}) joined meeting: ${meetingId}. Total: ${roomParticipants.size}`);

      // Send existing participants list to newcomer so they know who to establish mesh with
      socket.emit('room-users', {
        participants: existing,
        self: currentUser,
      });

      // Announce arrival to all other peers in the room
      socket.to(meetingId).emit('participant-joined', currentUser);
    });

    // 2. WebRTC SDP Offer Relay
    socket.on('signal-offer', ({ targetSocketId, offer }) => {
      if (!targetSocketId || !offer) return;
      io.to(targetSocketId).emit('signal-offer', {
        callerSocketId: socket.id,
        callerInfo: currentUser,
        offer,
      });
    });

    // 3. WebRTC SDP Answer Relay
    socket.on('signal-answer', ({ targetSocketId, answer }) => {
      if (!targetSocketId || !answer) return;
      io.to(targetSocketId).emit('signal-answer', {
        responderSocketId: socket.id,
        answer,
      });
    });

    // 4. ICE Candidate Relay
    socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
      if (!targetSocketId || !candidate) return;
      io.to(targetSocketId).emit('ice-candidate', {
        fromSocketId: socket.id,
        candidate,
      });
    });

    // 5. Media State Broadcast (Mute/Unmute audio or camera)
    socket.on('media-state', ({ isAudioEnabled, isVideoEnabled }) => {
      if (!currentMeetingId) return;
      if (currentUser) {
        currentUser.isAudioEnabled = isAudioEnabled;
        currentUser.isVideoEnabled = isVideoEnabled;
      }
      socket.to(currentMeetingId).emit('participant-media-changed', {
        socketId: socket.id,
        isAudioEnabled,
        isVideoEnabled,
      });
    });

    // 6. Real-time Emoji Reactions Broadcast
    socket.on('send-reaction', ({ emoji }) => {
      if (!currentMeetingId) return;
      io.to(currentMeetingId).emit('reaction-received', {
        emoji,
        senderSocketId: socket.id,
        senderName: currentUser?.displayName || 'Someone',
      });
    });

    // 7. Host Ends Meeting
    socket.on('end-meeting', () => {
      if (!currentMeetingId) return;
      io.to(currentMeetingId).emit('meeting-ended', {
        reason: 'The host has ended this meeting.',
      });
      rooms.delete(currentMeetingId);
    });

    // 8. Disconnect & Cleanup
    socket.on('disconnect', () => {
      console.log(`[Signaling] Socket disconnected: ${socket.id}`);
      if (currentMeetingId && rooms.has(currentMeetingId)) {
        const roomParticipants = rooms.get(currentMeetingId);
        roomParticipants.delete(socket.id);

        socket.to(currentMeetingId).emit('participant-left', {
          socketId: socket.id,
          userId: currentUser?.userId,
          displayName: currentUser?.displayName,
        });

        if (roomParticipants.size === 0) {
          rooms.delete(currentMeetingId);
        }
      }
    });
  });

  return io;
}

// If run directly via node server/signaling.mjs
if (process.argv[1]?.endsWith('signaling.mjs')) {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', activeRooms: rooms.size }));
      return;
    }
    res.writeHead(200);
    res.end('MeetFlow Signaling Server Running');
  });

  createSignalingServer(server);

  server.listen(PORT, () => {
    console.log(`🚀 MeetFlow WebRTC Signaling Server listening on port ${PORT}`);
  });
}
