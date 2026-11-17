"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import PermissionsCheck from "@/components/PermissionsCheck";
import MeetingRoom from "@/components/MeetingRoom";
import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";

function MeetingPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomId = (params?.roomId as string) || "";
  const initialName = searchParams.get("name") || "";

  const [hasCheckedPermissions, setHasCheckedPermissions] = useState(false);
  const [username, setUsername] = useState(initialName);
  const [initialVideo, setInitialVideo] = useState(true);
  const [initialAudio, setInitialAudio] = useState(true);

  const [isFetchingToken, setIsFetchingToken] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const liveKitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  const fetchTokenAndJoin = async (nameToUse: string) => {
    setIsFetchingToken(true);
    setError(null);

    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomId,
          username: nameToUse,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate access token.");
      }

      if (!data.token) {
        throw new Error("No token returned by the server.");
      }

      setToken(data.token);
    } catch (err: any) {
      console.error("Token fetch error:", err);
      setError(
        err?.message ||
          "Could not obtain LiveKit access token. Please verify your LiveKit credentials in .env.local"
      );
    } finally {
      setIsFetchingToken(false);
    }
  };

  const handleReadyToJoin = (choices: {
    username: string;
    videoEnabled: boolean;
    audioEnabled: boolean;
  }) => {
    setUsername(choices.username);
    setInitialVideo(choices.videoEnabled);
    setInitialAudio(choices.audioEnabled);
    setHasCheckedPermissions(true);
    fetchTokenAndJoin(choices.username);
  };

  const handleLeave = () => {
    setToken(null);
    router.push("/");
  };

  // If room ID is missing or invalid
  if (!roomId) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Invalid Room ID</h1>
        <p className="text-slate-400 text-sm mb-6">
          A valid Meeting Room ID is required to join a call.
        </p>
        <Link
          href="/"
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  // Phase 1: Device Permissions & Audio/Video selection
  if (!hasCheckedPermissions) {
    return (
      <PermissionsCheck
        roomId={roomId}
        initialUsername={username}
        onReadyToJoin={handleReadyToJoin}
        onCancel={() => router.push("/")}
      />
    );
  }

  // Phase 2: Generating Token / Connecting
  if (isFetchingToken) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <h2 className="text-xl font-semibold text-white mb-1">Connecting to Meeting</h2>
        <p className="text-slate-400 text-sm">Securing your LiveKit connection...</p>
      </div>
    );
  }

  // Phase 3: Token Generation Error
  if (error || !token) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Connection Error</h2>
        <p className="text-slate-400 max-w-md mb-6 text-sm">
          {error || "Unable to join the meeting room."}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchTokenAndJoin(username)}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition"
          >
            Home
          </button>
        </div>
      </div>
    );
  }

  if (!liveKitUrl) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-amber-400 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Missing LiveKit URL</h2>
        <p className="text-slate-400 max-w-md text-sm mb-6">
          NEXT_PUBLIC_LIVEKIT_URL is not set in your .env.local configuration.
        </p>
        <Link
          href="/"
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  // Phase 4: Active Meeting Room
  return (
    <MeetingRoom
      roomId={roomId}
      token={token}
      liveKitUrl={liveKitUrl}
      initialVideo={initialVideo}
      initialAudio={initialAudio}
      onLeave={handleLeave}
    />
  );
}

export default function MeetingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      }
    >
      <MeetingPageContent />
    </Suspense>
  );
}
