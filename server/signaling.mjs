/**
 * MeetFlow / MetroMeet Real-time WebRTC Signaling Gateway
 * High-performance WebSocket server with MetroNet enterprise waiting room,
 * host knocking/admission approval, ringtone coordination, role management,
 * and media state synchronization.
 */

import http from 'http';
import { Server } from 'socket.io';

const PORT = process.env.SIGNALING_PORT || 3001;

// In-memory room store: Map<meetingId, RoomState>
export const rooms = new Map();

function getOrCreateRoom(meetingId, hostSocketId = null) {
  if (!rooms.has(meetingId)) {
    rooms.set(meetingId, {
      isLocked: false,
      waitingRoomEnabled: true, // Default enabled for secure corporate meetings
      hostSocketId: hostSocketId,
      hostName: 'Host',
      participants: new Map(),
      waitingQueue: new Map(), // socketId -> WaitingParticipantInfo
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

    // 1. Join Room / Request Admission
    socket.on('join-room', ({ meetingId, userId, displayName, role = 'PARTICIPANT', isAudioEnabled = true, isVideoEnabled = true }) => {
      const room = getOrCreateRoom(meetingId, role === 'HOST' ? socket.id : null);
      currentMeetingId = meetingId;

      // A. Check Room Lock
      if (room.isLocked && role !== 'HOST' && room.hostSocketId !== socket.id) {
        socket.emit('room-locked-error', {
          message: 'This meeting is currently locked by the host.',
        });
        return;
      }

      // If user is HOST, register immediately and record host details
      if (role === 'HOST') {
        room.hostSocketId = socket.id;
        room.hostName = displayName || 'Host';
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

      // B. Waiting Room & Host Admission Check:
      // If waiting room is enabled and user is not HOST and not the room's host socket
      if (room.waitingRoomEnabled && role !== 'HOST' && room.hostSocketId !== socket.id) {
        room.waitingQueue.set(socket.id, currentUser);
        console.log(`[Signaling] ${currentUser.displayName} (${socket.id}) placed in waiting queue for ${meetingId}`);

        // Notify newcomer they are in waiting room
        socket.emit('waiting-for-admission', {
          meetingId,
          hostName: room.hostName,
          position: room.waitingQueue.size,
        });

        // Notify host(s) in meeting room
        io.to(meetingId).emit('participant-knock-request', {
          socketId: socket.id,
          userId: currentUser.userId,
          displayName: currentUser.displayName,
          requestedAt: Date.now(),
          waitingCount: room.waitingQueue.size,
        });
        return;
      }

      // C. Active Call Admission
      socket.join(meetingId);

      const existing = Array.from(room.participants.values());
      const waitingList = Array.from(room.waitingQueue.values());

      room.participants.set(socket.id, currentUser);

      console.log(`[Signaling] ${currentUser.displayName} (${socket.id}) admitted to meeting: ${meetingId}. Total: ${room.participants.size}`);

      // Send existing participants list, waiting queue, and room status
      socket.emit('room-users', {
        participants: existing,
        self: currentUser,
        isLocked: room.isLocked,
        waitingRoomEnabled: room.waitingRoomEnabled,
        waitingQueue: waitingList,
      });

      // Announce arrival to all other peers
      socket.to(meetingId).emit('participant-joined', currentUser);
    });

    // 2. Host Admits Participant from Waiting Room (Phase 5 + MetroNet Admission)
    socket.on('admit-participant', ({ targetSocketId }) => {
      if (!currentMeetingId) return;
      const room = rooms.get(currentMeetingId);
      if (!room) return;

      const waitingUser = room.waitingQueue.get(targetSocketId);
      if (waitingUser) {
        room.waitingQueue.delete(targetSocketId);

        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.join(currentMeetingId);

          const existing = Array.from(room.participants.values());
          room.participants.set(targetSocketId, waitingUser);

          // Tell candidate they have been admitted
          targetSocket.emit('admitted-to-room', {
            participants: existing,
            self: waitingUser,
            isLocked: room.isLocked,
          });

          // Announce to all other attendees in meeting
          socket.to(currentMeetingId).emit('participant-joined', waitingUser);

          // Broadcast updated waiting queue to host
          io.to(currentMeetingId).emit('waiting-queue-updated', {
            waitingQueue: Array.from(room.waitingQueue.values()),
          });
        }
      }
    });

    // 3. Host Denies Participant from Waiting Room
    socket.on('deny-participant', ({ targetSocketId }) => {
      if (!currentMeetingId) return;
      const room = rooms.get(currentMeetingId);
      if (!room) return;

      if (room.waitingQueue.has(targetSocketId)) {
        room.waitingQueue.delete(targetSocketId);

        io.to(targetSocketId).emit('denied-from-room', {
          reason: 'The meeting host has declined your request to join.',
        });

        // Broadcast updated waiting queue to host
        io.to(currentMeetingId).emit('waiting-queue-updated', {
          waitingQueue: Array.from(room.waitingQueue.values()),
        });
      }
    });

    // 4. Host Admits All Waiting Participants
    socket.on('admit-all', () => {
      if (!currentMeetingId) return;
      const room = rooms.get(currentMeetingId);
      if (!room) return;

      for (const [targetSocketId, waitingUser] of room.waitingQueue.entries()) {
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.join(currentMeetingId);
          const existing = Array.from(room.participants.values());
          room.participants.set(targetSocketId, waitingUser);

          targetSocket.emit('admitted-to-room', {
            participants: existing,
            self: waitingUser,
            isLocked: room.isLocked,
          });

          socket.to(currentMeetingId).emit('participant-joined', waitingUser);
        }
      }

      room.waitingQueue.clear();
      io.to(currentMeetingId).emit('waiting-queue-updated', { waitingQueue: [] });
    });

    // 5. Host Toggles Waiting Room Setting
    socket.on('toggle-waiting-room', ({ enabled }) => {
      if (!currentMeetingId) return;
      const room = rooms.get(currentMeetingId);
      if (!room) return;

      room.waitingRoomEnabled = !!enabled;
      io.to(currentMeetingId).emit('waiting-room-toggled', {
        waitingRoomEnabled: room.waitingRoomEnabled,
      });
    });

    // 6. WebRTC SDP Offer Relay
    socket.on('signal-offer', ({ targetSocketId, offer }) => {
      if (!targetSocketId || !offer) return;
      io.to(targetSocketId).emit('signal-offer', {
        callerSocketId: socket.id,
        callerInfo: currentUser,
        offer,
      });
    });

    // 7. WebRTC SDP Answer Relay
    socket.on('signal-answer', ({ targetSocketId, answer }) => {
      if (!targetSocketId || !answer) return;
      io.to(targetSocketId).emit('signal-answer', {
        responderSocketId: socket.id,
        answer,
      });
    });

    // 8. ICE Candidate Relay
    socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
      if (!targetSocketId || !candidate) return;
      io.to(targetSocketId).emit('ice-candidate', {
        fromSocketId: socket.id,
        candidate,
      });
    });

    // 9. Media State Broadcast
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

    // 10. Real-time Emoji Reactions
    socket.on('send-reaction', ({ emoji }) => {
      if (!currentMeetingId) return;
      io.to(currentMeetingId).emit('reaction-received', {
        emoji,
        senderSocketId: socket.id,
        senderName: currentUser?.displayName || 'Someone',
      });
    });

    // 11. Toggle Hand Raise
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

    // 12. Host Remote Mute Single Participant
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

    // 13. Host Mute All Participants
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

    // 14. Host Kick Participant
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

    // 15. Host Assign Role
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

    // 16. Host Lock / Unlock Meeting
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

    // 17. Host Ends Meeting
    socket.on('end-meeting', () => {
      if (!currentMeetingId) return;
      io.to(currentMeetingId).emit('meeting-ended', {
        reason: 'The host has ended this meeting.',
      });
      rooms.delete(currentMeetingId);
    });

    // 18. Disconnect & Cleanup
    socket.on('disconnect', () => {
      console.log(`[Signaling] Socket disconnected: ${socket.id}`);
      if (currentMeetingId && rooms.has(currentMeetingId)) {
        const room = rooms.get(currentMeetingId);

        // Remove from waiting queue if pending
        if (room.waitingQueue.has(socket.id)) {
          room.waitingQueue.delete(socket.id);
          io.to(currentMeetingId).emit('waiting-queue-updated', {
            waitingQueue: Array.from(room.waitingQueue.values()),
          });
        }

        // Remove from active participants
        if (room.participants.has(socket.id)) {
          room.participants.delete(socket.id);
          socket.to(currentMeetingId).emit('participant-left', {
            socketId: socket.id,
            userId: currentUser?.userId,
            displayName: currentUser?.displayName,
          });
        }

        if (room.participants.size === 0 && room.waitingQueue.size === 0) {
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
    res.end('MetroMeet Signaling Server Running');
  });

  createSignalingServer(server);

  server.listen(PORT, () => {
    console.log(`🚀 MetroMeet WebRTC Signaling Server listening on port ${PORT}`);
  });
}
