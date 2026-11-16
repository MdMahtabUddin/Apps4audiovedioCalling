'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, ArrowRight } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface JoinMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JoinMeetingModal({ isOpen, onClose }: JoinMeetingModalProps) {
  const router = useRouter();
  const [meetingInput, setMeetingInput] = useState('');
  const [error, setError] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanInput = meetingInput.trim();
    if (!cleanInput) {
      setError('Please enter a meeting link or meeting code');
      return;
    }

    // Extract meeting ID if full URL was pasted
    let meetingId = cleanInput;
    if (cleanInput.includes('/meeting/')) {
      const parts = cleanInput.split('/meeting/');
      meetingId = parts[1].split('?')[0].split('#')[0];
    } else if (cleanInput.startsWith('http://') || cleanInput.startsWith('https://')) {
      const url = new URL(cleanInput);
      meetingId = url.pathname.replace(/^\//, '');
    }

    meetingId = meetingId.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();

    if (!meetingId) {
      setError('Invalid meeting link or code format');
      return;
    }

    onClose();
    router.push(`/meeting/${meetingId}`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Join a Meeting"
      description="Enter the meeting ID or full meeting URL provided by the host"
    >
      <form onSubmit={handleJoin} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium">
            {error}
          </div>
        )}

        <Input
          id="join-code"
          label="Meeting Code or Link"
          placeholder="abc-defg-hij or https://metromeet.app/meeting/abc-defg-hij"
          value={meetingInput}
          onChange={(e) => setMeetingInput(e.target.value)}
          autoFocus
        />

        <div className="pt-2 flex gap-3 justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!meetingInput.trim()}>
            Join Meeting
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
