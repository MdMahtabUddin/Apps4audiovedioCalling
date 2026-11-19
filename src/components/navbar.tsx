'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Video,
  LogOut,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { UserProfile } from '@/types';
import { BrandLogo } from '@/components/ui/brand-logo';
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
    <header className="sticky top-0 z-40 w-full border-b border-[#0066FF]/20 bg-[#050a14]/85 backdrop-blur-2xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <BrandLogo size="md" showTagline={true} href={user ? '/dashboard' : '/'} />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {onQuickNewMeeting && (
                <button
                  onClick={onQuickNewMeeting}
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#0052CC] hover:from-[#1E78FF] hover:to-[#0047B3] text-white text-xs font-bold transition-all hover:scale-105 cursor-pointer shadow-md shadow-[#0066FF]/25 border border-[#388BFF]/40"
                >
                  <Video className="h-3.5 w-3.5" />
                  <span>Start Call</span>
                </button>
              )}

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 p-1.5 sm:px-3 sm:py-2 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all cursor-pointer select-none"
                >
                  <div className="relative">
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-tr from-[#0057B7] to-[#FF7A00] flex items-center justify-center text-white text-xs font-black shadow-md shadow-[#0066FF]/20">
                      {user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatar} alt={user.name} className="h-full w-full rounded-xl object-cover" />
                      ) : (
                        user.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ${
                        status === 'Available'
                          ? 'bg-emerald-400 ring-2 ring-emerald-400/20'
                          : status === 'Busy'
                          ? 'bg-[#FF7A00] ring-2 ring-[#FF7A00]/20'
                          : 'bg-[#0066FF] ring-2 ring-[#0066FF]/20'
                      }`}
                    />
                  </div>

                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-bold text-gray-200">{user.name}</span>
                    <span className="text-[10px] text-gray-400 max-w-[130px] truncate">{user.email}</span>
                  </div>

                  <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden sm:block" />
                </button>

                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-64 rounded-3xl border border-[#0066FF]/30 bg-[#091222] p-2.5 shadow-2xl shadow-black/80 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-2.5 border-b border-white/[0.08] mb-1.5">
                        <p className="text-xs font-bold text-white">{user.name}</p>
                        <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                        <div className="flex items-center justify-between gap-1.5 mt-2.5 pt-2 border-t border-white/[0.06]">
                          <span className="text-[10px] text-gray-400 font-medium">Status</span>
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
                            className="text-[10px] px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-[#388BFF] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                status === 'Available'
                                  ? 'bg-emerald-400'
                                  : status === 'Busy'
                                  ? 'bg-[#FF7A00]'
                                  : 'bg-[#0066FF]'
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
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-gray-300 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors cursor-pointer font-medium"
                        >
                          <Settings className="h-4 w-4 text-[#388BFF]" />
                          Audio/Vedio Studio & Settings
                        </button>
                      )}

                      <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors mt-1 cursor-pointer font-medium"
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
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/login"
                className="text-xs sm:text-sm font-semibold text-gray-300 hover:text-white px-3.5 py-2 rounded-xl hover:bg-white/[0.06] transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#FF7A00] to-[#E66200] hover:from-[#FF8A1E] hover:to-[#D45700] px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl shadow-lg shadow-[#FF7A00]/25 transition-all hover:scale-105 border border-[#FFA149]/30"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
