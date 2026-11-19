import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast';
import { SplashScreen } from '@/components/ui/splash-screen';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'MetroMeet — Enterprise Vedio Infrastructure by MetroNet',
  description: 'Ultra low-latency vedio conferencing platform powered by MetroNet optical backbone network with WebRTC mesh, waiting room security, and crystal-clear Opus audio.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="min-h-screen bg-[#050a14] text-gray-100 antialiased selection:bg-[#0066FF] selection:text-white">
        <SplashScreen />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
