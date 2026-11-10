'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Video, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [devToken, setDevToken] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatusMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      setStatusMessage(data.message || 'Reset link sent successfully.');
      if (data.devToken) {
        setDevToken(data.devToken);
      }
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-[#0b0f19] via-[#0d1322] to-[#090d16]">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-xl shadow-indigo-600/30">
              <Video className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">
              Meet<span className="text-indigo-400">Flow</span>
            </span>
          </Link>
          <h2 className="text-2xl font-semibold tracking-tight text-white pt-2">Reset your password</h2>
          <p className="text-sm text-gray-400">Enter your email and we’ll send you recovery instructions</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Password Recovery</CardTitle>
            <CardDescription>We will send a secure password reset link to your email</CardDescription>
          </CardHeader>
          <CardContent>
            {statusMessage ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-start gap-3 text-xs leading-relaxed">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>{statusMessage}</div>
                </div>

                {devToken && (
                  <div className="p-3 bg-gray-950/80 rounded-xl border border-gray-800 text-xs text-gray-300 space-y-1">
                    <p className="font-semibold text-indigo-400">Quick Test Reset Link:</p>
                    <Link
                      href={`/reset-password?token=${devToken}`}
                      className="text-xs text-indigo-300 underline break-all hover:text-indigo-200"
                    >
                      /reset-password?token={devToken}
                    </Link>
                  </div>
                )}

                <Link href="/login" className="block w-full">
                  <Button variant="secondary" className="w-full">
                    Return to Login
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium">
                    {error}
                  </div>
                )}

                <Input
                  id="email"
                  type="email"
                  label="Registered Email address"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <Button type="submit" className="w-full mt-2" isLoading={isLoading}>
                  Send Recovery Link
                </Button>

                <div className="text-center pt-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Sign In
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
