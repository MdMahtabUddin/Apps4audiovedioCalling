# VedioConferencingApplication-

## MeetFlow - Next.js Enterprise WebRTC Video Conferencing Platform

A production-ready video conferencing web application built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma ORM**, **PostgreSQL**, **WebRTC**, and **Socket.IO**.

---

### Core Tech Stack

- **Framework**: Next.js 16 (App Router) & React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS & Lucide Icons
- **Real-time Media**: WebRTC (Mesh Architecture, STUN/TURN NAT traversal)
- **Signaling**: Socket.IO
- **Database & ORM**: PostgreSQL with Prisma ORM
- **Authentication**: Salted Bcrypt Password Hashing + Cryptographically Signed JWT Sessions (HttpOnly, Secure Cookies)

---

### Phase 1 Features Implemented

1. **User Authentication & Profile**
   - User Registration with password strength indicators
   - Secure Login & JWT-based session cookies
   - Logout & token invalidation
   - Password reset via time-limited reset tokens
   - Profile management with customizable avatar presets
   - Password change with old credential validation

2. **Dashboard**
   - Live digital clock & date display inspired by Google Meet
   - Quick meeting action tiles (New Meeting, Join Meeting, Schedule Meeting, Hardware Check)
   - Personal Meeting Room (PMI) with permanent link
   - Search & filter past and upcoming meetings
   - Recent meeting history and scheduled syncs overview

3. **In-App Audio & Video Hardware Testing**
   - Live webcam preview with horizontal mirroring toggle
   - Real-time microphone input volume meter (Web Audio API)
   - Speaker test tone chime generator
   - Custom default preferences (mute on join, video off on join, 1080p HD)

---

### Getting Started

#### 1. Clone & Install Dependencies
```bash
git clone https://github.com/MdMahtabUddin/VedioConferencingApplication-.git
cd VedioConferencingApplication-
npm install
```

#### 2. Environment Variables
Create `.env` using `.env.example`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/meetflow?schema=public"
JWT_SECRET="your-secure-jwt-secret-key"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
STUN_SERVER="stun:stun.l.google.com:19302"
```

#### 3. Run Prisma & Start Dev Server
```bash
npx prisma generate
npm run dev
```

#### 4. Run Phase 1 Integration Tests
```bash
npm run build
npm run test:phase1
```
