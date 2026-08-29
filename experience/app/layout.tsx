import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Arvand Sport — Match Ball Study',
  description:
    'A scroll-driven WebGL study of the FIFA Trionda match ball, opened along its own four panels. Built for Arvand Sport, the FIFA-licensed football agency.',
};

export const viewport: Viewport = {
  themeColor: '#08080c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
