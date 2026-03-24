import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

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
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Reporium - AI Dev Tool Library',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Reporium - AI Dev Tool Library',
    description:
      'Browse the Reporium portfolio of AI development tools, taxonomy coverage, search results, and repo intelligence.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}
