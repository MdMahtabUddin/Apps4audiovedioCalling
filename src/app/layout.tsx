import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast';
import { SplashScreen } from '@/components/ui/splash-screen';
import { PwaInstallBanner } from '@/components/ui/pwa-install-banner';
import { SystemStatusOverlay } from '@/components/ui/system-status-overlay';
import { ThemeProvider } from '@/components/theme/theme-provider';

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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
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

const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('metromeet_theme');
    if (t === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else if (t === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-[#f8fafc] dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 antialiased selection:bg-blue-600 selection:text-white overscroll-none">
        <ThemeProvider>
          <SplashScreen />
          <ToastProvider>
            <SystemStatusOverlay />
            {children}
            <PwaInstallBanner />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
