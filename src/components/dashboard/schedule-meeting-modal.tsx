'use client';

import React, { useState } from 'react';
import { Calendar, Clock, Shield, Check } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduled?: () => void;
}

export function ScheduleMeetingModal({ isOpen, onClose, onScheduled }: ScheduleMeetingModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [startTime, setStartTime] = useState('10:00');
  const [duration, setDuration] = useState('30');
  const [password, setPassword] = useState('');
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/meetings/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Scheduled Meeting',
          date,
          startTime,
          duration: parseInt(duration, 10),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          password: password.trim() || null,
          waitingRoom,
        }),
      });

      if (!res.ok) throw new Error('Failed to schedule meeting');

      setIsSuccess(true);
      onScheduled?.();
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1500);
    } catch (e) {
      console.error(e);
      // Fallback close
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule a Meeting"
      description="Plan ahead and invite participants with date, time, and room preferences"
    >
      {isSuccess ? (
        <div className="py-6 text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Check className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-white">Meeting scheduled successfully!</p>
        </div>
      ) : (
        <form onSubmit={handleSchedule} className="space-y-4">
          <Input
            id="sch-title"
            label="Meeting Title"
            placeholder="e.g. Sprint Retrospective"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              id="sch-date"
              type="date"
              label="Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <Input
              id="sch-time"
              type="time"
              label="Start Time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-300">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-gray-800 bg-gray-900/80 px-3.5 py-2 text-sm text-gray-100 transition-colors focus:border-indigo-500 focus:outline-none"
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
            </select>
          </div>

          <Input
            id="sch-password"
            type="password"
            label="Password (optional)"
            placeholder="Security passcode"
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
              Enable Waiting Room (Host approval required)
            </span>
          </label>

          <div className="pt-3 border-t border-gray-800/80 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Schedule Meeting
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
