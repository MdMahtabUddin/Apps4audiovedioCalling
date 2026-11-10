import http from 'http';

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
  console.log('🚀 Starting Phase 1 Integration Tests...\n');
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
    // 1. Health check
    const health = await request('/api/health');
    assert(health.status === 200 && health.body.status === 'ok', 'GET /api/health returns 200 { status: "ok" }');

    // 2. User registration
    const testEmail = `test_${Date.now()}@example.com`;
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Alex Johnson',
        email: testEmail,
        password: 'password123',
      }),
    });
    assert(regRes.status === 201 && regRes.body.user.email === testEmail, 'POST /api/auth/register creates user and sets auth cookie');

    // 3. Duplicate email prevention
    const dupRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Duplicate',
        email: testEmail,
        password: 'password123',
      }),
    });
    assert(dupRes.status === 409, 'POST /api/auth/register rejects duplicate email with 409 Conflict');

    // 4. Login with invalid password
    cookieJar = '';
    const badLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: 'wrongpassword',
      }),
    });
    assert(badLogin.status === 401, 'POST /api/auth/login rejects invalid password with 401 Unauthorized');

    // 5. Login with correct password
    const goodLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: 'password123',
      }),
    });
    assert(goodLogin.status === 200 && goodLogin.body.user.name === 'Alex Johnson', 'POST /api/auth/login succeeds and sets session');

    // 6. Verify authenticated session
    const meRes = await request('/api/auth/me');
    assert(meRes.status === 200 && meRes.body.user.email === testEmail, 'GET /api/auth/me retrieves current user session');

    // 7. Update profile
    const profileRes = await request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Alex J. Updated',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
      }),
    });
    assert(profileRes.status === 200 && profileRes.body.user.name === 'Alex J. Updated', 'PUT /api/auth/profile updates display name and avatar');

    // 8. Change password
    const changePass = await request('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: 'password123',
        newPassword: 'newsecurepass456',
      }),
    });
    assert(changePass.status === 200, 'PUT /api/auth/password verifies current password and sets new password');

    // 9. Login with new password
    cookieJar = '';
    const loginNewPass = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: 'newsecurepass456',
      }),
    });
    assert(loginNewPass.status === 200, 'Login succeeds with updated password');

    // 10. Forgot password request
    const forgotRes = await request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: testEmail }),
    });
    assert(forgotRes.status === 200 && forgotRes.body.devToken, 'POST /api/auth/forgot-password issues reset token');

    // 11. Reset password using token
    const resetToken = forgotRes.body.devToken;
    const resetRes = await request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token: resetToken,
        newPassword: 'resetpassword789',
      }),
    });
    assert(resetRes.status === 200, 'POST /api/auth/reset-password successfully resets password via token');

    // 12. Login with reset password
    cookieJar = '';
    const loginReset = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: 'resetpassword789',
      }),
    });
    assert(loginReset.status === 200, 'Login succeeds with password reset through token');

    // 13. Create a meeting room
    const meetingRes = await request('/api/meetings', {
      method: 'POST',
      body: JSON.stringify({
        id: 'abc-defg-hij',
        title: 'Q4 Product Roadmap Discussion',
        waitingRoom: true,
      }),
    });
    assert(meetingRes.status === 201 && meetingRes.body.meeting.id === 'abc-defg-hij', 'POST /api/meetings creates new meeting room with settings');

    // 14. Schedule a future meeting
    const scheduleRes = await request('/api/meetings/schedule', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Weekly All Hands Sync',
        date: new Date(Date.now() + 86400000).toISOString(),
        startTime: '14:00',
        duration: 45,
        timeZone: 'UTC',
        waitingRoom: true,
      }),
    });
    assert(scheduleRes.status === 201 && scheduleRes.body.scheduled.title === 'Weekly All Hands Sync', 'POST /api/meetings/schedule schedules upcoming meeting');

    // 15. Retrieve Dashboard Stats & Meetings
    const statsRes = await request('/api/dashboard/stats');
    assert(
      statsRes.status === 200 &&
      statsRes.body.recentMeetings.length > 0 &&
      statsRes.body.scheduledMeetings.length > 0,
      'GET /api/dashboard/stats returns user info, recent meetings, and upcoming scheduled meetings'
    );

    // 16. Logout
    const logoutRes = await request('/api/auth/logout', { method: 'POST' });
    assert(logoutRes.status === 200, 'POST /api/auth/logout clears session');

    // 17. Verify unauthenticated after logout
    const unauthCheck = await request('/api/auth/me');
    assert(unauthCheck.status === 401, 'GET /api/auth/me returns 401 Unauthorized after logout');

  } catch (error) {
    console.error('Test execution error:', error);
    failed++;
  }

  console.log(`\n================================`);
  console.log(`Phase 1 Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
