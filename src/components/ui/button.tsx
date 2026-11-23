import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'glass' | 'orange';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-[#09090b] select-none';

    const variants = {
      primary: 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs active:scale-[0.99] border border-blue-500/40',
      orange: 'bg-white hover:bg-zinc-200 text-zinc-950 font-semibold shadow-xs active:scale-[0.99] border border-white',
      secondary: 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 active:scale-[0.99]',
      glass: 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-white/10 active:scale-[0.99]',
      outline: 'bg-transparent border border-white/12 hover:border-white/25 hover:bg-white/[0.04] text-zinc-300 hover:text-white active:scale-[0.99]',
      danger: 'bg-rose-600 hover:bg-rose-500 text-white active:scale-[0.99] border border-rose-500/30',
      ghost: 'bg-transparent hover:bg-white/[0.06] text-zinc-300 hover:text-white',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-lg',
      md: 'text-xs sm:text-sm px-4 py-2 gap-2',
      lg: 'text-sm px-5 py-2.5 gap-2 font-semibold',
      icon: 'h-9 w-9 p-0 rounded-lg',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
