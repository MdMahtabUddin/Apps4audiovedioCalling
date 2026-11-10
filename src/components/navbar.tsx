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
  const [status, setStatus] = useState<'Available' | 'Busy' | 'In a Meeting'>('Available');
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
    <header className="sticky top-0 z-40 w-full border-b border-gray-800/80 bg-[#0b0f19]/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2.5 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-all">
              <Video className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                Meet<span className="text-indigo-400">Flow</span>
              </span>
              <span className="text-[10px] text-gray-500 -mt-1 tracking-wider uppercase font-semibold">
                WebRTC Platform
              </span>
            </div>
          </Link>

          {user && (
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-gray-800 text-xs">
              <Badge variant="indigo" dot>
                Direct Mesh Ready
              </Badge>
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
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all hover:scale-105 cursor-pointer"
                >
                  <Video className="h-3.5 w-3.5 text-indigo-400" />
                  Instant Call
                </button>
              )}

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-gray-800/60 transition-colors border border-transparent hover:border-gray-800 cursor-pointer"
                >
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'}
                      alt={user.name}
                      className="h-8 w-8 rounded-full border border-indigo-500/40 object-cover bg-gray-800"
                    />
                    <span
                      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0b0f19] ${
                        status === 'Available'
                          ? 'bg-emerald-400'
                          : status === 'Busy'
                          ? 'bg-amber-400'
                          : 'bg-indigo-400'
                      }`}
                    />
                  </div>

                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-semibold text-gray-200">{user.name}</span>
                    <span className="text-[10px] text-gray-400 max-w-[120px] truncate">{user.email}</span>
                  </div>

                  <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden sm:block" />
                </button>

                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-gray-800 bg-[#111624] p-2 shadow-2xl shadow-black/50 z-50 animate-in fade-in zoom-in-95">
                      <div className="px-3 py-2 border-b border-gray-800/80 mb-1.5">
                        <p className="text-xs font-semibold text-white">{user.name}</p>
                        <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-[10px] text-gray-400">Status:</span>
                          <button
                            onClick={() =>
                              setStatus((prev) =>
                                prev === 'Available'
                                  ? 'Busy'
                                  : prev === 'Busy'
                                  ? 'In a Meeting'
                                  : 'Available'
                              )
                            }
                            className="text-[10px] px-2 py-0.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors"
                          >
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
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-gray-800/80 rounded-xl transition-colors cursor-pointer"
                        >
                          <Settings className="h-4 w-4 text-gray-400" />
                          Audio/Video & Settings
                        </button>
                      )}

                      <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors mt-1 cursor-pointer"
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
                className="text-xs font-medium text-gray-300 hover:text-white px-3 py-2 rounded-xl hover:bg-gray-800/60 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/20 transition-all hover:scale-105"
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
