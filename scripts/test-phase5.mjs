/**
 * Phase 5 Automated Verification Suite: Participant Management & Host Controls
 * Tests in-memory signaling gateway and client events for:
 * - Hand raising / lowering
 * - Host remote mute individual
 * - Host mute all
 * - Host role assignment (promote to Co-Host)
 * - Room lock enforcement (blocking newcomers)
 * - Room unlock
 * - Host kick participant
 */

import http from 'http';
import { io as Client } from 'socket.io-client';
import { createSignalingServer } from '../server/signaling.mjs';

const TEST_PORT = 3105;
const SIGNALING_URL = `http://localhost:${TEST_PORT}`;

let server;
let ioServer;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runPhase5Tests() {
  console.log('🚀 Starting Phase 5 (Participant Management & Controls) Verification Tests...\n');

  // 1. Start test signaling server
  server = http.createServer();
  ioServer = createSignalingServer(server);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  assert(server.listening, '1. Signaling server initialized on port ' + TEST_PORT);

  const meetingId = 'meetflow-phase5-room';

  // 2. Host (Alice) connects & joins room
  const alice = Client(SIGNALING_URL, { transports: ['websocket'] });
  await new Promise((resolve) => alice.on('connect', resolve));
  assert(alice.connected, '2. Host (Alice) connected to signaling gateway');

  const aliceJoinPromise = new Promise((resolve) => {
    alice.on('room-users', resolve);
  });
  alice.emit('join-room', {
    meetingId,
    userId: 'usr_alice_host',
    displayName: 'Alice (Host)',
    role: 'HOST',
    isAudioEnabled: true,
    isVideoEnabled: true,
  });
  const aliceRoomState = await aliceJoinPromise;
  assert(aliceRoomState.self.role === 'HOST', '3. Alice registered as HOST in meeting room');

  // 3. Guests (Bob and Charlie) connect & join room
  const bob = Client(SIGNALING_URL, { transports: ['websocket'] });
  const charlie = Client(SIGNALING_URL, { transports: ['websocket'] });
  await Promise.all([
    new Promise((resolve) => bob.on('connect', resolve)),
    new Promise((resolve) => charlie.on('connect', resolve)),
  ]);

  const bobJoinPromise = new Promise((resolve) => bob.on('room-users', resolve));
  bob.emit('join-room', {
    meetingId,
    userId: 'usr_bob_guest',
    displayName: 'Bob',
    role: 'PARTICIPANT',
    isAudioEnabled: true,
    isVideoEnabled: true,
  });
  await bobJoinPromise;

  const charlieJoinPromise = new Promise((resolve) => charlie.on('room-users', resolve));
  charlie.emit('join-room', {
    meetingId,
    userId: 'usr_charlie_guest',
    displayName: 'Charlie',
    role: 'PARTICIPANT',
    isAudioEnabled: true,
    isVideoEnabled: true,
  });
  await charlieJoinPromise;
  assert(true, '4. Bob and Charlie successfully joined the meeting');

  // 4. Bob raises hand -> Alice and Charlie receive notification
  const handRaisePromiseAlice = new Promise((resolve) => {
    alice.on('participant-hand-raised', resolve);
  });
  bob.emit('toggle-hand-raise', { isHandRaised: true });
  const handEvent = await handRaisePromiseAlice;
  assert(
    handEvent.socketId === bob.id && handEvent.isHandRaised === true,
    '5. Bob raised hand: Host received participant-hand-raised event'
  );

  // 5. Host remote mutes Bob -> Bob receives force-mute-audio
  const bobMutePromise = new Promise((resolve) => {
    bob.on('force-mute-audio', resolve);
  });
  alice.emit('mute-participant', { targetSocketId: bob.id });
  const muteNotice = await bobMutePromise;
  assert(muteNotice.mutedBy !== undefined, '6. Host remote muted Bob: Bob received force-mute-audio');

  // 6. Host mutes all -> Charlie receives force-mute-audio
  const charlieMutePromise = new Promise((resolve) => {
    charlie.on('force-mute-audio', resolve);
  });
  alice.emit('mute-all');
  await charlieMutePromise;
  assert(true, '7. Host executed Mute All: Charlie received force-mute-audio');

  // 7. Host promotes Bob to CO_HOST -> Bob receives role-updated, Alice receives participant-role-changed
  const bobRolePromise = new Promise((resolve) => bob.on('role-updated', resolve));
  const aliceRoleTrackPromise = new Promise((resolve) => alice.on('participant-role-changed', resolve));
  alice.emit('assign-role', { targetSocketId: bob.id, newRole: 'CO_HOST' });
  const bobUpdated = await bobRolePromise;
  const roomTrack = await aliceRoleTrackPromise;
  assert(
    bobUpdated.role === 'CO_HOST' && roomTrack.role === 'CO_HOST',
    '8. Host promoted Bob to CO_HOST: Bob & room updated successfully'
  );

  // 8. Host locks room -> broadcast received
  const lockPromise = new Promise((resolve) => bob.on('room-lock-changed', resolve));
  alice.emit('lock-meeting', { isLocked: true });
  const lockEvent = await lockPromise;
  assert(lockEvent.isLocked === true, '9. Host locked meeting: room-lock-changed received by peers');

  // 9. Newcomer (Dave) tries to join locked room -> rejected with room-locked-error
  const dave = Client(SIGNALING_URL, { transports: ['websocket'] });
  await new Promise((resolve) => dave.on('connect', resolve));

  const daveRejectedPromise = new Promise((resolve) => {
    dave.on('room-locked-error', resolve);
  });
  dave.emit('join-room', {
    meetingId,
    userId: 'usr_dave_intruder',
    displayName: 'Dave',
    role: 'PARTICIPANT',
  });
  const rejectNotice = await daveRejectedPromise;
  assert(rejectNotice.message !== undefined, '10. Room lock enforced: Newcomer Dave rejected from locked room');

  // 10. Host unlocks meeting room -> unlock event broadcasted
  const unlockPromise = new Promise((resolve) => bob.on('room-lock-changed', resolve));
  alice.emit('lock-meeting', { isLocked: false });
  const unlockEvent = await unlockPromise;
  assert(unlockEvent.isLocked === false, '11. Host unlocked meeting room successfully');

  // 11. Host kicks Charlie -> Charlie receives participant-kicked & Alice receives participant-left
  const charlieKickPromise = new Promise((resolve) => charlie.on('participant-kicked', resolve));
  const aliceLeftPromise = new Promise((resolve) => alice.on('participant-left', resolve));
  alice.emit('kick-participant', { targetSocketId: charlie.id, reason: 'Test removal' });
  await Promise.all([charlieKickPromise, aliceLeftPromise]);
  assert(true, '12. Host kicked Charlie: Charlie notified and removed from meeting room');

  // Cleanup sockets
  alice.disconnect();
  bob.disconnect();
  charlie.disconnect();
  dave.disconnect();
  ioServer.close();
  server.close();

  console.log('\n================================');
  console.log(`Phase 5 Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================\n');

  if (failed > 0) process.exit(1);
}

runPhase5Tests().catch((err) => {
  console.error('Phase 5 test failure:', err);
  process.exit(1);
});
