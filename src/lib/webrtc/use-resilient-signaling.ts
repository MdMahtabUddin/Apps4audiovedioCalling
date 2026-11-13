'use client';

import { useEffect, useRef, useCallback } from 'react';

export interface UseResilientSignalingProps {
  meetingId: string;
  myPeerId: string;
  isHost: boolean;
  remotePeerIds: string[];
  connectToPeer: (peerId: string) => Promise<RTCSessionDescriptionInit>;
  handlePeerOffer: (peerId: string, offer: RTCSessionDescriptionInit) => Promise<RTCSessionDescriptionInit>;
  handlePeerAnswer: (peerId: string, answer: RTCSessionDescriptionInit) => Promise<void>;
  handlePeerIceCandidate: (peerId: string, candidate: RTCIceCandidateInit) => Promise<void>;
  registerIceCandidateHandler: (cb: (peerId: string, candidate: RTCIceCandidate) => void) => void;
}

export function useResilientSignaling({
  meetingId,
  myPeerId,
  isHost,
  remotePeerIds,
  connectToPeer,
  handlePeerOffer,
  handlePeerAnswer,
  handlePeerIceCandidate,
  registerIceCandidateHandler,
}: UseResilientSignalingProps) {
  const initiatedOffersRef = useRef<Set<string>>(new Set());
  const processedSignalIdsRef = useRef<Set<string>>(new Set());
  const lastPollTimestampRef = useRef<string>(new Date(Date.now() - 30000).toISOString());

  // Post signal message to HTTPS bridge
  const postSignal = useCallback(
    async (to: string, type: string, data: any) => {
      try {
        await fetch(`/api/meetings/${meetingId}/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: myPeerId,
            to,
            type,
            data,
          }),
        });
      } catch (err) {
        console.warn('[ResilientSignaling] Post error:', err);
      }
    },
    [meetingId, myPeerId]
  );

  // 1. Register local ICE candidate listener to forward candidates to peer
  useEffect(() => {
    registerIceCandidateHandler((targetPeerId, candidate) => {
      postSignal(targetPeerId, 'ice-candidate', candidate.toJSON());
    });
  }, [registerIceCandidateHandler, postSignal]);

  // 2. Proactively initiate SDP offer to approved remote peers
  useEffect(() => {
    if (!meetingId || !myPeerId) return;

    remotePeerIds.forEach(async (peerId) => {
      if (!peerId || peerId === myPeerId) return;

      // Host initiates to all guests; or lexicographical tie-breaker between guests
      const shouldInitiate = isHost || myPeerId < peerId;

      if (shouldInitiate && !initiatedOffersRef.current.has(peerId)) {
        initiatedOffersRef.current.add(peerId);
        try {
          console.log(`[ResilientSignaling] Initiating WebRTC offer to peer: ${peerId}`);
          const offer = await connectToPeer(peerId);
          await postSignal(peerId, 'offer', offer);
        } catch (err) {
          console.warn(`[ResilientSignaling] Failed to create offer for ${peerId}:`, err);
        }
      }
    });
  }, [remotePeerIds, isHost, myPeerId, meetingId, connectToPeer, postSignal]);

  // 3. Poll incoming signals (offer, answer, ice-candidate)
  useEffect(() => {
    if (!meetingId || !myPeerId) return;

    let active = true;

    const pollSignals = async () => {
      try {
        const res = await fetch(
          `/api/meetings/${meetingId}/signal?peerId=${encodeURIComponent(myPeerId)}&since=${encodeURIComponent(
            lastPollTimestampRef.current
          )}`
        );
        if (!res.ok) return;

        const data = await res.json();
        if (data.latestTimestamp) {
          lastPollTimestampRef.current = data.latestTimestamp;
        }

        if (Array.isArray(data.signals) && active) {
          for (const sig of data.signals) {
            if (processedSignalIdsRef.current.has(sig.id)) continue;
            processedSignalIdsRef.current.add(sig.id);

            const senderPeerId = sig.from;
            console.log(`[ResilientSignaling] Received ${sig.type} from peer: ${senderPeerId}`);

            if (sig.type === 'offer') {
              try {
                const answer = await handlePeerOffer(senderPeerId, sig.data);
                await postSignal(senderPeerId, 'answer', answer);
              } catch (e) {
                console.warn(`[ResilientSignaling] Handle offer error from ${senderPeerId}:`, e);
              }
            } else if (sig.type === 'answer') {
              try {
                await handlePeerAnswer(senderPeerId, sig.data);
              } catch (e) {
                console.warn(`[ResilientSignaling] Handle answer error from ${senderPeerId}:`, e);
              }
            } else if (sig.type === 'ice-candidate') {
              try {
                await handlePeerIceCandidate(senderPeerId, sig.data);
              } catch (e) {
                console.warn(`[ResilientSignaling] Handle candidate error from ${senderPeerId}:`, e);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[ResilientSignaling] Poll loop note:', err);
      }
    };

    pollSignals();
    const interval = setInterval(pollSignals, 800);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [
    meetingId,
    myPeerId,
    handlePeerOffer,
    handlePeerAnswer,
    handlePeerIceCandidate,
    postSignal,
  ]);
}
