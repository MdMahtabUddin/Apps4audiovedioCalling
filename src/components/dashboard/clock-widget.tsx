'use client';

import React, { useEffect, useState } from 'react';
import { Clock, Calendar, Sparkles } from 'lucide-react';

export function ClockWidget() {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      );
      setDate(
        now.toLocaleDateString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-end text-right">
      <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white font-mono">
        {time || '--:--'}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
        <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        <span>{date || 'Loading date...'}</span>
      </div>
    </div>
  );
}
