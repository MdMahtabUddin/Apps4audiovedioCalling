"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Hash, User } from "lucide-react";
import Link from "next/link";

export default function JoinMeetingPage() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("livecall_username");
      if (saved) setUsername(saved);
    }
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let cleanRoom = roomId.trim();
    // If user pasted a URL, extract the roomId from it
    if (cleanRoom.includes("/meeting/")) {
      const parts = cleanRoom.split("/meeting/");
      cleanRoom = parts[1].split("?")[0].split("/")[0];
    }

    if (!cleanRoom) {
      setError("Please enter a valid Meeting ID");
      return;
    }

    const cleanName = username.trim() || "Guest";

    if (typeof window !== "undefined") {
      localStorage.setItem("livecall_username", cleanName);
    }

    // Redirect to the meeting room with display name encoded
    router.push(`/meeting/${encodeURIComponent(cleanRoom)}?name=${encodeURIComponent(cleanName)}`);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl relative z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Join Meeting</h1>
          <p className="text-sm text-slate-400">
            Enter the meeting details to join the conversation.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label htmlFor="roomId" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Meeting ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Hash className="w-4 h-4" />
              </div>
              <input
                id="roomId"
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="e.g. ABC123 or call-1a2b"
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="username" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Display Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Mahtab (or leave blank for Guest)"
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-4 py-3.5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2.5 transition-all duration-200 shadow-lg shadow-indigo-600/25 cursor-pointer"
          >
            <UserPlus className="w-5 h-5" />
            <span>Join Meeting</span>
          </button>
        </form>
      </div>
    </main>
  );
}
