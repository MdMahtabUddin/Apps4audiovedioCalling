'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseMeetingRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingDuration: string;
  recordingSeconds: number;
  startRecording: (videoStream?: MediaStream | null, additionalAudioStreams?: MediaStream[]) => Promise<boolean>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

export function useMeetingRecorder(meetingTitle = 'MetroMeet-Session'): UseMeetingRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mixedStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Timer formatter mm:ss
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const startRecording = useCallback(
    async (
      videoStream?: MediaStream | null,
      additionalAudioStreams: MediaStream[] = []
    ): Promise<boolean> => {
      try {
        recordedChunksRef.current = [];
        setRecordingSeconds(0);

        let streamToRecord: MediaStream;

        // 1. Try to record provided videoStream (screen share or local video)
        // If not provided, ask for display media (screen/tab with system audio)
        if (videoStream && videoStream.getVideoTracks().length > 0) {
          streamToRecord = new MediaStream();

          // Add video track
          const videoTrack = videoStream.getVideoTracks()[0];
          streamToRecord.addTrack(videoTrack);

          // 2. Mix all audio tracks (local mic + remote peers)
          const audioTracks: MediaStreamTrack[] = [];
          if (videoStream.getAudioTracks().length > 0) {
            audioTracks.push(...videoStream.getAudioTracks());
          }
          additionalAudioStreams.forEach((s) => {
            if (s && s.getAudioTracks().length > 0) {
              audioTracks.push(...s.getAudioTracks());
            }
          });

          if (audioTracks.length > 0 && typeof window !== 'undefined') {
            try {
              const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioCtx) {
                const audioCtx = new AudioCtx();
                audioContextRef.current = audioCtx;
                const dest = audioCtx.createMediaStreamDestination();

                audioTracks.forEach((t) => {
                  try {
                    const singleStream = new MediaStream([t]);
                    const source = audioCtx.createMediaStreamSource(singleStream);
                    source.connect(dest);
                  } catch (e) {
                    console.warn('Audio mixer track note:', e);
                  }
                });

                if (dest.stream.getAudioTracks().length > 0) {
                  streamToRecord.addTrack(dest.stream.getAudioTracks()[0]);
                }
              }
            } catch (err) {
              console.warn('Audio mixer fallback:', err);
              // Fallback to first available audio track
              if (audioTracks[0]) streamToRecord.addTrack(audioTracks[0]);
            }
          }
        } else if (navigator.mediaDevices?.getDisplayMedia) {
          // Fallback: prompt for window/tab capture with native system audio
          streamToRecord = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'browser' } as any,
            audio: true,
          });
        } else {
          throw new Error('No capture stream available for recording.');
        }

        mixedStreamRef.current = streamToRecord;

        // Determine supported mimeType
        const mimeTypes = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
          'video/mp4',
        ];
        const selectedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';

        const recorder = selectedMime
          ? new MediaRecorder(streamToRecord, { mimeType: selectedMime })
          : new MediaRecorder(streamToRecord);

        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, {
            type: selectedMime || 'video/webm',
          });

          // Trigger automatic download of the recording
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          a.download = `${meetingTitle.replace(/\s+/g, '-')}-${timestamp}.webm`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }, 2000);

          // Clean up mixed audio context
          if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
          }
          setIsRecording(false);
          setIsPaused(false);
          setRecordingSeconds(0);
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
        };

        recorder.start(1000); // 1-second chunks
        setIsRecording(true);
        setIsPaused(false);

        // Start duration counter
        timerIntervalRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);

        return true;
      } catch (err) {
        console.warn('Start recording canceled or error:', err);
        setIsRecording(false);
        return false;
      }
    },
    [meetingTitle]
  );

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return {
    isRecording,
    isPaused,
    recordingDuration: formatTime(recordingSeconds),
    recordingSeconds,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
