'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { getConnectedDevices, AvailableDevices, requestMediaStream } from './devices';
import { WebRTCMeshManager, NetworkQuality, RemoteParticipantStream } from './webrtc-mesh';

export interface VideoContextType {
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  availableDevices: AvailableDevices;
  selectedAudioInput: string;
  selectedVideoInput: string;
  selectedAudioOutput: string;
  micVolume: number;
  // Phase 3 WebRTC Mesh additions
  remoteStreams: Map<string, MediaStream>;
  activeSpeakerId: string | null;
  dominantVolume: number;
  networkQuality: Map<string, NetworkQuality>;
  connectToPeer: (peerId: string) => Promise<RTCSessionDescriptionInit>;
  handlePeerOffer: (peerId: string, offer: RTCSessionDescriptionInit) => Promise<RTCSessionDescriptionInit>;
  handlePeerAnswer: (peerId: string, answer: RTCSessionDescriptionInit) => Promise<void>;
  handlePeerIceCandidate: (peerId: string, candidate: RTCIceCandidateInit) => Promise<void>;
  registerIceCandidateHandler: (cb: (peerId: string, candidate: RTCIceCandidate) => void) => void;
  disconnectPeer: (peerId: string) => void;
  // Controls
  toggleAudio: () => boolean;
  toggleVideo: () => boolean;
  startScreenShare: () => Promise<MediaStream | null>;
  stopScreenShare: () => void;
  switchCamera: (deviceId: string) => Promise<void>;
  switchMicrophone: (deviceId: string) => Promise<void>;
  switchSpeaker: (deviceId: string) => Promise<void>;
  initializeLocalMedia: (audio?: boolean, video?: boolean) => Promise<MediaStream | null>;
  stopAllMedia: () => void;
}

const VideoContext = createContext<VideoContextType | null>(null);

export function VideoProvider({ children }: { children: React.ReactNode }) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [availableDevices, setAvailableDevices] = useState<AvailableDevices>({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: [],
  });
  const [selectedAudioInput, setSelectedAudioInput] = useState('');
  const [selectedVideoInput, setSelectedVideoInput] = useState('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState('');
  const [micVolume, setMicVolume] = useState(0);

  // WebRTC Mesh state
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [dominantVolume, setDominantVolume] = useState(0);
  const [networkQuality, setNetworkQuality] = useState<Map<string, NetworkQuality>>(new Map());

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const meshManagerRef = useRef<WebRTCMeshManager | null>(null);
  const iceCandidateCallbackRef = useRef<((peerId: string, candidate: RTCIceCandidate) => void) | null>(null);

  // Initialize WebRTC Mesh Manager
  useEffect(() => {
    const mesh = new WebRTCMeshManager({
      onRemoteStream: (peerId, stream) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.set(peerId, stream);
          return next;
        });
      },
      onRemoteTrackRemoved: (peerId) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          // If all tracks removed, clean up or keep empty
          return next;
        });
      },
      onIceCandidate: (peerId, candidate) => {
        if (iceCandidateCallbackRef.current) {
          iceCandidateCallbackRef.current(peerId, candidate);
        }
      },
      onSpeakerChange: (speakerId, volume) => {
        setActiveSpeakerId(speakerId);
        setDominantVolume(volume);
      },
      onQualityUpdate: (peerId, quality) => {
        setNetworkQuality((prev) => {
          const next = new Map(prev);
          next.set(peerId, quality);
          return next;
        });
      },
    });

    meshManagerRef.current = mesh;

    return () => {
      mesh.closeAll();
      meshManagerRef.current = null;
    };
  }, []);

  // Refresh available devices
  const refreshDevices = useCallback(async () => {
    const devs = await getConnectedDevices();
    setAvailableDevices(devs);
    if (!selectedAudioInput && devs.audioInputs.length > 0) {
      setSelectedAudioInput(devs.audioInputs[0].deviceId);
    }
    if (!selectedVideoInput && devs.videoInputs.length > 0) {
      setSelectedVideoInput(devs.videoInputs[0].deviceId);
    }
    if (!selectedAudioOutput && devs.audioOutputs.length > 0) {
      setSelectedAudioOutput(devs.audioOutputs[0].deviceId);
    }
  }, [selectedAudioInput, selectedVideoInput, selectedAudioOutput]);

  useEffect(() => {
    refreshDevices();
    if (typeof window !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
      };
    }
  }, [refreshDevices]);

  // Audio level meter
  const setupAudioMeter = (stream: MediaStream) => {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setMicVolume(normalized);
        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch (e) {
      console.warn('Audio meter initialization skipped:', e);
    }
  };

  const stopAllMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (meshManagerRef.current) {
      meshManagerRef.current.setLocalStream(null);
    }
    setLocalStream(null);
    setMicVolume(0);
  }, [screenStream]);

  // Request or update local media
  const initializeLocalMedia = useCallback(
    async (wantAudio = true, wantVideo = true): Promise<MediaStream | null> => {
      stopAllMedia();
      try {
        const constraints: MediaStreamConstraints = {
          audio: wantAudio
            ? selectedAudioInput
              ? { deviceId: { exact: selectedAudioInput } }
              : true
            : false,
          video: wantVideo
            ? selectedVideoInput
              ? { deviceId: { exact: selectedVideoInput }, width: { ideal: 1280 }, height: { ideal: 720 } }
              : { width: { ideal: 1280 }, height: { ideal: 720 } }
            : false,
        };

        const stream = await requestMediaStream(constraints);
        streamRef.current = stream;
        setLocalStream(stream);
        setIsAudioEnabled(wantAudio);
        setIsVideoEnabled(wantVideo);

        if (meshManagerRef.current) {
          meshManagerRef.current.setLocalStream(stream);
        }

        if (wantAudio) {
          setupAudioMeter(stream);
        }
        await refreshDevices();
        return stream;
      } catch (err) {
        console.warn('Failed to acquire requested media stream:', err);
        return null;
      }
    },
    [selectedAudioInput, selectedVideoInput, stopAllMedia, refreshDevices]
  );

  const toggleAudio = useCallback(() => {
    if (!streamRef.current) return false;
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioEnabled(audioTrack.enabled);
      return audioTrack.enabled;
    }
    return false;
  }, []);

  const toggleVideo = useCallback(() => {
    if (!streamRef.current) return false;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(videoTrack.enabled);
      return videoTrack.enabled;
    }
    return false;
  }, []);

  const startScreenShare = useCallback(async (): Promise<MediaStream | null> => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen sharing is not supported on this browser.');
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as MediaTrackConstraints,
        audio: false,
      });

      setScreenStream(stream);
      setIsScreenSharing(true);

      // Listen for screen share stop event from browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      return stream;
    } catch (err) {
      console.warn('Screen share canceled or failed:', err);
      setIsScreenSharing(false);
      return null;
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
    }
    setIsScreenSharing(false);
  }, [screenStream]);

  const switchCamera = useCallback(
    async (deviceId: string) => {
      setSelectedVideoInput(deviceId);
      if (streamRef.current && isVideoEnabled) {
        try {
          const newStream = await requestMediaStream({
            video: { deviceId: { exact: deviceId } },
            audio: false,
          });
          const newTrack = newStream.getVideoTracks()[0];
          const oldTrack = streamRef.current.getVideoTracks()[0];
          if (oldTrack) {
            streamRef.current.removeTrack(oldTrack);
            oldTrack.stop();
          }
          streamRef.current.addTrack(newTrack);
          const updated = new MediaStream(streamRef.current.getTracks());
          setLocalStream(updated);
          if (meshManagerRef.current) {
            meshManagerRef.current.setLocalStream(updated);
          }
        } catch (e) {
          console.error('Failed to switch camera:', e);
        }
      }
    },
    [isVideoEnabled]
  );

  const switchMicrophone = useCallback(
    async (deviceId: string) => {
      setSelectedAudioInput(deviceId);
      if (streamRef.current && isAudioEnabled) {
        try {
          const newStream = await requestMediaStream({
            audio: { deviceId: { exact: deviceId } },
            video: false,
          });
          const newTrack = newStream.getAudioTracks()[0];
          const oldTrack = streamRef.current.getAudioTracks()[0];
          if (oldTrack) {
            streamRef.current.removeTrack(oldTrack);
            oldTrack.stop();
          }
          streamRef.current.addTrack(newTrack);
          const updated = new MediaStream(streamRef.current.getTracks());
          setLocalStream(updated);
          if (meshManagerRef.current) {
            meshManagerRef.current.setLocalStream(updated);
          }
        } catch (e) {
          console.error('Failed to switch microphone:', e);
        }
      }
    },
    [isAudioEnabled]
  );

  const switchSpeaker = useCallback(async (deviceId: string) => {
    setSelectedAudioOutput(deviceId);
  }, []);

  // WebRTC Mesh Peer Connection wrappers
  const connectToPeer = useCallback(async (peerId: string) => {
    if (!meshManagerRef.current) throw new Error('WebRTC Mesh not initialized');
    return meshManagerRef.current.createOffer(peerId);
  }, []);

  const handlePeerOffer = useCallback(async (peerId: string, offer: RTCSessionDescriptionInit) => {
    if (!meshManagerRef.current) throw new Error('WebRTC Mesh not initialized');
    return meshManagerRef.current.handleOffer(peerId, offer);
  }, []);

  const handlePeerAnswer = useCallback(async (peerId: string, answer: RTCSessionDescriptionInit) => {
    if (!meshManagerRef.current) throw new Error('WebRTC Mesh not initialized');
    return meshManagerRef.current.handleAnswer(peerId, answer);
  }, []);

  const handlePeerIceCandidate = useCallback(async (peerId: string, candidate: RTCIceCandidateInit) => {
    if (!meshManagerRef.current) throw new Error('WebRTC Mesh not initialized');
    return meshManagerRef.current.addIceCandidate(peerId, candidate);
  }, []);

  const registerIceCandidateHandler = useCallback((cb: (peerId: string, candidate: RTCIceCandidate) => void) => {
    iceCandidateCallbackRef.current = cb;
  }, []);

  const disconnectPeer = useCallback((peerId: string) => {
    if (meshManagerRef.current) {
      meshManagerRef.current.removePeer(peerId);
    }
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
    setNetworkQuality((prev) => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  return (
    <VideoContext.Provider
      value={{
        localStream,
        screenStream,
        isAudioEnabled,
        isVideoEnabled,
        isScreenSharing,
        availableDevices,
        selectedAudioInput,
        selectedVideoInput,
        selectedAudioOutput,
        micVolume,
        remoteStreams,
        activeSpeakerId,
        dominantVolume,
        networkQuality,
        connectToPeer,
        handlePeerOffer,
        handlePeerAnswer,
        handlePeerIceCandidate,
        registerIceCandidateHandler,
        disconnectPeer,
        toggleAudio,
        toggleVideo,
        startScreenShare,
        stopScreenShare,
        switchCamera,
        switchMicrophone,
        switchSpeaker,
        initializeLocalMedia,
        stopAllMedia,
      }}
    >
      {children}
    </VideoContext.Provider>
  );
}

export function useVideo() {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
}
