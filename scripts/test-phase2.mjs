const BASE_URL = 'http://localhost:3001';

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let cookieJar = '';

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (cookieJar) {
    headers['Cookie'] = cookieJar;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const tokenPart = setCookie.split(';')[0];
    cookieJar = tokenPart;
  }

  let body = null;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { status: res.status, body, headers: res.headers };
}

async function runTests() {
  console.log('🚀 Starting Phase 2 (Create & Join Meeting) Integration Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Register host
    const hostEmail = `host_${Date.now()}@example.com`;
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Meeting Host Alice',
        email: hostEmail,
        password: 'password123',
      }),
    });
    assert(regRes.status === 201, 'Host user registered');
    const hostCookie = cookieJar;

    // 2. Create meeting with password and waiting room
    const testMeetingId = `sec-room-${Date.now().toString().slice(-4)}`;
    const createRes = await request('/api/meetings', {
      method: 'POST',
      body: JSON.stringify({
        id: testMeetingId,
        title: 'Executive Architecture Review',
        password: 'supersecretpass',
        waitingRoom: true,
      }),
    });
    assert(createRes.status === 201 && createRes.body.meeting.id === testMeetingId, 'Host creates secure meeting room');

    // 3. Host validates meeting
    const hostVal = await request(`/api/meetings/${testMeetingId}`);
    assert(
      hostVal.status === 200 &&
      hostVal.body.isHost === true &&
      hostVal.body.requiresPassword === false,
      'GET /api/meetings/:id identifies host with bypass privileges'
    );

    // 4. Guest (unauthenticated) validates meeting
    cookieJar = '';
    const guestVal = await request(`/api/meetings/${testMeetingId}`);
    assert(
      guestVal.status === 200 &&
      guestVal.body.isHost === false &&
      guestVal.body.requiresPassword === true &&
      guestVal.body.waitingRoom === true,
      'GET /api/meetings/:id informs guest that password & waiting room are required'
    );

    // 5. Test nonexistent meeting
    const notFoundRes = await request('/api/meetings/non-existent-room-9999');
    assert(notFoundRes.status === 404, 'GET /api/meetings/:id returns 404 for nonexistent room');

    // 6. Guest joins without password -> 401
    const noPassJoin = await request(`/api/meetings/${testMeetingId}/join`, {
      method: 'POST',
      body: JSON.stringify({ displayName: 'Guest Bob' }),
    });
    assert(noPassJoin.status === 401, 'POST /api/meetings/:id/join rejects missing password with 401');

    // 7. Guest joins with wrong password -> 401
    const badPassJoin = await request(`/api/meetings/${testMeetingId}/join`, {
      method: 'POST',
      body: JSON.stringify({ displayName: 'Guest Bob', password: 'wrongpasscode' }),
    });
    assert(badPassJoin.status === 401, 'POST /api/meetings/:id/join rejects invalid password with 401');

    // 8. Guest joins with correct password -> receives WAITING_ROOM status
    const goodJoin = await request(`/api/meetings/${testMeetingId}/join`, {
      method: 'POST',
      body: JSON.stringify({ displayName: 'Guest Bob', password: 'supersecretpass' }),
    });
    assert(
      goodJoin.status === 200 &&
      goodJoin.body.status === 'WAITING_ROOM' &&
      goodJoin.body.participant.role === 'PARTICIPANT',
      'POST /api/meetings/:id/join admits guest with correct password into WAITING_ROOM'
    );

    // 9. Host joins the meeting -> receives JOINED status immediately
    cookieJar = hostCookie;
    const hostJoin = await request(`/api/meetings/${testMeetingId}/join`, {
      method: 'POST',
      body: JSON.stringify({ displayName: 'Alice' }),
    });
    assert(
      hostJoin.status === 200 &&
      hostJoin.body.status === 'JOINED' &&
      hostJoin.body.participant.role === 'HOST',
      'POST /api/meetings/:id/join immediately approves host into meeting room'
    );

    // 10. Fetch room participants
    const partsRes = await request(`/api/meetings/${testMeetingId}/participants`);
    assert(
      partsRes.status === 200 &&
      partsRes.body.participants.length >= 2,
      'GET /api/meetings/:id/participants lists all room participants'
    );

    // 11. Unauthorized non-host cannot end meeting
    cookieJar = '';
    const unauthEnd = await request(`/api/meetings/${testMeetingId}/end`, { method: 'POST' });
    assert(unauthEnd.status === 401, 'POST /api/meetings/:id/end blocks unauthenticated user with 401');

    // 12. Host ends meeting
    cookieJar = hostCookie;
    const endRes = await request(`/api/meetings/${testMeetingId}/end`, { method: 'POST' });
    assert(endRes.status === 200 && endRes.body.success === true, 'POST /api/meetings/:id/end allows host to end meeting');

    // 13. Validate meeting after end -> 410 Ended
    const afterEnd = await request(`/api/meetings/${testMeetingId}`);
    assert(afterEnd.status === 410, 'GET /api/meetings/:id returns 410 for ended meeting');

  } catch (err) {
    console.error('Phase 2 test execution error:', err);
    failed++;
  }

  console.log(`\n================================`);
  console.log(`Phase 2 Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
