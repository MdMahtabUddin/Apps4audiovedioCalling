/**
 * Phase 4 Integration Test Suite
 * Tests Socket.IO Real-time Signaling Gateway, Room Orchestration,
 * WebRTC SDP Offer/Answer Relaying, ICE Candidate Exchange,
 * Media State Synchronization, Floating Reactions, and Host Termination.
 */

import http from 'http';
import { io as Client } from 'socket.io-client';
import assert from 'assert';
import { createSignalingServer } from '../server/signaling.mjs';

const TEST_PORT = 3099;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

let server;
let ioInstance;
let socketHost;
let socketGuest;
let socketOtherRoom;

let passedTests = 0;
let failedTests = 0;

function pass(name) {
  console.log(`  ✅ PASS: ${name}`);
  passedTests++;
}

function fail(name, err) {
  console.error(`  ❌ FAIL: ${name}`);
  console.error(`     Error: ${err.message || err}`);
  failedTests++;
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAll() {
  console.log('🚀 Starting Phase 4 (Socket.IO Real-Time Signaling Gateway) Integration Tests...\n');

  try {
    // 1. Start Signaling Server
    server = http.createServer();
    ioInstance = createSignalingServer(server);
    await new Promise((resolve) => server.listen(TEST_PORT, resolve));
    pass('1. Signaling HTTP & WebSocket Server started successfully on port ' + TEST_PORT);

    // 2. Host (Alice) Connects and Joins Meeting Room
    socketHost = Client(SERVER_URL, { transports: ['websocket'] });
    await new Promise((resolve) => socketHost.on('connect', resolve));
    pass('2. Client 1 (Alice) connected to signaling gateway');

    const hostRoomUsersPromise = new Promise((resolve) => {
      socketHost.on('room-users', resolve);
    });

    socketHost.emit('join-room', {
      meetingId: 'meetflow-test-room',
      userId: 'usr_alice_123',
      displayName: 'Alice (Host)',
      role: 'HOST',
      isAudioEnabled: true,
      isVideoEnabled: true,
    });

    const hostRoomData = await hostRoomUsersPromise;
    assert.strictEqual(hostRoomData.participants.length, 0, 'Alice should be first in room');
    assert.strictEqual(hostRoomData.self.displayName, 'Alice (Host)');
    pass('3. Alice initialized meeting room and received empty initial participants list');

    // 3. Guest (Bob) Joins Same Meeting Room
    socketGuest = Client(SERVER_URL, { transports: ['websocket'] });
    await new Promise((resolve) => socketGuest.on('connect', resolve));

    const aliceSeesBobJoinPromise = new Promise((resolve) => {
      socketHost.on('participant-joined', resolve);
    });

    const bobRoomUsersPromise = new Promise((resolve) => {
      socketGuest.on('room-users', resolve);
    });

    socketGuest.emit('join-room', {
      meetingId: 'meetflow-test-room',
      userId: 'usr_bob_456',
      displayName: 'Bob (Guest)',
      role: 'PARTICIPANT',
      isAudioEnabled: true,
      isVideoEnabled: false,
    });

    const [bobJoinedEvent, bobRoomData] = await Promise.all([
      aliceSeesBobJoinPromise,
      bobRoomUsersPromise,
    ]);

    assert.strictEqual(bobJoinedEvent.userId, 'usr_bob_456');
    assert.strictEqual(bobJoinedEvent.displayName, 'Bob (Guest)');
    assert.strictEqual(bobRoomData.participants.length, 1, 'Bob should see Alice in room');
    assert.strictEqual(bobRoomData.participants[0].userId, 'usr_alice_123');
    pass('4. Bob joined room: Alice notified & Bob discovered Alice');

    // 4. WebRTC SDP Offer Relay: Alice -> Bob
    const bobReceivesOfferPromise = new Promise((resolve) => {
      socketGuest.on('signal-offer', resolve);
    });

    const mockOfferSdp = { type: 'offer', sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\nm=audio 9 UDP...' };
    socketHost.emit('signal-offer', {
      targetSocketId: socketGuest.id,
      offer: mockOfferSdp,
    });

    const offerPayload = await bobReceivesOfferPromise;
    assert.strictEqual(offerPayload.callerSocketId, socketHost.id);
    assert.strictEqual(offerPayload.offer.type, 'offer');
    pass('5. SDP Offer relayed directly from Alice to Bob');

    // 5. WebRTC SDP Answer Relay: Bob -> Alice
    const aliceReceivesAnswerPromise = new Promise((resolve) => {
      socketHost.on('signal-answer', resolve);
    });

    const mockAnswerSdp = { type: 'answer', sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\nm=audio 9 UDP...' };
    socketGuest.emit('signal-answer', {
      targetSocketId: socketHost.id,
      answer: mockAnswerSdp,
    });

    const answerPayload = await aliceReceivesAnswerPromise;
    assert.strictEqual(answerPayload.responderSocketId, socketGuest.id);
    assert.strictEqual(answerPayload.answer.type, 'answer');
    pass('6. SDP Answer relayed directly from Bob to Alice');

    // 6. ICE Candidate Relay
    const bobReceivesCandidatePromise = new Promise((resolve) => {
      socketGuest.on('ice-candidate', resolve);
    });

    const mockCandidate = { candidate: 'candidate:1 1 UDP 2122260223 192.168.1.100 50000 typ host', sdpMid: '0' };
    socketHost.emit('ice-candidate', {
      targetSocketId: socketGuest.id,
      candidate: mockCandidate,
    });

    const candidatePayload = await bobReceivesCandidatePromise;
    assert.strictEqual(candidatePayload.fromSocketId, socketHost.id);
    assert.strictEqual(candidatePayload.candidate.sdpMid, '0');
    pass('7. ICE candidate relayed between peers');

    // 7. Media State Broadcast (Mute Microphone)
    const aliceReceivesMediaStatePromise = new Promise((resolve) => {
      socketHost.on('participant-media-changed', resolve);
    });

    socketGuest.emit('media-state', {
      isAudioEnabled: false,
      isVideoEnabled: false,
    });

    const mediaStatePayload = await aliceReceivesMediaStatePromise;
    assert.strictEqual(mediaStatePayload.socketId, socketGuest.id);
    assert.strictEqual(mediaStatePayload.isAudioEnabled, false);
    pass('8. Media state change (microphone mute) broadcasted to room');

    // 8. Real-time Floating Reactions Broadcast
    const aliceReceivesReactionPromise = new Promise((resolve) => {
      socketHost.on('reaction-received', resolve);
    });

    socketGuest.emit('send-reaction', { emoji: '🎉' });
    const reactionPayload = await aliceReceivesReactionPromise;
    assert.strictEqual(reactionPayload.emoji, '🎉');
    assert.strictEqual(reactionPayload.senderName, 'Bob (Guest)');
    pass('9. Floating emoji reaction broadcasted in real-time');

    // 9. Multi-Room Isolation Verification
    socketOtherRoom = Client(SERVER_URL, { transports: ['websocket'] });
    await new Promise((resolve) => socketOtherRoom.on('connect', resolve));

    let leakDetected = false;
    socketHost.on('reaction-received', (data) => {
      if (data.emoji === '🚫') leakDetected = true;
    });

    socketOtherRoom.emit('join-room', {
      meetingId: 'different-isolated-room',
      userId: 'usr_charlie_789',
      displayName: 'Charlie',
    });

    await wait(100);
    socketOtherRoom.emit('send-reaction', { emoji: '🚫' });
    await wait(150);

    assert.strictEqual(leakDetected, false, 'Rooms must be strictly isolated from cross-traffic');
    pass('10. Multi-room isolation verified: events do not leak across meetings');

    // 10. Disconnect Cleanup: Bob leaves meeting
    const aliceSeesBobLeavePromise = new Promise((resolve) => {
      socketHost.on('participant-left', resolve);
    });

    socketGuest.disconnect();
    const leavePayload = await aliceSeesBobLeavePromise;
    assert.strictEqual(leavePayload.userId, 'usr_bob_456');
    pass('11. Participant departure detected and cleaned up on socket disconnect');

    // 11. Host Ends Meeting Broadcast
    const charlieInRoomPromise = new Promise((resolve) => {
      socketHost.on('participant-joined', resolve);
    });

    // Have Charlie join Alice's room to test end-meeting reception
    socketOtherRoom.emit('join-room', {
      meetingId: 'meetflow-test-room',
      userId: 'usr_charlie_789',
      displayName: 'Charlie',
      role: 'PARTICIPANT',
    });
    await charlieInRoomPromise;

    const charlieReceivesEndPromise = new Promise((resolve) => {
      socketOtherRoom.on('meeting-ended', resolve);
    });

    socketHost.emit('end-meeting');
    const endPayload = await charlieReceivesEndPromise;
    assert(endPayload.reason.includes('host'), 'Must include host termination reason');
    pass('12. Host end-meeting broadcasted and enforced for all participants');

  } catch (err) {
    fail('Phase 4 Test Execution', err);
  } finally {
    if (socketHost?.connected) socketHost.disconnect();
    if (socketGuest?.connected) socketGuest.disconnect();
    if (socketOtherRoom?.connected) socketOtherRoom.disconnect();
    if (ioInstance) {
      ioInstance.close();
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    console.log('\n================================');
    console.log(`Phase 4 Test Results: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('================================\n');

    process.exit(failedTests > 0 ? 1 : 0);
  }
}

runAll();
