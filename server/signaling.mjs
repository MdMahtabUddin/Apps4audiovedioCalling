/**
 * MeetFlow Real-time WebRTC Signaling Gateway (Phase 4 & Phase 5)
 * High-performance WebSocket server using Socket.IO for peer negotiation,
 * room orchestration, host controls, role management, hand raising, and room lock.
 */

import http from 'http';
import { Server } from 'socket.io';

const PORT = process.env.SIGNALING_PORT || 3001;

// In-memory room store: Map<meetingId, { isLocked: boolean, hostSocketId: string, participants: Map<socketId, ParticipantInfo> }>
export const rooms = new Map();

function getOrCreateRoom(meetingId, hostSocketId = null) {
  if (!rooms.has(meetingId)) {
    rooms.set(meetingId, {
      isLocked: false,
      hostSocketId: hostSocketId,
      participants: new Map(),
    });
  }
  return rooms.get(meetingId);
}

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
    socket.on('join-room', ({ meetingId, userId, displayName, role = 'PARTICIPANT', isAudioEnabled = true, isVideoEnabled = true }) => {
      const room = getOrCreateRoom(meetingId, role === 'HOST' ? socket.id : null);

      // Check room lock: if locked and not the host, reject join
      if (room.isLocked && role !== 'HOST' && room.hostSocketId !== socket.id) {
        socket.emit('room-locked-error', {
          message: 'This meeting is currently locked by the host.',
        });
        return;
      }

      currentMeetingId = meetingId;
      if (role === 'HOST') {
        room.hostSocketId = socket.id;
      }

      currentUser = {
        socketId: socket.id,
        userId: userId || `guest_${socket.id.slice(0, 5)}`,
        displayName: displayName || 'Guest',
        role: role || 'PARTICIPANT',
        isAudioEnabled,
        isVideoEnabled,
        isHandRaised: false,
        handRaisedAt: null,
        joinedAt: Date.now(),
      };

      socket.join(meetingId);

      // Collect existing participants in the room before adding the new one
      const existing = Array.from(room.participants.values());

      // Add current user to room store
      room.participants.set(socket.id, currentUser);

      console.log(`[Signaling] ${currentUser.displayName} (${socket.id}) joined meeting: ${meetingId}. Total: ${room.participants.size}`);

      // Send existing participants list and room state to newcomer
      socket.emit('room-users', {
        participants: existing,
        self: currentUser,
        isLocked: room.isLocked,
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

    // 7. Toggle Hand Raise (Phase 5)
    socket.on('toggle-hand-raise', ({ isHandRaised }) => {
      if (!currentMeetingId || !currentUser) return;
      currentUser.isHandRaised = isHandRaised !== undefined ? isHandRaised : !currentUser.isHandRaised;
      currentUser.handRaisedAt = currentUser.isHandRaised ? Date.now() : null;

      io.to(currentMeetingId).emit('participant-hand-raised', {
        socketId: socket.id,
        userId: currentUser.userId,
        displayName: currentUser.displayName,
        isHandRaised: currentUser.isHandRaised,
        handRaisedAt: currentUser.handRaisedAt,
      });
    });

    // 8. Host Remote Mute Single Participant (Phase 5)
    socket.on('mute-participant', ({ targetSocketId }) => {
      if (!currentMeetingId || !targetSocketId) return;
      const room = rooms.get(currentMeetingId);
      if (!room) return;

      const target = room.participants.get(targetSocketId);
      if (target) {
        target.isAudioEnabled = false;
        io.to(targetSocketId).emit('force-mute-audio', {
          mutedBy: currentUser?.displayName || 'Host',
        });
        io.to(currentMeetingId).emit('participant-media-changed', {
          socketId: targetSocketId,
          isAudioEnabled: false,
          isVideoEnabled: target.isVideoEnabled,
        });
      }
    });

    // 9. Host Mute All Participants (Phase 5)
    socket.on('mute-all', () => {
      if (!currentMeetingId) return;
      const room = rooms.get(currentMeetingId);
      if (!room) return;

      for (const [sId, participant] of room.participants.entries()) {
        if (sId !== socket.id && participant.role !== 'HOST') {
          participant.isAudioEnabled = false;
          io.to(sId).emit('force-mute-audio', {
            mutedBy: currentUser?.displayName || 'Host',
          });
          io.to(currentMeetingId).emit('participant-media-changed', {
            socketId: sId,
            isAudioEnabled: false,
            isVideoEnabled: participant.isVideoEnabled,
          });
        }
      }
    });

    // 10. Host Kick Participant (Phase 5)
    socket.on('kick-participant', ({ targetSocketId, reason }) => {
      if (!currentMeetingId || !targetSocketId) return;
      const room = rooms.get(currentMeetingId);
      if (!room) return;

      const target = room.participants.get(targetSocketId);
      if (target) {
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        io.to(targetSocketId).emit('participant-kicked', {
          reason: reason || 'You have been removed from the meeting by the host.',
        });

        room.participants.delete(targetSocketId);

        io.to(currentMeetingId).emit('participant-left', {
          socketId: targetSocketId,
          userId: target.userId,
          displayName: target.displayName,
        });

        if (targetSocket) {
          targetSocket.leave(currentMeetingId);
        }
      }
    });

    // 11. Host Assign Role (Co-Host / Participant) (Phase 5)
    socket.on('assign-role', ({ targetSocketId, newRole }) => {
      if (!currentMeetingId || !targetSocketId || !newRole) return;
      const room = rooms.get(currentMeetingId);
      if (!room) return;

      const target = room.participants.get(targetSocketId);
      if (target) {
        target.role = newRole;
        io.to(targetSocketId).emit('role-updated', {
          role: newRole,
        });
        io.to(currentMeetingId).emit('participant-role-changed', {
          socketId: targetSocketId,
          role: newRole,
        });
      }
    });

    // 12. Host Lock / Unlock Meeting (Phase 5)
    socket.on('lock-meeting', ({ isLocked }) => {
      if (!currentMeetingId) return;
      const room = rooms.get(currentMeetingId);
      if (!room) return;

      room.isLocked = !!isLocked;
      io.to(currentMeetingId).emit('room-lock-changed', {
        isLocked: room.isLocked,
        lockedBy: currentUser?.displayName || 'Host',
      });
    });

    // 13. Host Ends Meeting
    socket.on('end-meeting', () => {
      if (!currentMeetingId) return;
      io.to(currentMeetingId).emit('meeting-ended', {
        reason: 'The host has ended this meeting.',
      });
      rooms.delete(currentMeetingId);
    });

    // 14. Disconnect & Cleanup
    socket.on('disconnect', () => {
      console.log(`[Signaling] Socket disconnected: ${socket.id}`);
      if (currentMeetingId && rooms.has(currentMeetingId)) {
        const room = rooms.get(currentMeetingId);
        room.participants.delete(socket.id);

        socket.to(currentMeetingId).emit('participant-left', {
          socketId: socket.id,
          userId: currentUser?.userId,
          displayName: currentUser?.displayName,
        });

        if (room.participants.size === 0) {
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
