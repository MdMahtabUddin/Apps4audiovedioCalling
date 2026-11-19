'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Lock,
  Sliders,
  Check,
  ShieldCheck,
  Camera,
  Mic,
  Volume2,
  RefreshCw,
  VideoOff,
  MicOff,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserProfile } from '@/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUserUpdated?: (updated: UserProfile) => void;
}

export function SettingsModal({ isOpen, onClose, user, onUserUpdated }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'hardware' | 'preferences'>('profile');

  // Profile states
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Hardware states (Webcam & Mic test)
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [speakerTesting, setSpeakerTesting] = useState(false);

  // Preference states
  const [muteOnJoin, setMuteOnJoin] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('metromeet_mute_on_join') === 'true';
    }
    return false;
  });
  const [videoOffOnJoin, setVideoOffOnJoin] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('metromeet_video_off_on_join') === 'true';
    }
    return false;
  });
  const [mirrorVideo, setMirrorVideo] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('metromeet_mirror_video') !== 'false';
    }
    return true;
  });
  const [hdVideo, setHdVideo] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('metromeet_hd_video') !== 'false';
    }
    return true;
  });

  const avatarPresets = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Alexander',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia',
  ];

  // Stop media tracks when modal closes or tab switches
  const stopMedia = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setCameraActive(false);
    setMicActive(false);
    setMicLevel(0);
  };

  useEffect(() => {
    if (!isOpen) {
      stopMedia();
    }
    return () => {
      stopMedia();
    };
  }, [isOpen]);

  // Start Hardware Test (Webcam & Mic)
  const startHardwareTest = async () => {
    stopMedia();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
      setMicActive(true);

      // Set up Audio Level Meter
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setMicLevel(normalized);
        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch (err) {
      console.warn('Could not access media devices for test:', err);
      setCameraActive(false);
      setMicActive(false);
    }
  };

  // Play test sound for speaker check
  const playTestSound = () => {
    try {
      setSpeakerTesting(true);
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);

      setTimeout(() => {
        setSpeakerTesting(false);
        ctx.close().catch(() => {});
      }, 500);
    } catch {
      setSpeakerTesting(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileError('');
    setIsUpdatingProfile(true);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, avatar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      setProfileMsg('Profile updated successfully');
      onUserUpdated?.(data.user);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setProfileError(err.message);
      } else {
        setProfileError('An unexpected error occurred');
      }
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');

      setPasswordMsg('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setPasswordError(err.message);
      } else {
        setPasswordError('An unexpected error occurred');
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSavePreferences = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('metromeet_mute_on_join', String(muteOnJoin));
      localStorage.setItem('metromeet_video_off_on_join', String(videoOffOnJoin));
      localStorage.setItem('metromeet_mirror_video', String(mirrorVideo));
      localStorage.setItem('metromeet_hd_video', String(hdVideo));
    }
    stopMedia();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        stopMedia();
        onClose();
      }}
      title="Settings & Audio/Vedio Testing"
      description="Configure your profile, check devices, and adjust meeting preferences"
      className="max-w-2xl"
    >
      {/* Tabs */}
      <div className="flex border-b border-gray-800 mb-5 overflow-x-auto">
        <button
          onClick={() => {
            stopMedia();
            setActiveTab('profile');
          }}
          className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors shrink-0 ${
            activeTab === 'profile'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <User className="h-3.5 w-3.5" />
          Profile
        </button>
        <button
          onClick={() => {
            stopMedia();
            setActiveTab('hardware');
            startHardwareTest();
          }}
          className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors shrink-0 ${
            activeTab === 'hardware'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Camera className="h-3.5 w-3.5" />
          Camera & Audio Test
        </button>
        <button
          onClick={() => {
            stopMedia();
            setActiveTab('preferences');
          }}
          className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors shrink-0 ${
            activeTab === 'preferences'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          Meeting Defaults
        </button>
        <button
          onClick={() => {
            stopMedia();
            setActiveTab('security');
          }}
          className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors shrink-0 ${
            activeTab === 'security'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Lock className="h-3.5 w-3.5" />
          Security
        </button>
      </div>

      {/* Tab 1: Profile */}
      {activeTab === 'profile' && (
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          {profileMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
              {profileMsg}
            </div>
          )}
          {profileError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {profileError}
            </div>
          )}

          <div className="flex items-center gap-4 pb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'}
              alt="Avatar"
              className="h-16 w-16 rounded-full border-2 border-indigo-500/40 object-cover bg-gray-800 shadow-md"
            />
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-300">Select an Avatar Preset:</p>
              <div className="flex flex-wrap gap-2">
                {avatarPresets.map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAvatar(preset)}
                    className={`rounded-full p-0.5 border-2 transition-all ${
                      avatar === preset ? 'border-indigo-500 scale-110' : 'border-transparent hover:border-gray-600'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preset} alt="preset" className="h-7 w-7 rounded-full bg-gray-800" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Input
            id="profile-name"
            label="Display Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-300">Account Email</label>
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-gray-800 bg-gray-950/50 text-xs text-gray-400">
              <span>{user.email}</span>
              <Badge variant="success" dot>
                Verified Account
              </Badge>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-800 flex justify-end gap-3">
            <Button type="submit" isLoading={isUpdatingProfile}>
              Save Changes
            </Button>
          </div>
        </form>
      )}

      {/* Tab 2: Hardware Test (Webcam & Mic) */}
      {activeTab === 'hardware' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Video preview tile */}
            <div className="relative aspect-video rounded-xl bg-gray-950 border border-gray-800 overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${mirrorVideo ? 'scale-x-[-1]' : ''} ${
                  cameraActive ? 'opacity-100' : 'opacity-0'
                }`}
              />
              {!cameraActive && (
                <div className="absolute flex flex-col items-center gap-2 text-gray-500">
                  <VideoOff className="h-8 w-8" />
                  <span className="text-xs">Camera preview off</span>
                </div>
              )}
              {cameraActive && (
                <div className="absolute top-2 left-2">
                  <Badge variant="success" dot>
                    Live Preview
                  </Badge>
                </div>
              )}
            </div>

            {/* Audio & Controls */}
            <div className="flex flex-col justify-between space-y-3">
              <div className="space-y-3">
                {/* Microphone Level Meter */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-gray-300 flex items-center gap-1.5">
                      <Mic className="h-3.5 w-3.5 text-indigo-400" />
                      Microphone Input
                    </span>
                    <span className="text-gray-400 text-[11px] font-mono">{micLevel}%</span>
                  </div>
                  <div className="h-3 w-full bg-gray-950 rounded-full overflow-hidden border border-gray-800 p-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-400"
                      style={{ width: `${micLevel}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-500">Speak into your mic to test levels</p>
                </div>

                {/* Speaker Test */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-gray-300 flex items-center gap-1.5">
                      <Volume2 className="h-3.5 w-3.5 text-indigo-400" />
                      Speaker Output
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full text-xs"
                    onClick={playTestSound}
                    isLoading={speakerTesting}
                  >
                    Play Chime Test Tone
                  </Button>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-800">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={startHardwareTest}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Restart Device Test
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Preferences */}
      {activeTab === 'preferences' && (
        <div className="space-y-4">
          <div className="space-y-3 pt-1">
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-gray-800 bg-gray-900/50 cursor-pointer hover:border-gray-700 transition-colors">
              <div>
                <p className="text-xs font-semibold text-gray-200">Mute microphone when joining</p>
                <p className="text-[11px] text-gray-400">Audio will be turned off by default upon entering room</p>
              </div>
              <input
                type="checkbox"
                checked={muteOnJoin}
                onChange={(e) => setMuteOnJoin(e.target.checked)}
                className="h-4 w-4 rounded border-gray-700 bg-gray-900 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-gray-800 bg-gray-900/50 cursor-pointer hover:border-gray-700 transition-colors">
              <div>
                <p className="text-xs font-semibold text-gray-200">Turn camera off when joining</p>
                <p className="text-[11px] text-gray-400">Vedio feed will start disabled upon entry</p>
              </div>
              <input
                type="checkbox"
                checked={videoOffOnJoin}
                onChange={(e) => setVideoOffOnJoin(e.target.checked)}
                className="h-4 w-4 rounded border-gray-700 bg-gray-900 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-gray-800 bg-gray-900/50 cursor-pointer hover:border-gray-700 transition-colors">
              <div>
                <p className="text-xs font-semibold text-gray-200">Mirror my vedio preview</p>
                <p className="text-[11px] text-gray-400">Flips your local vedio tile horizontally for natural view</p>
              </div>
              <input
                type="checkbox"
                checked={mirrorVideo}
                onChange={(e) => setMirrorVideo(e.target.checked)}
                className="h-4 w-4 rounded border-gray-700 bg-gray-900 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-gray-800 bg-gray-900/50 cursor-pointer hover:border-gray-700 transition-colors">
              <div>
                <p className="text-xs font-semibold text-gray-200">High Definition (HD) 1080p</p>
                <p className="text-[11px] text-gray-400">Requests 1080p stream from webcam when bandwidth allows</p>
              </div>
              <input
                type="checkbox"
                checked={hdVideo}
                onChange={(e) => setHdVideo(e.target.checked)}
                className="h-4 w-4 rounded border-gray-700 bg-gray-900 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>

          <div className="pt-3 border-t border-gray-800 flex justify-end gap-3">
            <Button onClick={handleSavePreferences}>Save Preferences</Button>
          </div>
        </div>
      )}

      {/* Tab 4: Security */}
      {activeTab === 'security' && (
        <form onSubmit={handleChangePassword} className="space-y-4">
          {passwordMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
              {passwordMsg}
            </div>
          )}
          {passwordError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {passwordError}
            </div>
          )}

          <Input
            id="curr-pass"
            type="password"
            label="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />

          <Input
            id="new-pass"
            type="password"
            label="New Password"
            placeholder="At least 6 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <Input
            id="conf-new-pass"
            type="password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <div className="pt-3 border-t border-gray-800 flex justify-end gap-3">
            <Button type="submit" isLoading={isUpdatingPassword}>
              Update Password
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
