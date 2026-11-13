/**
 * Automated Verification Suite for MetroMeet Waiting Room & Host Admission
 */

import http from 'http';
import { io as Client } from 'socket.io-client';
import { createSignalingServer } from '../server/signaling.mjs';

const TEST_PORT = 3110;
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

async function runWaitingRoomTests() {
  console.log('🚀 Starting MetroMeet Waiting Room & Host Admission Verification Tests...\n');

  server = http.createServer();
  ioServer = createSignalingServer(server);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  assert(server.listening, '1. Signaling server initialized on port ' + TEST_PORT);

  const meetingId = 'metromeet-boardroom';

  // 1. Host (Alice) joins room
  const alice = Client(SIGNALING_URL, { transports: ['websocket'] });
  await new Promise((resolve) => alice.on('connect', resolve));

  const aliceJoinPromise = new Promise((resolve) => alice.on('room-users', resolve));
  alice.emit('join-room', {
    meetingId,
    userId: 'usr_alice_host',
    displayName: 'Alice (Host)',
    role: 'HOST',
  });
  await aliceJoinPromise;
  assert(true, '2. Host (Alice) joined and initialized meeting room with waiting room enabled');

  // 2. Guest (Bob) attempts to join -> should be placed in waiting room
  const bob = Client(SIGNALING_URL, { transports: ['websocket'] });
  await new Promise((resolve) => bob.on('connect', resolve));

  const bobWaitingPromise = new Promise((resolve) => bob.on('waiting-for-admission', resolve));
  const aliceKnockPromise = new Promise((resolve) => alice.on('participant-knock-request', resolve));

  bob.emit('join-room', {
    meetingId,
    userId: 'usr_bob_guest',
    displayName: 'Bob Guest',
    role: 'PARTICIPANT',
  });

  const waitingNotice = await bobWaitingPromise;
  const knockNotice = await aliceKnockPromise;

  assert(
    waitingNotice.hostName === 'Alice (Host)',
    '3. Guest Bob received waiting-for-admission notice with host name'
  );
  assert(
    knockNotice.displayName === 'Bob Guest' && knockNotice.socketId === bob.id,
    '4. Host Alice received participant-knock-request with Bob details'
  );

  // 3. Host Alice admits Bob -> Bob receives admitted-to-room
  const bobAdmittedPromise = new Promise((resolve) => bob.on('admitted-to-room', resolve));
  alice.emit('admit-participant', { targetSocketId: bob.id });
  const admittedEvent = await bobAdmittedPromise;

  assert(
    admittedEvent.self.displayName === 'Bob Guest',
    '5. Bob received admitted-to-room event and transitioned into call'
  );

  // 4. Second guest (Charlie) joins -> Host denies Charlie
  const charlie = Client(SIGNALING_URL, { transports: ['websocket'] });
  await new Promise((resolve) => charlie.on('connect', resolve));

  const charlieWaitingPromise = new Promise((resolve) => charlie.on('waiting-for-admission', resolve));
  charlie.emit('join-room', {
    meetingId,
    userId: 'usr_charlie_guest',
    displayName: 'Charlie Guest',
    role: 'PARTICIPANT',
  });
  await charlieWaitingPromise;

  const charlieDeniedPromise = new Promise((resolve) => charlie.on('denied-from-room', resolve));
  alice.emit('deny-participant', { targetSocketId: charlie.id });
  const denyNotice = await charlieDeniedPromise;

  assert(
    denyNotice.reason !== undefined,
    '6. Host denied Charlie: Charlie received denied-from-room notice'
  );

  // 5. Test Admit All with Dave & Eve
  const dave = Client(SIGNALING_URL, { transports: ['websocket'] });
  const eve = Client(SIGNALING_URL, { transports: ['websocket'] });
  await Promise.all([
    new Promise((resolve) => dave.on('connect', resolve)),
    new Promise((resolve) => eve.on('connect', resolve)),
  ]);

  const daveWait = new Promise((resolve) => dave.on('waiting-for-admission', resolve));
  const eveWait = new Promise((resolve) => eve.on('waiting-for-admission', resolve));

  dave.emit('join-room', { meetingId, userId: 'usr_dave', displayName: 'Dave' });
  eve.emit('join-room', { meetingId, userId: 'usr_eve', displayName: 'Eve' });
  await Promise.all([daveWait, eveWait]);

  const daveAdmit = new Promise((resolve) => dave.on('admitted-to-room', resolve));
  const eveAdmit = new Promise((resolve) => eve.on('admitted-to-room', resolve));

  alice.emit('admit-all');
  await Promise.all([daveAdmit, eveAdmit]);

  assert(true, '7. Host executed Admit All: Dave and Eve both admitted successfully');

  // Cleanup
  alice.disconnect();
  bob.disconnect();
  charlie.disconnect();
  dave.disconnect();
  eve.disconnect();
  ioServer.close();
  server.close();

  console.log('\n================================');
  console.log(`Waiting Room Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================\n');

  if (failed > 0) process.exit(1);
}

runWaitingRoomTests().catch((err) => {
  console.error('Waiting room test failed:', err);
  process.exit(1);
});
