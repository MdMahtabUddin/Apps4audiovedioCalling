"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, AlertCircle, CheckCircle2, User, ArrowRight } from "lucide-react";

interface PermissionsCheckProps {
  roomId: string;
  initialUsername: string;
  onReadyToJoin: (choices: {
    username: string;
    videoEnabled: boolean;
    audioEnabled: boolean;
  }) => void;
  onCancel: () => void;
}

export default function PermissionsCheck({
  roomId,
  initialUsername,
  onReadyToJoin,
  onCancel,
}: PermissionsCheckProps) {
  // Pre-fill username from initial, localStorage, or default "Participant"
  const [username, setUsername] = useState(() => {
    if (initialUsername && initialUsername.trim()) return initialUsername;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("livecall_username");
      if (saved && saved.trim()) return saved;
    }
    return "User " + Math.floor(100 + Math.random() * 900);
  });

  const [isChecking, setIsChecking] = useState(true);

  // Permission states
  const [cameraAllowed, setCameraAllowed] = useState(false);
  const [micAllowed, setMicAllowed] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  // User toggles for initial room join
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isMounted = true;

    // Safety timeout: never let checking hang longer than 2.5 seconds
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsChecking(false);
      }
    }, 2500);

    async function checkPermissions() {
      setIsChecking(true);
      setCameraError(null);
      setMicError(null);

      let camOk = false;
      let micOk = false;
      let stream: MediaStream | null = null;

      // 1. Try requesting both camera and audio
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          camOk = true;
          micOk = true;
        }
      } catch (err: any) {
        console.warn("Combined media request failed, testing individually:", err);

        // Check audio separately
        try {
          if (navigator.mediaDevices) {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micOk = true;
            audioStream.getTracks().forEach((track) => track.stop());
          }
        } catch (audioErr: any) {
          micOk = false;
          setMicError("Microphone permission or device not detected.");
        }

        // Check camera separately
        try {
          if (navigator.mediaDevices) {
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            camOk = true;
            videoStream.getTracks().forEach((track) => track.stop());
          }
        } catch (videoErr: any) {
          camOk = false;
          setCameraError("Camera permission is required for video calling.");
        }

        // Try getting preview with whatever is available
        try {
          if ((camOk || micOk) && navigator.mediaDevices) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: camOk,
              audio: micOk,
            });
          }
        } catch (fallbackErr) {
          console.warn("Fallback preview stream failed:", fallbackErr);
        }
      }

      clearTimeout(safetyTimer);

      if (!isMounted) {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        return;
      }

      setCameraAllowed(camOk);
      setMicAllowed(micOk);
      setVideoEnabled(camOk);
      setAudioEnabled(micOk);

      if (stream) {
        activeStream = stream;
        setPreviewStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }

      setIsChecking(false);
    }

    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      checkPermissions();
    } else {
      clearTimeout(safetyTimer);
      setIsChecking(false);
      setCameraError("Media devices not supported or blocked in this browser.");
      setMicError("Media devices not supported or blocked in this browser.");
    }

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Update track enabled state when user toggles
  useEffect(() => {
    if (previewStream) {
      previewStream.getVideoTracks().forEach((t) => {
        t.enabled = videoEnabled && cameraAllowed;
      });
      previewStream.getAudioTracks().forEach((t) => {
        t.enabled = audioEnabled && micAllowed;
      });
    }
  }, [videoEnabled, audioEnabled, cameraAllowed, micAllowed, previewStream]);

  const handleJoin = () => {
    const finalName = username.trim() || "Participant";

    if (typeof window !== "undefined") {
      localStorage.setItem("livecall_username", finalName);
    }

    // Stop preview stream so LiveKit can take control of media devices
    if (previewStream) {
      previewStream.getTracks().forEach((track) => track.stop());
    }

    onReadyToJoin({
      username: finalName,
      videoEnabled: cameraAllowed && videoEnabled,
      audioEnabled: micAllowed && audioEnabled,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-1">Ready to join?</h1>
          <p className="text-sm text-slate-400">
            Room ID: <span className="font-mono text-indigo-400 font-bold px-2 py-0.5 bg-indigo-500/10 rounded">{roomId}</span>
          </p>
        </div>

        {/* Video Preview Box */}
        <div className="relative aspect-video w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 mb-5 flex items-center justify-center shadow-inner">
          {videoEnabled && cameraAllowed ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500 p-4 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-2">
                <User className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-xs font-medium text-slate-400">
                {!cameraAllowed ? "Camera not detected or permitted" : "Camera turned off"}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                You will join in voice-only mode
              </p>
            </div>
          )}

          {/* Floating preview controls */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700/60 shadow-lg">
            <button
              type="button"
              onClick={() => setAudioEnabled(!audioEnabled)}
              title={audioEnabled && micAllowed ? "Mute Microphone" : "Unmute Microphone"}
              className={`p-2.5 rounded-full transition-all ${
                audioEnabled && micAllowed
                  ? "bg-slate-700 hover:bg-slate-600 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
              }`}
            >
              {audioEnabled && micAllowed ? (
                <Mic className="w-4 h-4" />
              ) : (
                <MicOff className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setVideoEnabled(!videoEnabled)}
              title={videoEnabled && cameraAllowed ? "Turn off Camera" : "Turn on Camera"}
              className={`p-2.5 rounded-full transition-all ${
                videoEnabled && cameraAllowed
                  ? "bg-slate-700 hover:bg-slate-600 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
              }`}
            >
              {videoEnabled && cameraAllowed ? (
                <Video className="w-4 h-4" />
              ) : (
                <VideoOff className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Permission Warnings / Status */}
        <div className="space-y-2.5 mb-5">
          {cameraError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <p className="font-semibold">{cameraError}</p>
                <p className="text-amber-400/80 mt-0.5">
                  You can still join the call with audio only.
                </p>
              </div>
            </div>
          )}

          {micError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <div>
                <p className="font-semibold">{micError}</p>
                <p className="text-red-400/80 mt-0.5">
                  Check your browser permissions or mic connection to speak.
                </p>
              </div>
            </div>
          )}

          {!cameraError && !micError && !isChecking && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Camera and microphone ready</span>
            </div>
          )}
        </div>

        {/* Name input */}
        <div className="mb-6">
          <label htmlFor="display-name" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
            Your Display Name
          </label>
          <input
            id="display-name"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm font-medium"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition text-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleJoin}
            className="flex-2 py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            <span>Join Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
