"use client";

import React, { useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { useLocalParticipant } from "@livekit/components-react";

interface ControlBarProps {
  onLeave: () => void;
}

export default function ControlBar({ onLeave }: ControlBarProps) {
  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } = useLocalParticipant();
  const [isTogglingMic, setIsTogglingMic] = useState(false);
  const [isTogglingCam, setIsTogglingCam] = useState(false);

  const toggleMicrophone = async () => {
    if (!localParticipant || isTogglingMic) return;
    try {
      setIsTogglingMic(true);
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err) {
      console.error("Failed to toggle microphone:", err);
    } finally {
      setIsTogglingMic(false);
    }
  };

  const toggleCamera = async () => {
    if (!localParticipant || isTogglingCam) return;
    try {
      setIsTogglingCam(true);
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err) {
      console.error("Failed to toggle camera:", err);
    } finally {
      setIsTogglingCam(false);
    }
  };

  return (
    <footer className="w-full bg-slate-950/90 backdrop-blur-md border-t border-slate-800/80 py-4 px-6 flex items-center justify-center shrink-0 z-30">
      <div className="flex items-center gap-6">
        {/* Microphone Button */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={toggleMicrophone}
            disabled={isTogglingMic}
            className={`w-13 h-13 p-3.5 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
              isMicrophoneEnabled
                ? "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600"
                : "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30"
            }`}
            title={isMicrophoneEnabled ? "Mute Microphone" : "Unmute Microphone"}
            aria-label={isMicrophoneEnabled ? "Mute Microphone" : "Unmute Microphone"}
          >
            {isMicrophoneEnabled ? (
              <Mic className="w-6 h-6" />
            ) : (
              <MicOff className="w-6 h-6" />
            )}
          </button>
          <span className="text-[11px] font-medium text-slate-400">
            {isMicrophoneEnabled ? "Mic On" : "Mic Off"}
          </span>
        </div>

        {/* Camera Button */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={toggleCamera}
            disabled={isTogglingCam}
            className={`w-13 h-13 p-3.5 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
              isCameraEnabled
                ? "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600"
                : "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30"
            }`}
            title={isCameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
            aria-label={isCameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
          >
            {isCameraEnabled ? (
              <Video className="w-6 h-6" />
            ) : (
              <VideoOff className="w-6 h-6" />
            )}
          </button>
          <span className="text-[11px] font-medium text-slate-400">
            {isCameraEnabled ? "Camera On" : "Camera Off"}
          </span>
        </div>

        {/* Leave Meeting Button */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={onLeave}
            className="w-13 h-13 p-3.5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all duration-200 shadow-lg shadow-red-600/40"
            title="Leave Meeting"
            aria-label="Leave Meeting"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
          <span className="text-[11px] font-medium text-slate-400">
            Leave
          </span>
        </div>
      </div>
    </footer>
  );
}
