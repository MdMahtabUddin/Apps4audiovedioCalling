'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Video, Volume2, Shield, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandLogo } from '@/components/ui/brand-logo';
import { ThemeToggle } from '@/components/theme/theme-provider';
import { useToast } from '@/components/ui/toast';

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in');
      }

      toast.success('Welcome back!');
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 grid grid-cols-1 lg:grid-cols-12 transition-colors duration-200">
      {/* Left Executive Brand Showcase (Desktop) */}
      <div className="hidden lg:flex lg:col-span-6 relative flex-col justify-between p-12 border-r border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0c0c0f] overflow-hidden">
        <div className="absolute inset-0 bg-dot-matrix [mask-image:radial-gradient(ellipse_75%_65%_at_30%_30%,#000_40%,transparent_100%)] pointer-events-none" />

        <div className="relative z-10">
          <BrandLogo size="md" showTagline={true} href="/" />
        </div>

        <div className="relative z-10 max-w-md space-y-8 animate-fade-up">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] text-xs font-medium text-slate-700 dark:text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Enterprise Workspace
            </span>
            <h2 className="text-3xl xl:text-4xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white leading-[1.12]">
              Meetings engineered for clarity and speed.
            </h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              Launch instant HD rooms, collaborate with 48kHz studio audio, and manage your team schedule from one unified workspace.
            </p>
          </div>

          <div className="space-y-3.5 pt-2">
            {[
              {
                icon: Video,
                title: 'Adaptive 1080p HD Vedio',
                desc: 'Low-latency SFU routing with smart paginated gallery.',
              },
              {
                icon: Volume2,
                title: '48kHz Studio Voice Clarity',
                desc: 'Real-time noise suppression & voice clarity engine.',
              },
              {
                icon: Shield,
                title: 'Encrypted Host Controls',
                desc: 'Waiting rooms, passcodes, and attendance exports.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#f8fafc] dark:bg-[#111114] border border-slate-200/80 dark:border-white/[0.06]"
              >
                <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-600/10 border border-blue-200/70 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <item.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-500">
          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            All systems operational
          </span>
          <span>MetroMeet PRO</span>
        </div>
      </div>

      {/* Right Sign-In Form Panel */}
      <div className="lg:col-span-6 flex flex-col justify-center items-center p-6 sm:p-10 relative">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2">
          <Link
            href="/"
            className="text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            ← Home
          </Link>
          <ThemeToggle />
        </div>

        <div className="w-full max-w-[380px] space-y-6 animate-fade-up">
          <div className="space-y-2 text-center lg:text-left">
            <div className="lg:hidden flex justify-center pb-2">
              <BrandLogo size="md" showTagline={false} href="/" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Welcome back
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Sign in to continue to your MetroMeet workspace
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#111114] p-6 shadow-sm shadow-slate-900/[0.04] dark:shadow-none">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-xs text-rose-600 dark:text-rose-300 font-medium">
                  {error}
                </div>
              )}

              <Input
                id="email"
                type="email"
                label="Work email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full h-10 mt-1" isLoading={isLoading}>
                Sign in
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </form>
          </div>

          <div className="text-center text-xs text-slate-500 dark:text-zinc-400 px-1">
            New here?{' '}
            <Link href="/register" className="font-semibold text-slate-900 dark:text-white hover:underline underline-offset-4">
              Create account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
