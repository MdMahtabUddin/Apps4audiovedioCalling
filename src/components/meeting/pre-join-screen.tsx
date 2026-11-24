'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  VideoOff,
  Mic,
  MicOff,
  Settings,
  Shield,
  Lock,
  ArrowRight,
  AlertCircle,
  Clock,
  Sparkles,
  Users,
  ChevronDown,
  Volume2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BrandLogo } from '@/components/ui/brand-logo';
import { ThemeToggle } from '@/components/theme/theme-provider';
import { useVideo } from '@/lib/webrtc/video-provider';
import { useMeeting } from '@/lib/meeting/meeting-provider';
import { MeetingValidationResponse } from '@/types';

interface PreJoinScreenProps {
  meetingInfo: MeetingValidationResponse;
  initialName?: string;
  onJoinSuccess: () => void;
}

export function PreJoinScreen({ meetingInfo, initialName = '', onJoinSuccess }: PreJoinScreenProps) {
  const {
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    micVolume,
    availableDevices,
    selectedAudioInput,
    selectedVideoInput,
    selectedAudioOutput,
    toggleAudio,
    toggleVideo,
    initializeLocalMedia,
    stopAllMedia,
    switchCamera,
    switchMicrophone,
    switchSpeaker,
  } = useVideo();

  const { joinRoom } = useMeeting();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [displayName, setDisplayName] = useState(initialName || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [permissionError, setPermissionError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);

  // Initialize camera and mic preview on mount
  useEffect(() => {
    let active = true;
    initializeLocalMedia(true, true).then((stream) => {
      if (!stream && active) {
        setPermissionError('Camera or microphone permission was blocked or unavailable.');
      }
    });

    return () => {
      active = false;
      stopAllMedia();
    };
  }, [initializeLocalMedia, stopAllMedia]);

  // Attach local stream to video element
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
      videoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  const isHostUser =
    Boolean(meetingInfo.isHost) ||
    (typeof window !== 'undefined' && localStorage.getItem(`metromeet_host_${meetingInfo.id}`) === 'true');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!displayName.trim()) {
      setError('Please enter your display name.');
      return;
    }

    if (meetingInfo.requiresPassword && !password.trim()) {
      setError('This meeting requires a password.');
      return;
    }

    setIsJoining(true);
    const res = await joinRoom(displayName.trim(), password.trim() || undefined, isHostUser);
    setIsJoining(false);

    if (!res.success) {
      setError(res.error || 'Failed to join meeting.');
    } else {
      stopAllMedia();
      onJoinSuccess();
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 flex items-center justify-center p-4 sm:p-6 lg:p-10 relative transition-colors duration-200">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fade-up">
        {/* Left Side: Clean Video Preview & Controls (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col items-center space-y-4">
          <div className="relative w-full aspect-video rounded-2xl bg-slate-900 dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] shadow-xl shadow-slate-900/10 dark:shadow-black/60 overflow-hidden flex items-center justify-center">
            {/* Live Video */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
                isVideoEnabled && localStream ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Video Off Placeholder */}
            {(!isVideoEnabled || !localStream) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-[#0a0d16]">
                <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-indigo-600/30 to-purple-600/30 border border-indigo-500/30 flex items-center justify-center text-3xl font-extrabold text-indigo-300 shadow-xl">
                  {displayName ? displayName.charAt(0).toUpperCase() : 'ME'}
                </div>
                <p className="text-xs font-semibold text-gray-400">Camera is turned off</p>
              </div>
            )}

            {/* Speaking / Audio Meter Pill */}
            {isAudioEnabled && (
              <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 shadow-lg">
                <Mic className="h-3.5 w-3.5 text-emerald-400" />
                <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-indigo-400 transition-all duration-75 rounded-full"
                    style={{ width: `${micVolume}%` }}
                  />
                </div>
              </div>
            )}

            {/* Top Right: Status Badge */}
            <div className="absolute top-4 right-4">
              <Badge variant={isVideoEnabled ? 'success' : 'default'} dot={isVideoEnabled}>
                {isVideoEnabled ? 'Preview Active' : 'Camera Off'}
              </Badge>
            </div>
          </div>

          {/* Floating Device Controls Pill */}
          <div className="flex items-center gap-3 p-2 bg-[#0c101c]/90 border border-white/[0.08] backdrop-blur-xl rounded-2xl shadow-xl">
            {/* Mic Toggle */}
            <button
              onClick={toggleAudio}
              className={`h-11 px-4 rounded-xl flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                isAudioEnabled
                  ? 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
              }`}
            >
              {isAudioEnabled ? (
                <>
                  <Mic className="h-4 w-4 text-emerald-400" />
                  <span>Mic On</span>
                </>
              ) : (
                <>
                  <MicOff className="h-4 w-4" />
                  <span>Mic Off</span>
                </>
              )}
            </button>

            {/* Camera Toggle */}
            <button
              onClick={toggleVideo}
              className={`h-11 px-4 rounded-xl flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                isVideoEnabled
                  ? 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
              }`}
            >
              {isVideoEnabled ? (
                <>
                  <Camera className="h-4 w-4 text-emerald-400" />
                  <span>Camera On</span>
                </>
              ) : (
                <>
                  <VideoOff className="h-4 w-4" />
                  <span>Camera Off</span>
                </>
              )}
            </button>

            {/* Device Settings Toggle */}
            <button
              onClick={() => setShowDeviceSettings(!showDeviceSettings)}
              className="h-11 w-11 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-gray-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Select microphone, camera, and speakers"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          {/* Device Settings Drawer */}
          {showDeviceSettings && (
            <div className="w-full p-4 rounded-2xl bg-[#0c101c] border border-white/[0.08] shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-400">Microphone</label>
                <select
                  value={selectedAudioInput}
                  onChange={(e) => switchMicrophone(e.target.value)}
                  className="w-full bg-black/40 border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-gray-200 outline-none focus:border-indigo-500"
                >
                  {availableDevices.audioInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-400">Camera</label>
                <select
                  value={selectedVideoInput}
                  onChange={(e) => switchCamera(e.target.value)}
                  className="w-full bg-black/40 border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-gray-200 outline-none focus:border-indigo-500"
                >
                  {availableDevices.videoInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {permissionError && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{permissionError}</span>
            </div>
          )}
        </div>

        {/* Right Side: Clean Meeting Info & Join Form (5 Cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#111114] border border-slate-200/90 dark:border-white/[0.08] shadow-xl shadow-slate-900/[0.06] dark:shadow-black/50 p-6 sm:p-7 space-y-6 transition-colors duration-200">
          <div>
            <BrandLogo size="md" showTagline={true} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-600/10 border border-blue-200/80 dark:border-blue-500/20">
                Ready to join
              </span>
              {meetingInfo.waitingRoom && (
                <Badge variant="orange">Waiting Room</Badge>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{meetingInfo.title}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <span className="font-mono text-slate-700 dark:text-zinc-300">{meetingInfo.id}</span>
              <span>•</span>
              <span>Hosted by <strong className="text-slate-900 dark:text-zinc-200 font-medium">{meetingInfo.hostName}</strong></span>
            </div>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-xs text-rose-600 dark:text-rose-300 font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Input
              id="join-display-name"
              label="Your name"
              placeholder="e.g. Alex Johnson"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />

            {meetingInfo.requiresPassword && (
              <Input
                id="join-passcode"
                type="password"
                label="Room passcode"
                placeholder="Enter meeting password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full h-11 text-sm font-semibold mt-1"
              isLoading={isJoining}
            >
              {isHostUser ? 'Join as Host' : (meetingInfo.waitingRoom ? 'Ask to Join' : 'Join Meeting')}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </form>

          {meetingInfo.waitingRoom && (
            <div className="pt-4 border-t border-white/[0.06] text-xs text-zinc-400">
              <p className="text-[11px] text-amber-300/85">
                Waiting room is enabled. You will enter once the host admits you.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
