/**
 * MetroMeet WebRTC Mesh Manager (Phase 3)
 * Full Peer-to-Peer Mesh Architecture using RTCPeerConnection and Google STUN.
 * Architected with clean decoupling so it can seamlessly connect with Socket.IO signaling (Phase 4)
 * and future SFU (mediasoup/LiveKit) without altering meeting stage UI.
 */

export interface NetworkQuality {
  peerId: string;
  status: 'good' | 'fair' | 'poor';
  rttMs: number;
  packetsLost: number;
  jitter: number;
  bitrateKbps: number;
}

export interface RemoteParticipantStream {
  peerId: string;
  stream: MediaStream;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isSpeaking: boolean;
  audioVolume: number; // 0 - 100
  quality: NetworkQuality;
}

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

type PeerCallback = {
  onRemoteStream?: (peerId: string, stream: MediaStream) => void;
  onRemoteTrackRemoved?: (peerId: string, track: MediaStreamTrack) => void;
  onIceCandidate?: (peerId: string, candidate: RTCIceCandidate) => void;
  onConnectionStateChange?: (peerId: string, state: RTCPeerConnectionState) => void;
  onSpeakerChange?: (speakerId: string | null, volume: number) => void;
  onQualityUpdate?: (peerId: string, quality: NetworkQuality) => void;
  onNegotiationNeeded?: (peerId: string) => void;
};

export class WebRTCMeshManager {
  private peers: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private localStream: MediaStream | null = null;
  private callbacks: PeerCallback = {};
  
  // Audio Analysers for Active Speaker Detection
  private audioContext: AudioContext | null = null;
  private analysers: Map<string, AnalyserNode> = new Map();
  private speakerCheckInterval: ReturnType<typeof setInterval> | null = null;
  private qualityCheckInterval: ReturnType<typeof setInterval> | null = null;
  private lastBytesReceived: Map<string, { bytes: number; timestamp: number }> = new Map();

  constructor(callbacks: PeerCallback = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Set or update local media stream. Adds tracks to all existing peer connections.
   */
  public setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;

    if (!stream) return;

    // Attach local stream to AudioContext for local speaker detection
    this.setupAudioAnalyser('local', stream);

    // Update existing peer connections with local tracks
    this.peers.forEach((pc, peerId) => {
      const senders = pc.getSenders();
      stream.getTracks().forEach((track) => {
        const existingSender = senders.find((s) => s.track?.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track).catch((err) => {
            console.warn(`[WebRTC] Failed to replace ${track.kind} track for peer ${peerId}:`, err);
          });
        } else {
          try {
            pc.addTrack(track, stream);
          } catch (e) {
            console.warn(`[WebRTC] Failed to add ${track.kind} track for peer ${peerId}:`, e);
          }
        }
      });
    });

    this.startActiveSpeakerDetection();
    this.startQualityMonitoring();
  }

  /**
   * Create a new RTCPeerConnection for a remote peer.
   */
  public getOrCreatePeer(peerId: string): RTCPeerConnection {
    if (this.peers.has(peerId)) {
      return this.peers.get(peerId)!;
    }

    if (typeof RTCPeerConnection === 'undefined') {
      throw new Error('RTCPeerConnection is not supported in this runtime.');
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peers.set(peerId, pc);

    // Initialize remote stream for this peer
    const remoteStream = new MediaStream();
    this.remoteStreams.set(peerId, remoteStream);

    // Add local tracks to new connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, this.localStream!);
        } catch (e) {
          console.warn(`[WebRTC] Error adding local track to peer ${peerId}:`, e);
        }
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && this.callbacks.onIceCandidate) {
        this.callbacks.onIceCandidate(peerId, event.candidate);
      }
    };

    // Remote Track handler
    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
          remoteStream.addTrack(track);
        }
      });

      // Also ensure the individual track from the event is present
      if (!remoteStream.getTracks().some((t) => t.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }

      this.setupAudioAnalyser(peerId, remoteStream);

      if (this.callbacks.onRemoteStream) {
        this.callbacks.onRemoteStream(peerId, remoteStream);
      }

      event.track.onended = () => {
        remoteStream.removeTrack(event.track);
        if (this.callbacks.onRemoteTrackRemoved) {
          this.callbacks.onRemoteTrackRemoved(peerId, event.track);
        }
      };
    };

    // Connection state monitor
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (this.callbacks.onConnectionStateChange) {
        this.callbacks.onConnectionStateChange(peerId, state);
      }

      if (state === 'failed' || state === 'closed') {
        this.removePeer(peerId);
      } else if (state === 'disconnected') {
        // Attempt ICE restart if disconnected
        this.attemptIceRestart(peerId);
      }
    };

    // Negotiation needed handler
    pc.onnegotiationneeded = () => {
      if (this.callbacks.onNegotiationNeeded) {
        this.callbacks.onNegotiationNeeded(peerId);
      }
    };

    // Apply any candidates queued before PC was ready
    const pending = this.pendingCandidates.get(peerId);
    if (pending && pending.length > 0) {
      pending.forEach((cand) => {
        pc.addIceCandidate(new RTCIceCandidate(cand)).catch((err) => {
          console.warn(`[WebRTC] Failed to add queued ICE candidate for ${peerId}:`, err);
        });
      });
      this.pendingCandidates.delete(peerId);
    }

    return pc;
  }

  private optimizeAudioSDP(sdp: string): string {
    if (!sdp) return sdp;
    try {
      // Set 128kbps high-fidelity bitrate and enable inband FEC for crystal-clear voice transmission
      return sdp.replace(/(a=fmtp:\d+ [^\r\n]+)/gi, (match) => {
        if (match.includes('maxaveragebitrate')) return match;
        return `${match};stereo=1;sprop-stereo=1;useinbandfec=1;maxaveragebitrate=128000;cbr=0`;
      });
    } catch {
      return sdp;
    }
  }

  /**
   * Initiate WebRTC handshake: create SDP offer.
   */
  public async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const pc = this.getOrCreatePeer(peerId);
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    const sdp = this.optimizeAudioSDP(offer.sdp || '');
    const enhancedOffer: RTCSessionDescriptionInit = { type: offer.type, sdp };
    await pc.setLocalDescription(enhancedOffer);
    return enhancedOffer;
  }

  /**
   * Handle incoming SDP offer and return SDP answer.
   */
  public async handleOffer(
    peerId: string,
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    const pc = this.getOrCreatePeer(peerId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    // Process queued candidates now that remote description is set
    await this.flushPendingCandidates(peerId);

    const answer = await pc.createAnswer();
    const sdp = this.optimizeAudioSDP(answer.sdp || '');
    const enhancedAnswer: RTCSessionDescriptionInit = { type: answer.type, sdp };
    await pc.setLocalDescription(enhancedAnswer);
    return enhancedAnswer;
  }

  /**
   * Handle incoming SDP answer.
   */
  public async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peers.get(peerId);
    if (!pc) {
      console.warn(`[WebRTC] Received answer for non-existent peer ${peerId}`);
      return;
    }
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    await this.flushPendingCandidates(peerId);
  }

  /**
   * Add ICE Candidate received from remote signaling.
   */
  public async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peers.get(peerId);
    if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
      // Queue candidate until remote description is set
      const queue = this.pendingCandidates.get(peerId) || [];
      queue.push(candidate);
      this.pendingCandidates.set(peerId, queue);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn(`[WebRTC] Error adding ICE candidate for peer ${peerId}:`, err);
    }
  }

  private async flushPendingCandidates(peerId: string): Promise<void> {
    const pc = this.peers.get(peerId);
    if (!pc) return;

    const queue = this.pendingCandidates.get(peerId);
    if (queue && queue.length > 0) {
      for (const cand of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.warn(`[WebRTC] Failed to flush candidate for ${peerId}:`, err);
        }
      }
      this.pendingCandidates.delete(peerId);
    }
  }

  /**
   * Attempt ICE restart upon unexpected network disconnection.
   */
  private async attemptIceRestart(peerId: string) {
    const pc = this.peers.get(peerId);
    if (!pc) return;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      if (this.callbacks.onNegotiationNeeded) {
        this.callbacks.onNegotiationNeeded(peerId);
      }
    } catch (e) {
      console.warn(`[WebRTC] ICE restart failed for ${peerId}:`, e);
    }
  }

  /**
   * Setup Web Audio API Analyser for a specific stream to detect speech volume.
   */
  private setupAudioAnalyser(id: string, stream: MediaStream) {
    if (typeof window === 'undefined') return;
    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      if (!this.audioContext) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.5;

      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      this.analysers.set(id, analyser);
    } catch (err) {
      console.warn(`[WebRTC] Failed to setup audio analyser for ${id}:`, err);
    }
  }

  /**
   * Active Speaker Detection loop.
   * Periodically measures frequency data across all participants.
   * Emits the ID of the participant speaking the loudest above threshold.
   */
  private startActiveSpeakerDetection() {
    if (this.speakerCheckInterval) return;

    const dataArray = new Uint8Array(32);
    const SPEAKER_THRESHOLD = 25; // 0 - 100 volume threshold

    this.speakerCheckInterval = setInterval(() => {
      let maxVolume = 0;
      let dominantSpeaker: string | null = null;

      this.analysers.forEach((analyser, id) => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((average / 128) * 100));

        if (normalized > SPEAKER_THRESHOLD && normalized > maxVolume) {
          maxVolume = normalized;
          dominantSpeaker = id;
        }
      });

      if (this.callbacks.onSpeakerChange) {
        this.callbacks.onSpeakerChange(dominantSpeaker, maxVolume);
      }
    }, 250);
  }

  /**
   * Periodic network stats monitor using RTCPeerConnection.getStats().
   * Calculates RTT latency, packet loss, and connection health status.
   */
  private startQualityMonitoring() {
    if (this.qualityCheckInterval) return;

    this.qualityCheckInterval = setInterval(async () => {
      for (const [peerId, pc] of this.peers.entries()) {
        if (pc.connectionState !== 'connected') continue;

        try {
          const stats = await pc.getStats();
          let rttMs = 0;
          let packetsLost = 0;
          let jitter = 0;
          let bytesReceived = 0;
          let bitrateKbps = 0;

          stats.forEach((report) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              rttMs = Math.round((report.currentRoundTripTime || 0) * 1000);
            }
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              packetsLost = report.packetsLost || 0;
              jitter = Math.round((report.jitter || 0) * 1000);
              bytesReceived = report.bytesReceived || 0;
            }
          });

          // Calculate bitrate
          const now = Date.now();
          const prev = this.lastBytesReceived.get(peerId);
          if (prev && bytesReceived > prev.bytes) {
            const timeDiffSec = (now - prev.timestamp) / 1000;
            if (timeDiffSec > 0) {
              bitrateKbps = Math.round(((bytesReceived - prev.bytes) * 8) / (timeDiffSec * 1024));
            }
          }
          this.lastBytesReceived.set(peerId, { bytes: bytesReceived, timestamp: now });

          // Determine quality rating
          let status: 'good' | 'fair' | 'poor' = 'good';
          if (rttMs > 250 || packetsLost > 20) {
            status = 'poor';
          } else if (rttMs > 120 || packetsLost > 5) {
            status = 'fair';
          }

          const quality: NetworkQuality = {
            peerId,
            status,
            rttMs,
            packetsLost,
            jitter,
            bitrateKbps,
          };

          if (this.callbacks.onQualityUpdate) {
            this.callbacks.onQualityUpdate(peerId, quality);
          }
        } catch {
          // stats collection error ignored
        }
      }
    }, 2500);
  }

  /**
   * Remove a single peer and release resources.
   */
  public removePeer(peerId: string) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
    this.remoteStreams.delete(peerId);
    this.analysers.delete(peerId);
    this.pendingCandidates.delete(peerId);
    this.lastBytesReceived.delete(peerId);
  }

  /**
   * Get all active remote streams.
   */
  public getRemoteStreams(): Map<string, MediaStream> {
    return this.remoteStreams;
  }

  /**
   * Close all peer connections, audio analysers, and monitoring intervals.
   */
  public closeAll() {
    if (this.speakerCheckInterval) {
      clearInterval(this.speakerCheckInterval);
      this.speakerCheckInterval = null;
    }
    if (this.qualityCheckInterval) {
      clearInterval(this.qualityCheckInterval);
      this.qualityCheckInterval = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.peers.forEach((pc) => pc.close());
    this.peers.clear();
    this.remoteStreams.clear();
    this.analysers.clear();
    this.pendingCandidates.clear();
    this.lastBytesReceived.clear();
  }
}
