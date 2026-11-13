import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'indigo' | 'blue' | 'orange' | 'outline';
  dot?: boolean;
}

export function Badge({
  className,
  variant = 'default',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: 'bg-gray-800 text-gray-300 border-gray-700/60',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'bg-red-500/10 text-red-400 border-red-500/20',
    indigo: 'bg-[#0066FF]/15 text-[#388BFF] border-[#0066FF]/30',
    blue: 'bg-[#0066FF]/15 text-[#388BFF] border-[#0066FF]/30',
    orange: 'bg-[#FF7A00]/15 text-[#FFA033] border-[#FF7A00]/30',
    outline: 'bg-transparent text-gray-300 border-gray-700',
  };

  const dotColors = {
    default: 'bg-gray-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-red-400',
    indigo: 'bg-[#0066FF]',
    blue: 'bg-[#0066FF]',
    orange: 'bg-[#FF7A00]',
    outline: 'bg-gray-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border',
        variants[variant],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse', dotColors[variant])} />}
      {children}
    </span>
  );
}
