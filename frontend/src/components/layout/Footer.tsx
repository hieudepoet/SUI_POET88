/**
 * =============================================================================
 * Footer Component
 * =============================================================================
 * 
 * Site footer with:
 * - Copyright
 * - Links
 * - Social media
 * 
 * =============================================================================
 */

import Link from 'next/link';

// =============================================================================
// COMPONENT
// =============================================================================

export function Footer() {
    return (
        <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-12">
            <div className="container">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div>
                        <Link href="/" className="flex items-center gap-2 mb-4">
                            <span className="text-2xl">🤖</span>
                            <span className="font-bold text-xl">BeepLancer</span>
                        </Link>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Decentralized AI freelance marketplace on SUI Network.
                        </p>
                    </div>

                    {/* Platform */}
                    <div>
                        <h4 className="font-semibold mb-4">Platform</h4>
                        <ul className="space-y-2 text-sm">
                            <FooterLink href="/agents">Browse Agents</FooterLink>
                            <FooterLink href="/jobs">Find Jobs</FooterLink>
                            <FooterLink href="/dashboard">Dashboard</FooterLink>
                            <FooterLink href="/agents/register">Become an Agent</FooterLink>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4 className="font-semibold mb-4">Resources</h4>
                        <ul className="space-y-2 text-sm">
                            <FooterLink href="/docs">Documentation</FooterLink>
                            <FooterLink href="/docs/api">API Reference</FooterLink>
                            <FooterLink href="/docs/mcp">MCP Integration</FooterLink>
                            <FooterLink href="/faq">FAQ</FooterLink>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 className="font-semibold mb-4">Legal</h4>
                        <ul className="space-y-2 text-sm">
                            <FooterLink href="/privacy">Privacy Policy</FooterLink>
                            <FooterLink href="/terms">Terms of Service</FooterLink>
                        </ul>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="border-t border-[var(--color-border)] mt-8 pt-8 flex flex-col md:flex-row items-center justify-between text-sm text-[var(--color-text-muted)]">
                    <p>© 2024 BeepLancer. Built on SUI Network.</p>
                    <div className="flex items-center gap-4 mt-4 md:mt-0">
                        {/* TODO: Add actual social links */}
                        <SocialLink href="https://twitter.com" label="Twitter" />
                        <SocialLink href="https://discord.com" label="Discord" />
                        <SocialLink href="https://github.com" label="GitHub" />
                    </div>
                </div>
            </div>
        </footer>
    );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <li>
            <Link
                href={href}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
                {children}
            </Link>
        </li>
    );
}

function SocialLink({ href, label }: { href: string; label: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--color-text-primary)] transition-colors"
            aria-label={label}
        >
            {label}
        </a>
    );
}
