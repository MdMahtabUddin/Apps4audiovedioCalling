import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast';
import { SplashScreen } from '@/components/ui/splash-screen';
import { PwaInstallBanner } from '@/components/ui/pwa-install-banner';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#050a14',
};

export const metadata: Metadata = {
  title: 'MetroMeet — Enterprise Vedio Infrastructure by MetroNet',
  description: 'Ultra low-latency vedio conferencing platform powered by MetroNet optical backbone network with WebRTC mesh, waiting room security, and crystal-clear Opus audio.',
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
      <body className="min-h-screen bg-[#050a14] text-gray-100 antialiased selection:bg-[#0066FF] selection:text-white overscroll-none">
        <SplashScreen />
        <ToastProvider>
          {children}
          <PwaInstallBanner />
        </ToastProvider>
      </body>
    </html>
  );
}
