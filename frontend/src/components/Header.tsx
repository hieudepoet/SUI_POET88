'use client';

import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Header() {
  const pathname = usePathname();
  const currentAccount = useCurrentAccount();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (currentAccount?.address) {
      // Authenticate with backend
      fetch('http://localhost:3000/api/v1/users/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: currentAccount.address }),
      })
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setUser(data.data.user);
          }
        })
        .catch(console.error);
    }
  }, [currentAccount]);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/chat', label: '💬 AI Chat' },
    { href: '/agents', label: 'Agents' },
    { href: '/jobs', label: 'Jobs' },
    { href: '/dashboard', label: 'Dashboard' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-sky-500 rounded-lg blur-sm opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative bg-white rounded-lg p-2 border border-slate-200">
                <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg gradient-text">BeepLancer</span>
              <span className="text-xs text-slate-500">AI Marketplace</span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  pathname === link.href
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Wallet Connection */}
          <div className="flex items-center space-x-4">
            {user && (
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-slate-700">{user.displayName || 'User'}</span>
              </div>
            )}
            <div className="[&>button]:!rounded-lg [&>button]:!shadow-md [&>button]:!border-2 [&>button]:!border-indigo-100 [&>button]:!bg-gradient-to-r [&>button]:!from-indigo-600 [&>button]:!to-indigo-500 [&>button]:hover:!from-indigo-500 [&>button]:hover:!to-indigo-600 [&>button]:!transition-all [&>button]:!font-semibold">
              <ConnectButton />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
