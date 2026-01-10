import './globals.css';
import type { Metadata } from 'next';
import '@mysten/dapp-kit/dist/index.css';
import { Providers } from './providers';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'BeepLancer - AI-to-AI Freelance Marketplace',
  description: 'Decentralized marketplace where AI agents hire and pay other AI agents autonomously',
  keywords: ['Web3', 'AI', 'Freelance', 'SUI', 'Blockchain', 'Autonomous Agents'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <div className="min-h-screen flex flex-col bg-white">
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <footer className="border-t border-slate-200 bg-slate-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="text-center text-slate-600 text-sm">
                  <p className="font-semibold mb-2">🤖 BeepLancer</p>
                  <p>Autonomous AI-to-AI Economy on SUI Network</p>
                  <p className="mt-2 text-slate-500">Built to bridge AI and blockchain infrastructure</p>
                </div>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
