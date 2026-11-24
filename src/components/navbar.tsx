'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Video,
  LogOut,
  Settings,
  ChevronDown,
  Shield,
} from 'lucide-react';
import { UserProfile } from '@/types';
import { BrandLogo } from '@/components/ui/brand-logo';
import { ThemeToggle } from '@/components/theme/theme-provider';
import { useToast } from '@/components/ui/toast';

interface NavbarProps {
  user?: UserProfile | null;
  onOpenSettings?: () => void;
  onQuickNewMeeting?: () => void;
}

export function Navbar({ user, onOpenSettings, onQuickNewMeeting }: NavbarProps) {
  const router = useRouter();
  const toast = useToast();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [status, setStatus] = useState<'Available' | 'Busy' | 'In a Call'>('Available');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Signed out successfully');
      router.push('/');
      router.refresh();
    } catch (e) {
      console.error('Logout error:', e);
      toast.error('Failed to log out');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-white/[0.08] bg-white/85 dark:bg-[#09090b]/85 backdrop-blur-xl transition-colors duration-200 pt-[env(safe-area-inset-top)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        {/* Brand Logo (Compact on mobile app bar, full with tagline on desktop) */}
        <div className="flex items-center gap-6">
          <div className="sm:hidden">
            <BrandLogo size="sm" showTagline={false} href={user ? '/dashboard' : '/'} />
          </div>
          <div className="hidden sm:block">
            <BrandLogo size="md" showTagline={true} href={user ? '/dashboard' : '/'} />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <ThemeToggle />

          {user ? (
            <>
              {onQuickNewMeeting && (
                <button
                  onClick={onQuickNewMeeting}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Video className="h-3.5 w-3.5" />
                  <span>New Meeting</span>
                </button>
              )}

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer select-none"
                >
                  <div className="relative">
                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                      {user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatar} alt={user.name} className="h-full w-full rounded-lg object-cover" />
                      ) : (
                        user.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-[#09090b] ${
                        status === 'Available'
                          ? 'bg-emerald-500'
                          : status === 'Busy'
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      }`}
                    />
                  </div>

                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">{user.name}</span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 max-w-[130px] truncate">{user.email}</span>
                  </div>

                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-400 hidden sm:block" />
                </button>

                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#111114] p-1.5 shadow-xl shadow-slate-900/10 dark:shadow-black/80 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-2.5 border-b border-slate-100 dark:border-white/[0.08] mb-1">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">{user.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">{user.email}</p>
                        <div className="flex items-center justify-between gap-1.5 mt-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                          <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">Status</span>
                          <button
                            onClick={() =>
                              setStatus((prev) =>
                                prev === 'Available'
                                  ? 'Busy'
                                  : prev === 'Busy'
                                  ? 'In a Call'
                                  : 'Available'
                              )
                            }
                            className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-blue-600 dark:text-blue-400 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                status === 'Available'
                                  ? 'bg-emerald-500'
                                  : status === 'Busy'
                                  ? 'bg-amber-500'
                                  : 'bg-blue-500'
                              }`}
                            />
                            {status}
                          </button>
                        </div>
                      </div>

                      {onOpenSettings && (
                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            onOpenSettings();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer font-medium"
                        >
                          <Settings className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          Audio/Vedio Studio &amp; Settings
                        </button>
                      )}

                      <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors mt-0.5 cursor-pointer font-medium"
                      >
                        <LogOut className="h-4 w-4" />
                        {isLoggingOut ? 'Signing out...' : 'Sign Out'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-xs sm:text-sm font-medium text-slate-600 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:text-zinc-950 dark:bg-white dark:hover:bg-zinc-200 px-4 py-2 rounded-lg transition-colors"
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
