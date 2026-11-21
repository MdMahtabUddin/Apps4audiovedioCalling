'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, Smartphone, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaInstallBanner() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Register service worker for PWA installability
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Ignore registration errors in restricted environments
      });
    }

    if (sessionStorage.getItem('metromeet_pwa_dismissed') === '1') {
      setDismissed(true);
      return;
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Detect iOS Safari
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos && isSafari) {
      setShowIosHint(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  // Don't show install prompt inside an active meeting room
  if (dismissed || pathname?.startsWith('/meeting/')) return null;
  if (!deferredPrompt && !showIosHint) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('metromeet_pwa_dismissed', '1');
  };

  return (
    <div className="fixed bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-2xl bg-[#071124]/95 backdrop-blur-2xl border border-[#00A3FF]/30 shadow-[0_16px_48px_rgba(0,0,0,0.65)] p-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#0066FF] to-[#FF7A00] flex items-center justify-center shrink-0 shadow-lg shadow-[#0066FF]/30">
          <Smartphone className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-extrabold text-white truncate">Install MetroMeet App</p>
          <p className="text-[10.5px] text-slate-400 leading-snug">
            {deferredPrompt
              ? 'Add to home screen for full-screen mobile app experience'
              : 'Tap Share icon → "Add to Home Screen"'}
          </p>
        </div>
        {deferredPrompt && (
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00A3FF] text-white text-[11px] font-bold flex items-center gap-1 shrink-0 shadow-md shadow-[#0066FF]/30 active:scale-95 transition-transform cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Install</span>
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="h-7 w-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
