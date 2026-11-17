"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Video, UserPlus, Sparkles, User } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("livecall_username");
      if (saved) setUsername(saved);
    }
  }, []);

  // Generate a clean room ID (e.g., "call-7a9b3f" or 6-char formatted)
  const generateRoomId = () => {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let code1 = "";
    let code2 = "";
    for (let i = 0; i < 3; i++) {
      code1 += chars.charAt(Math.floor(Math.random() * chars.length));
      code2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${code1}-${code2}`;
  };

  const handleCreateMeeting = () => {
    setIsCreating(true);
    const newRoomId = generateRoomId();
    const finalName = username.trim() || "Host";
    if (typeof window !== "undefined") {
      localStorage.setItem("livecall_username", finalName);
    }
    router.push(`/meeting/${newRoomId}?creator=true&name=${encodeURIComponent(finalName)}`);
  };

  const handleJoinMeeting = () => {
    if (username.trim() && typeof window !== "undefined") {
      localStorage.setItem("livecall_username", username.trim());
    }
    router.push("/join");
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background Subtle Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl relative z-10 flex flex-col items-center text-center">
        {/* App Logo / Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-6">
          <Video className="w-8 h-8 text-white" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
          LiveCall
        </h1>
        <p className="text-sm text-slate-400 max-w-xs mb-6">
          Simple real-time voice and video calling powered by LiveKit and WebRTC.
        </p>

        {/* Name Input */}
        <div className="w-full mb-5 text-left">
          <label htmlFor="home-username" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
            Your Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <User className="w-4 h-4" />
            </div>
            <input
              id="home-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Mahtab (or leave blank for Host)"
              className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-3">
          <button
            type="button"
            onClick={handleCreateMeeting}
            disabled={isCreating}
            className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2.5 transition-all duration-200 shadow-lg shadow-indigo-600/25 cursor-pointer disabled:opacity-50"
          >
            <Video className="w-5 h-5" />
            <span>{isCreating ? "Creating Room..." : "Create Meeting"}</span>
          </button>

          <button
            type="button"
            onClick={handleJoinMeeting}
            className="w-full py-3.5 px-6 bg-slate-800 hover:bg-slate-700/80 text-slate-200 hover:text-white font-semibold rounded-xl border border-slate-700/60 flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer"
          >
            <UserPlus className="w-5 h-5 text-indigo-400" />
            <span>Join Meeting</span>
          </button>
        </div>

        {/* Feature Badges */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 w-full flex items-center justify-around text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Real-time Audio
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            HD Video
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            WebRTC
          </span>
        </div>
      </div>
    </main>
  );
}
