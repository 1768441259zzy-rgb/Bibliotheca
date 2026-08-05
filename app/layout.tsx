import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Decorations from '@/components/Decorations';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bibliotheca',
  description: 'Where aesthetics meet the echo of words.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen font-serif">
        <div className="site-bg relative min-h-screen">
          <Decorations />
          <Navbar />
          <main className="relative z-10 px-6 pb-32 pt-24 md:px-10 md:pt-28">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
