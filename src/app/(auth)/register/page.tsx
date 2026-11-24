'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandLogo } from '@/components/ui/brand-logo';
import { ThemeToggle } from '@/components/theme/theme-provider';
import { useToast } from '@/components/ui/toast';

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 6) score += 25;
    if (pass.length >= 10) score += 25;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 25;
    if (/[0-9!@#$%^&*]/.test(pass)) score += 25;
    return score;
  };
  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      toast.success('Account created successfully!');
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f8fafc] dark:bg-[#09090b] relative transition-colors duration-200">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[400px] space-y-6 animate-fade-up">
        <div className="text-center space-y-2 flex flex-col items-center">
          <BrandLogo size="md" showTagline={true} href="/" />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white pt-2">Create an account</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">Start hosting HD Vedio meetings in seconds</p>
        </div>

        <Card className="p-6">
          <CardContent className="p-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-xs text-rose-600 dark:text-rose-300 font-medium">
                  {error}
                </div>
              )}

              <Input
                id="name"
                type="text"
                label="Full name"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <Input
                id="email"
                type="email"
                label="Email"
                placeholder="jane@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">Password</label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
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
                {password.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="h-1 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${
                          strength <= 25
                            ? 'bg-rose-500 w-1/4'
                            : strength <= 50
                            ? 'bg-amber-500 w-2/4'
                            : strength <= 75
                            ? 'bg-blue-500 w-3/4'
                            : 'bg-emerald-500 w-full'
                        }`}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-500">
                      {strength <= 25 ? 'Weak' : strength <= 50 ? 'Fair' : strength <= 75 ? 'Good' : 'Strong'}
                    </p>
                  </div>
                )}
              </div>

              <Input
                id="confirmPassword"
                type="password"
                label="Confirm password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <Button type="submit" className="w-full h-10 mt-1" isLoading={isLoading}>
                Create account
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-500 dark:text-zinc-400">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-slate-900 dark:text-white hover:underline underline-offset-4">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
