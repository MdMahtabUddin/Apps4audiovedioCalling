'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandLogo } from '@/components/ui/brand-logo';
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#060b14] relative overflow-hidden">
      {/* Subtle Executive Ambient Accent */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[280px] bg-[#0066FF]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[360px] h-[220px] bg-[#FF7A00]/6 rounded-full blur-[110px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Official MetroMeet PRO Brand Header */}
        <div className="text-center space-y-2 flex flex-col items-center">
          <BrandLogo size="lg" showTagline={true} href="/" />
          <h2 className="text-2xl font-bold tracking-tight text-white pt-2">Welcome back</h2>
          <p className="text-xs sm:text-sm text-slate-400">Sign in to your workspace to start or join meetings</p>
        </div>

        <Card className="border-white/[0.09] bg-[#0b1322]/92 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)] overflow-hidden p-0">
          <div className="h-[2px] w-full bg-gradient-to-r from-[#0066FF] via-[#00A3FF] to-[#FF7A00]" />
          <div className="p-6">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your email and password to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 font-medium">
                  {error}
                </div>
              )}

              <Input
                id="email"
                type="email"
                label="Email address"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-medium text-slate-300">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
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
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full mt-2" isLoading={isLoading}>
                Sign In
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-400 space-y-2.5">
              <div>
                Don&apos;t have an account?{' '}
                <Link href="/register" className="font-semibold text-sky-400 hover:text-sky-300 underline underline-offset-2">
                  Create one now
                </Link>
              </div>
              <div className="pt-2.5 border-t border-white/[0.07]">
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-[#FFA033] transition-colors"
                >
                  Admin Panel Login →
                </Link>
              </div>
            </div>
          </CardContent>
          </div>
        </Card>
      </div>
    </div>
  );
}
