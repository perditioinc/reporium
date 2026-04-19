import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { LayoutShell } from '@/components/LayoutShell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://www.reporium.com'),
  title: {
    default: 'Reporium - AI Dev Tool Library',
    template: '%s | Reporium',
  },
  description:
    'Browse the Reporium portfolio of AI development tools, taxonomy coverage, search results, and repo intelligence.',
  openGraph: {
    title: 'Reporium - AI Dev Tool Library',
    description:
      'Browse the Reporium portfolio of AI development tools, taxonomy coverage, search results, and repo intelligence.',
    url: 'https://www.reporium.com',
    siteName: 'Reporium',
    type: 'website',
    images: ['/opengraph-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Reporium - AI Dev Tool Library',
    description:
      'Browse the Reporium portfolio of AI development tools, taxonomy coverage, search results, and repo intelligence.',
    images: ['/opengraph-image.png'],
  },
};

// viewport-fit=cover lets env(safe-area-inset-*) resolve to real pixel values
// on iOS notch / home-indicator devices. Without it, insets stay 0.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://reporium-api-573778300586.us-central1.run.app" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://reporium-api-573778300586.us-central1.run.app" />
      </head>
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 antialiased`}>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
