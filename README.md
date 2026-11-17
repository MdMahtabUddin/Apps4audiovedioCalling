# LiveCall - Real-time Voice and Video Calling Web Application

A minimalist, high-performance real-time video and audio calling application built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, and **LiveKit WebRTC**.

---

## Features

- **Home Page**: Clean interface to quickly create or join a meeting room.
- **Create Meeting**: Instant unique room ID generation and automatic participant token issuance.
- **Join Meeting**: Dedicated join screen with meeting ID and display name input.
- **Permissions Handling**:
  - Automatically requests camera and microphone permissions before joining.
  - Clear user-friendly alerts if permission is denied.
  - Supports joining with audio-only if camera permission is rejected.
- **Real-Time Video & Audio Calls**:
  - WebRTC mesh/SFU powered by LiveKit for low latency and high quality.
  - Responsive video grid that dynamically scales from 1 participant to multiple participants.
  - Video and voice-only participant tiles with glowing active-speaker indicator.
- **Call Controls**:
  - 🎤 Toggle Microphone ON / OFF with clear visual status.
  - 📹 Toggle Camera ON / OFF with clear visual status.
  - 🔴 Leave Meeting button that cleanly disconnects from LiveKit, stops local media hardware, and returns to home.
- **Secure Server-side Token Minting**:
  - `POST /api/token` generates signed JWT tokens using server-only `LIVEKIT_API_SECRET`.
  - Credentials are never exposed to the client browser.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **WebRTC Engine**: LiveKit Client SDK (`livekit-client`, `@livekit/components-react`)
- **Token Generation**: LiveKit Server SDK (`livekit-server-sdk`)
- **Icons**: Lucide React

---

## Project Structure

```
livekit-call-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── token/
│   │   │       └── route.ts          # Server-side LiveKit JWT token generator
│   │   ├── join/
│   │   │   └── page.tsx              # Join meeting form
│   │   ├── meeting/
│   │   │   └── [roomId]/
│   │   │       └── page.tsx          # Meeting room page with permissions & live call
│   │   ├── globals.css               # Global Tailwind CSS styles
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Home page
│   ├── components/
│   │   ├── ControlBar.tsx            # Mic, Camera, and Leave control buttons
│   │   ├── MeetingRoom.tsx           # LiveKit room manager & responsive video layout
│   │   ├── ParticipantTile.tsx       # Participant video/voice-only tile with audio indicator
│   │   └── PermissionsCheck.tsx      # Pre-join camera/mic permissions & preview screen
│   └── types/
│       └── meeting.ts                # TypeScript interfaces for API & state
├── .env.example                      # Example environment variables
├── .env.local                        # Local environment file (add your credentials here)
├── next.config.mjs
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## Getting Started

### 1. Install Dependencies

Open a terminal in the project directory and install the packages:

```bash
cd "C:\Users\MAHTAB\.gemini\antigravity\scratch\livekit-call-app"
npm install
```

### 2. Creating LiveKit Credentials

You can use **LiveKit Cloud** (free tier includes 50GB bandwidth/month):

1. Go to [https://cloud.livekit.io](https://cloud.livekit.io) and create a free account.
2. Create a new project (e.g. `livecall-app`).
3. In the project dashboard, go to **Settings** -> **Keys**.
4. Generate a new API Key pair:
   - **WebSocket URL**: e.g., `wss://your-project-subdomain.livekit.cloud`
   - **API Key**: e.g., `APIxxxxxxxx`
   - **API Secret**: e.g., `secretxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

*(Alternatively, you can run a local LiveKit server with Docker using `docker run --rm -p 7880:7880 livekit/livekit-server --dev`).*

### 3. Configuring `.env.local`

Create or edit `.env.local` in the project root:

```env
# LiveKit Server URL (starts with wss:// for cloud or ws:// for local)
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project-subdomain.livekit.cloud

# LiveKit API Key & Secret (Keep SECRET private - never expose to browser)
LIVEKIT_API_KEY=your_api_key_here
LIVEKIT_API_SECRET=your_api_secret_here
```

### 4. Running the Application

Start the Next.js development server:

```bash
npm run dev
```

Open your browser and navigate to:
[http://localhost:3000](http://localhost:3000)

---

## Testing Real-Time Voice & Video Calling

### Testing with Two Browser Tabs (Same Machine)

1. Open **Tab 1**:
   - Go to `http://localhost:3000`.
   - Click **Create Meeting**.
   - Grant camera & microphone permissions when prompted in the browser.
   - Enter your name (e.g. `User A`) and click **Join Now**.
   - Note or copy the Meeting ID shown in the header (e.g., `abc-123`).

2. Open **Tab 2** (or an Incognito/Private window):
   - Go to `http://localhost:3000` and click **Join Meeting** (or open `http://localhost:3000/join`).
   - Enter the Meeting ID from Tab 1 and a different display name (e.g. `User B`).
   - Click **Join Meeting**.
   - When the preview screen opens, grant permissions and click **Join Now**.

3. **Verify Call**:
   - Both tabs should connect to the same LiveKit room.
   - Tab 1 displays User B's video stream; Tab 2 displays User A's video stream.
   - Test muting the microphone on Tab 1: Tab 2 immediately updates the status to muted.
   - Test turning off the camera: the tile switches seamlessly to the Voice-Only UI with the user's initials.
   - Test speaking: the active speaker's tile highlights with a green border and pulse animation.
   - Click **Leave**: the user is disconnected from the room and redirected to the home page.

---

### Testing with Two Different Devices (e.g., Laptop & Phone)

WebRTC and browser `navigator.mediaDevices.getUserMedia` require a secure context (`https://` or `localhost`). To test across two devices on the same Wi-Fi network:

1. **Option A: Next.js Experimental HTTPS (Recommended for local dev)**:
   Run Next.js with self-signed certificate:
   ```bash
   npx next dev --experimental-https
   ```
   Open `https://<YOUR_LOCAL_IP>:3000` on both your computer and your phone (accept the self-signed certificate warning on your mobile browser).

2. **Option B: Using a Tunnel (e.g. Cloudflare Tunnels or Ngrok)**:
   ```bash
   npx localtunnel --port 3000
   ```
   or
   ```bash
   ngrok http 3000
   ```
   Open the generated HTTPS URL on both your laptop and phone, join the same meeting room, and test audio/video between both physical devices.
