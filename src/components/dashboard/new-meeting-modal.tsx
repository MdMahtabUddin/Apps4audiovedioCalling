'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, Copy, Check, ArrowRight, Shield, Clock } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateMeetingId } from '@/lib/utils';

interface NewMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMeetingCreated?: () => void;
}

export function NewMeetingModal({ isOpen, onClose, onMeetingCreated }: NewMeetingModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [createdRoomUrl, setCreatedRoomUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartInstant = async () => {
    setIsLoading(true);
    const meetingId = generateMeetingId();
    const meetingTitle = title.trim() || 'Instant Meeting';

    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: meetingId,
          title: meetingTitle,
          password: password.trim() || null,
          waitingRoom,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create meeting');
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(`metromeet_host_${meetingId}`, 'true');
      }
      onMeetingCreated?.();
      router.push(`/meeting/${meetingId}`);
    } catch (e) {
      console.error(e);
      // Even if API has an issue in early phase, proceed to meeting URL
      router.push(`/meeting/${meetingId}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateForLater = async () => {
    setIsLoading(true);
    const meetingId = generateMeetingId();
    const meetingTitle = title.trim() || 'Scheduled Meeting';

    try {
      await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: meetingId,
          title: meetingTitle,
          password: password.trim() || null,
          waitingRoom,
        }),
      });
      onMeetingCreated?.();
    } catch (e) {
      console.error(e);
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    setCreatedRoomUrl(`${origin}/meeting/${meetingId}`);
    setIsLoading(false);
  };

  const handleCopy = () => {
    if (createdRoomUrl) {
      navigator.clipboard.writeText(createdRoomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleReset = () => {
    setCreatedRoomUrl(null);
    setTitle('');
    setPassword('');
    setWaitingRoom(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleReset}
      title={createdRoomUrl ? 'Here is your meeting link' : 'Start or Create a Meeting'}
      description={
        createdRoomUrl
          ? 'Copy this link and send it to people you want to meet with'
          : 'Set up an instant room or generate a link to share with others'
      }
    >
      {createdRoomUrl ? (
        <div className="space-y-5">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-900 border border-gray-800">
            <input
              type="text"
              readOnly
              value={createdRoomUrl}
              className="bg-transparent text-xs text-gray-200 flex-1 outline-none font-mono"
            />
            <Button size="sm" variant="secondary" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </Button>
          </div>

          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => {
                const parts = createdRoomUrl.split('/');
                const id = parts[parts.length - 1];
                router.push(`/meeting/${id}`);
              }}
            >
              Join Meeting Now
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <Button variant="secondary" onClick={handleReset}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            id="meeting-title"
            label="Meeting Title (optional)"
            placeholder="e.g. Weekly Product Sync"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <Input
            id="meeting-password"
            type="password"
            label="Room Password (optional)"
            placeholder="Leave empty for public link"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <label className="flex items-center gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={waitingRoom}
              onChange={(e) => setWaitingRoom(e.target.checked)}
              className="rounded border-gray-700 bg-gray-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            <span className="text-xs text-gray-300 select-none">
              Enable Waiting Room (Host must approve entrants)
            </span>
          </label>

          <div className="pt-3 border-t border-gray-800/80 flex flex-col sm:flex-row gap-3">
            <Button
              className="flex-1"
              onClick={handleStartInstant}
              isLoading={isLoading}
            >
              <Video className="h-4 w-4" />
              Start Instant Meeting
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleCreateForLater}
              isLoading={isLoading}
            >
              <Clock className="h-4 w-4" />
              Create Link for Later
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
