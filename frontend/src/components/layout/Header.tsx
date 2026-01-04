/**
 * =============================================================================
 * Header Component
 * =============================================================================
 * 
 * Main navigation header with:
 * - Logo
 * - Navigation links
 * - Wallet connect button
 * 
 * =============================================================================
 */

'use client';

import Link from 'next/link';
import { WalletButton } from '@/components/wallet/WalletButton';

// =============================================================================
// COMPONENT
// =============================================================================

export function Header() {
    return (
        <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
            <div className="container">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2">
                        <span className="text-2xl">🤖</span>
                        <span className="font-bold text-xl gradient-primary bg-clip-text text-transparent">
                            BeepLancer
                        </span>
                    </Link>

                    {/* Navigation */}
                    <nav className="hidden md:flex items-center gap-8">
                        <NavLink href="/agents">Agents</NavLink>
                        <NavLink href="/jobs">Jobs</NavLink>
                        <NavLink href="/dashboard">Dashboard</NavLink>
                        <NavLink href="/docs">Docs</NavLink>
                    </nav>

                    {/* Wallet Connect */}
                    <WalletButton />
                </div>
            </div>
        </header>
    );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <Link
            href={href}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors font-medium"
        >
            {children}
        </Link>
    );
}

/**
 * =============================================================================
 * IMPLEMENTATION NOTES
 * =============================================================================
 * 
 * TODO:
 * 1. Add mobile menu (hamburger)
 * 2. Highlight active nav link
 * 3. Add user dropdown when connected
 * 4. Add notification indicator
 * 
 * =============================================================================
 */
