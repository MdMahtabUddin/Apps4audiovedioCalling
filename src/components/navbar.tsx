'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Video,
  LogOut,
  User,
  Settings,
  Calendar,
  Shield,
  Clock,
  Sparkles,
  ChevronDown,
  Zap,
  Radio,
} from 'lucide-react';
import { UserProfile } from '@/types';
import { Badge } from '@/components/ui/badge';
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
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error('Logout error:', e);
      toast.error('Failed to log out');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#06080e]/80 backdrop-blur-2xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-300" />
              <div className="relative h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-all">
                <Video className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Meet<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Flow</span>
                </span>
                <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold tracking-wider uppercase">
                  v2.0
                </span>
              </div>
              <span className="text-[10px] text-gray-400 -mt-0.5 font-medium tracking-wide">
                Ultra Low-Latency WebRTC
              </span>
            </div>
          </Link>

          {user && (
            <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-white/[0.08]">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400">
                <Radio className="h-3 w-3 animate-pulse text-emerald-400" />
                <span>WebRTC Mesh Active</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-gray-400 font-mono px-2 py-1 rounded-lg bg-white/[0.03]">
                <Zap className="h-3 w-3 text-amber-400" />
                <span>14ms</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {onQuickNewMeeting && (
                <button
                  onClick={onQuickNewMeeting}
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600/20 to-purple-600/20 hover:from-indigo-600/30 hover:to-purple-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all hover:scale-105 cursor-pointer shadow-sm"
                >
                  <Video className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Start Call</span>
                </button>
              )}

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 p-1.5 sm:px-3 sm:py-2 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all cursor-pointer"
                >
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'}
                      alt={user.name}
                      className="h-8 w-8 sm:h-9 sm:w-9 rounded-full border border-indigo-400/40 object-cover bg-gray-800"
                    />
                    <span
                      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#06080e] ${
                        status === 'Available'
                          ? 'bg-emerald-400 ring-2 ring-emerald-400/20'
                          : status === 'Busy'
                          ? 'bg-amber-400 ring-2 ring-amber-400/20'
                          : 'bg-indigo-400 ring-2 ring-indigo-400/20'
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
                    <div className="absolute right-0 mt-2 w-64 rounded-3xl border border-white/[0.1] bg-[#0c101c] p-2.5 shadow-2xl shadow-black/80 z-50 animate-in fade-in zoom-in-95 duration-150">
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
                            className="text-[10px] px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-indigo-300 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                status === 'Available'
                                  ? 'bg-emerald-400'
                                  : status === 'Busy'
                                  ? 'bg-amber-400'
                                  : 'bg-indigo-400'
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
                          <Settings className="h-4 w-4 text-indigo-400" />
                          Audio/Video Studio & Settings
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
                className="text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 border border-indigo-400/30"
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
