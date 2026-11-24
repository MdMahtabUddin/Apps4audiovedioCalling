import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast';
import { PwaInstallBanner } from '@/components/ui/pwa-install-banner';
import { SystemStatusOverlay } from '@/components/ui/system-status-overlay';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#09090b',
};

export const metadata: Metadata = {
  title: 'MetroMeet — Enterprise Vedio Conferencing',
  description: 'Fast, secure, high-definition vedio conferencing with studio voice clarity and self-hosted reliability.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MetroMeet PRO',
  },
  icons: {
    icon: '/icon-app.svg',
    apple: '/icon-app.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="min-h-screen bg-[#09090b] text-zinc-100 antialiased selection:bg-blue-600 selection:text-white overscroll-none">
        <ToastProvider>
          <SystemStatusOverlay />
          {children}
          <PwaInstallBanner />
        </ToastProvider>
      </body>
    </html>
  );
}
