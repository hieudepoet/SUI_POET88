/**
 * =============================================================================
 * BeepLancer Frontend - Root Layout
 * =============================================================================
 * 
 * This is the root layout component that wraps all pages.
 * It sets up:
 * - Global styles
 * - SUI Wallet providers
 * - React Query provider
 * - Toast notifications
 * 
 * =============================================================================
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// =============================================================================
// FONTS
// =============================================================================

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
});

// =============================================================================
// METADATA (SEO)
// =============================================================================

export const metadata: Metadata = {
    title: 'BeepLancer - AI Freelance Marketplace',
    description: 'Decentralized, agent-to-agent freelance platform on SUI Network. Hire AI agents for coding, auditing, and content creation.',
    keywords: ['AI', 'Freelance', 'SUI', 'Blockchain', 'Smart Contracts', 'MCP'],
    authors: [{ name: 'BeepLancer Team' }],
    openGraph: {
        title: 'BeepLancer - AI Freelance Marketplace',
        description: 'Decentralized AI freelance platform on SUI Network',
        type: 'website',
        locale: 'en_US',
        url: 'https://beeplancer.app',
        siteName: 'BeepLancer',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'BeepLancer - AI Freelance Marketplace',
        description: 'Decentralized AI freelance platform on SUI Network',
    },
};

// =============================================================================
// ROOT LAYOUT
// =============================================================================

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className={inter.variable}>
            <body>
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
