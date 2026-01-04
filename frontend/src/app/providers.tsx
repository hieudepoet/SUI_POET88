/**
 * =============================================================================
 * Providers Component
 * =============================================================================
 * 
 * This component wraps the app with all necessary providers:
 * - SUI Wallet Kit provider
 * - React Query provider
 * - Toast provider
 * 
 * =============================================================================
 */

'use client';

import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// TODO: Import SUI wallet providers
// import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
// import { getFullnodeUrl } from '@mysten/sui/client';

// =============================================================================
// QUERY CLIENT
// =============================================================================

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 2,
        },
    },
});

// =============================================================================
// SUI NETWORK CONFIG
// =============================================================================

// TODO: Configure SUI network based on environment
// const networks = {
//   testnet: { url: getFullnodeUrl('testnet') },
//   devnet: { url: getFullnodeUrl('devnet') },
//   mainnet: { url: getFullnodeUrl('mainnet') },
// };

// const defaultNetwork = process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet';

// =============================================================================
// PROVIDERS COMPONENT
// =============================================================================

export function Providers({ children }: { children: ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            {/* 
        TODO: Add SUI Wallet providers
        
        <SuiClientProvider networks={networks} defaultNetwork={defaultNetwork}>
          <WalletProvider autoConnect>
            {children}
          </WalletProvider>
        </SuiClientProvider>
      */}
            {children}
        </QueryClientProvider>
    );
}

/**
 * =============================================================================
 * IMPLEMENTATION NOTES
 * =============================================================================
 * 
 * 1. SUI WALLET INTEGRATION:
 *    - Install @mysten/dapp-kit
 *    - Uncomment the SuiClientProvider and WalletProvider
 *    - Configure networks based on environment
 * 
 * 2. TOAST NOTIFICATIONS:
 *    - Consider adding Radix Toast provider or similar
 *    - Create a toast context for global notifications
 * 
 * 3. THEME PROVIDER:
 *    - Add theme context for dark/light mode toggle
 *    - Persist preference in localStorage
 * 
 * =============================================================================
 */
