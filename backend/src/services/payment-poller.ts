/**
 * =============================================================================
 * Payment Polling Service - Background Invoice Verification
 * =============================================================================
 * 
 * This service runs in the background, periodically checking for paid invoices.
 * When a payment is detected, it triggers the escrow creation and agent workflow.
 * 
 * WORKFLOW:
 * 1. Poll Beep API for unpaid invoices that now have 'paid' status
 * 2. When payment detected:
 *    a. Update job status in database
 *    b. Create escrow on SUI blockchain
 *    c. Trigger MCP agent to start work
 * 
 * =============================================================================
 */

import { beepSDKService } from './beep-sdk.js';
import { getUnpaidJobsWithInvoices, markJobAsEscrowed, updateJobStatus, getUserById } from '../db/queries.js';
import { createEscrow } from './sui.js';
// import { executeFreelanceTask } from './mcp-client.js'; // Removed - not using MCP
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// =============================================================================
// TYPES
// =============================================================================

interface PollerConfig {
    /** Polling interval in milliseconds */
    intervalMs: number;
    /** Maximum retries for failed operations */
    maxRetries: number;
    /** Whether to automatically trigger agent on payment */
    autoTriggerAgent: boolean;
}

// =============================================================================
// STATE
// =============================================================================

let pollerInterval: NodeJS.Timeout | null = null;
let isPolling = false;

// Default configuration
const config: PollerConfig = {
    intervalMs: 10000,  // 10 seconds
    maxRetries: 3,
    autoTriggerAgent: false // Disabled - no MCP agent
};

// =============================================================================
// MAIN POLLING FUNCTION
// =============================================================================

/**
 * Start the payment polling service
 */
export function startPaymentPolling(customConfig?: Partial<PollerConfig>): void {
    if (pollerInterval) {
        console.log('[PaymentPoller] Already running');
        return;
    }

    // Merge custom config
    Object.assign(config, customConfig);

    console.log(`[PaymentPoller] Starting with ${config.intervalMs}ms interval`);

    // Run immediately, then at interval
    pollForPayments();
    pollerInterval = setInterval(pollForPayments, config.intervalMs);
}

/**
 * Stop the payment polling service
 */
export function stopPaymentPolling(): void {
    if (pollerInterval) {
        clearInterval(pollerInterval);
        pollerInterval = null;
        console.log('[PaymentPoller] Stopped');
    }
}

/**
 * Main polling function - checks for paid invoices
 */
async function pollForPayments(): Promise<void> {
    // Prevent overlapping polls
    if (isPolling) {
        console.log('[PaymentPoller] Previous poll still running, skipping');
        return;
    }

    isPolling = true;

    try {
        // Step 1: Get unpaid jobs with invoices
        const unpaidJobs = await getUnpaidJobsWithInvoices();

        if (unpaidJobs.length === 0) {  
            return;
        }

        console.log(`[PaymentPoller] Checking ${unpaidJobs.length} pending invoices`);

        // Step 2: Check each invoice status
        for (const job of unpaidJobs) {
            if (!job.beep_invoice_id) {
                console.warn(`[PaymentPoller] Job ${job.id} has no invoice ID, skipping`);
                continue;
            }
            
            try {
                // Query Beep API for invoice status
                console.log(`[PaymentPoller] Checking invoice ${job.beep_invoice_id} for job ${job.id}...`);
                const invoice = await beepSDKService.getPaymentStatus(job.beep_invoice_id);
                
                if (invoice.status === 'paid') {
                    console.log(`[PaymentPoller] ✅ Payment detected for job ${job.id}`);
                    await processPayment(job);
                } else if (invoice.status === 'expired') {
                    console.log(`[PaymentPoller] ⏰ Invoice expired for job ${job.id}`);
                    await updateJobStatus(job.id, 'cancelled');
                } else {
                    // Still pending - do nothing
                    console.log(`[PaymentPoller] ⏳ Job ${job.id} still pending (${invoice.status})`);
                }
            } catch (error: any) {
                // Handle specific error cases
                if (error.response?.status === 400 || error.status === 400 || error.code === 'ERR_BAD_REQUEST') {
                    // 400 = Invoice not found or expired
                    console.warn(`[PaymentPoller] ⚠️ Invoice ${job.beep_invoice_id} not found or expired (job ${job.id})`);
                    console.warn(`[PaymentPoller] Marking job ${job.id} as cancelled`);
                    
                    try {
                        await updateJobStatus(job.id, 'cancelled');
                    } catch (updateError) {
                        console.error(`[PaymentPoller] Failed to cancel job ${job.id}:`, updateError);
                    }
                } else if (error.response?.status === 401 || error.status === 401) {
                    // 401 = Authentication error - critical, log and skip
                    console.error(`[PaymentPoller] ❌ Authentication error for job ${job.id}. Check BEEP_API_KEY!`);
                } else {
                    // Other errors - log and continue
                    console.error(`[PaymentPoller] ❌ Error checking job ${job.id}:`, error.message || error);
                }
                
                // Continue with other jobs even if one fails
            }
        }

        console.log(`[PaymentPoller] ✓ Poll cycle completed`);

    } catch (error) {
        console.error('[PaymentPoller] ❌ Error during polling:', error);
    } finally {
        isPolling = false;
    }
}

// =============================================================================
// PAYMENT PROCESSING
// =============================================================================

/**
 * Process a detected payment
 * 
 * WORKFLOW:
 * 1. Create escrow on SUI blockchain
 * 2. Update job status to 'escrowed' with blockchain details
 * 3. Optionally trigger MCP agent to start work
 */
async function processPayment(job: any): Promise<void> {
    const jobId = job.id;

    try {
        console.log(`[PaymentPoller] 🔒 Creating escrow for job ${jobId}...`);
        
        // Get buyer and agent wallet addresses from database
        const buyer = await getUserById(job.buyer_id);
        if (!buyer) {
            throw new Error(`Buyer not found for job ${jobId}`);
        }

        const agent = job.agent_id ? await getUserById(job.agent_id) : null;
        if (!agent && job.agent_id) {
            throw new Error(`Agent not found for job ${jobId}`);
        }

        // Get platform USDC coin to lock in escrow
        // Platform receives USDC from Beep, then locks it on-chain
        const platformUsdcCoin = await getPlatformUsdcCoin(job.amount_usdc);
        
        // Create escrow on SUI blockchain
        const escrowResult = await createEscrow({
            buyerAddress: buyer.wallet_address,
            agentAddress: agent ? agent.wallet_address : buyer.wallet_address, // Fallback to buyer if no agent yet
            amountUsdc: job.amount_usdc,
            jobReference: job.reference_key,
            usdcCoinId: platformUsdcCoin
        });
        
        if (!escrowResult.success) {
            throw new Error(`Escrow creation failed: ${escrowResult.error}`);
        }
        
        console.log(`[PaymentPoller] ✅ Escrow created: ${escrowResult.escrowObjectId}`);
        
        // Update job in database
        await markJobAsEscrowed(
            jobId,
            job.beep_invoice_id,
            escrowResult.escrowObjectId,
            escrowResult.txDigest
        );
        
        console.log(`[PaymentPoller] 📝 Job ${jobId} marked as escrowed`);
        
        // Trigger agent if auto-trigger is enabled
        if (config.autoTriggerAgent && job.agent_id) {
            console.log(`[PaymentPoller] 🤖 Triggering agent for job ${jobId}...`);
            await triggerAgentWork(job);
        }
        
        console.log(`[PaymentPoller] ✅ Payment processed successfully for job ${jobId}`);
        
    } catch (error) {
        console.error(`[PaymentPoller] ❌ Failed to process payment for job ${jobId}:`, error);
        
        // Job will be picked up in next poll cycle for retry
        // Could implement exponential backoff here if needed
    }
}

/**
 * Trigger the MCP agent to start working on a job
 * 
 * DISABLED: MCP client not implemented yet.
 * Jobs will remain in 'escrowed' status until manually started.
 */
async function triggerAgentWork(job: any): Promise<void> {
    console.log(`[PaymentPoller] ⚠️ Agent auto-trigger disabled. Job ${job.id} is escrowed.`);
    console.log(`[PaymentPoller] 👤 Agent must manually accept and work on this job.`);
    
    // Just update to 'working' status - manual workflow
    await updateJobStatus(job.id, 'working');
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get platform USDC coin to lock in escrow
 * 
 * DYNAMIC COIN MANAGEMENT:
 * 1. Query platform wallet for all USDC coins
 * 2. Find exact match OR
 * 3. Split larger coin OR
 * 4. Merge smaller coins
 */
async function getPlatformUsdcCoin(amountUsdc: number): Promise<string> {
    const suiClient = await import('./sui.js').then(m => m.getSuiClient());
    const platformAddress = process.env.PLATFORM_WALLET_ADDRESS || process.env.SUI_PLATFORM_ADDRESS;
    const usdc_coin_type = process.env.USDC_COIN_TYPE || '0x2::sui::SUI'; // Fallback to SUI for testnet
    
    if (!platformAddress) {
        throw new Error(
            'PLATFORM_WALLET_ADDRESS not set. ' +
            'Platform must have a wallet to manage USDC coins.'
        );
    }

    try {
        console.log(`[CoinManager] Finding USDC coin for ${amountUsdc} USDC...`);

        // Query all USDC coins owned by platform
        const coins = await suiClient.getCoins({
            owner: platformAddress,
            coinType: usdc_coin_type
        });

        if (!coins.data || coins.data.length === 0) {
            throw new Error(
                `No USDC coins found in platform wallet ${platformAddress}. ` +
                'Platform needs to be funded with USDC first.'
            );
        }

        // Convert amount to smallest unit (assuming 6 decimals for USDC)
        const amountInSmallestUnit = Math.floor(amountUsdc * 1_000_000);

        console.log(`[CoinManager] Found ${coins.data.length} USDC coins, looking for ${amountInSmallestUnit} units`);

        // Strategy 1: Find exact match
        const exactMatch = coins.data.find(coin => 
            parseInt(coin.balance) === amountInSmallestUnit
        );

        if (exactMatch) {
            console.log(`[CoinManager] ✅ Found exact match: ${exactMatch.coinObjectId}`);
            return exactMatch.coinObjectId;
        }

        // Strategy 2: Find coin larger than needed (will be split)
        const largerCoin = coins.data
            .filter(coin => parseInt(coin.balance) > amountInSmallestUnit)
            .sort((a, b) => parseInt(a.balance) - parseInt(b.balance))[0]; // Smallest sufficient coin

        if (largerCoin) {
            console.log(`[CoinManager] 💰 Found larger coin (${largerCoin.balance}), will split...`);
            const splitCoin = await splitPlatformCoin(
                largerCoin.coinObjectId,
                amountInSmallestUnit
            );
            console.log(`[CoinManager] ✅ Split complete: ${splitCoin}`);
            return splitCoin;
        }

        // Strategy 3: Merge smaller coins
        const totalBalance = coins.data.reduce((sum, coin) => 
            sum + parseInt(coin.balance), 0
        );

        if (totalBalance < amountInSmallestUnit) {
            throw new Error(
                `Insufficient USDC balance. ` +
                `Need: ${amountInSmallestUnit}, Have: ${totalBalance}. ` +
                `Platform wallet needs more USDC.`
            );
        }

        console.log(`[CoinManager] 🔄 No single coin sufficient, merging...`);
        const mergedCoin = await mergePlatformCoins(coins.data, amountInSmallestUnit);
        console.log(`[CoinManager] ✅ Merge complete: ${mergedCoin}`);
        return mergedCoin;

    } catch (error) {
        console.error('[CoinManager] ❌ Error managing platform USDC:', error);
        
        // Fallback to env variable for emergency cases
        const fallbackCoin = process.env.PLATFORM_USDC_COIN_ID;
        if (fallbackCoin) {
            console.warn(`[CoinManager] ⚠️ Using fallback coin from env: ${fallbackCoin}`);
            return fallbackCoin;
        }
        
        throw error;
    }
}

/**
 * Split a platform coin into exact amount + remainder
 */
async function splitPlatformCoin(
    coinId: string,
    amountNeeded: number
): Promise<string> {
    const { getSuiClient } = await import('./sui.js');
    
    const client = getSuiClient();
    const platformPrivateKey = process.env.SUI_PRIVATE_KEY;
    
    if (!platformPrivateKey) {
        throw new Error('Platform private key not set');
    }

    const keypair = Ed25519Keypair.fromSecretKey(platformPrivateKey);
    const tx = new Transaction();

    // Split coin: [amount_needed] + [remainder]
    tx.splitCoins(tx.object(coinId), [amountNeeded]);

    const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: {
            showEffects: true,
            showObjectChanges: true
        }
    });

    // Find the newly created coin object
    const created = result.objectChanges?.find(
        (change: any) => change.type === 'created' && change.objectType?.includes('Coin')
    );

    if (!created || !('objectId' in created)) {
        throw new Error('Failed to split coin: no new coin object found');
    }

    return (created as any).objectId;
}

/**
 * Merge multiple platform coins to get exact amount
 */
async function mergePlatformCoins(
    coins: any[],
    amountNeeded: number
): Promise<string> {
    const { getSuiClient } = await import('./sui.js');
    
    const client = getSuiClient();
    const platformPrivateKey = process.env.SUI_PRIVATE_KEY || process.env.PLATFORM_PRIVATE_KEY;
    
    if (!platformPrivateKey) {
        throw new Error('Platform private key not set');
    }

    // Sort coins by balance
    const sortedCoins = coins.sort((a, b) => 
        parseInt(b.balance) - parseInt(a.balance)
    );

    // Select coins until we have enough
    const coinsToMerge: string[] = [];
    let accumulatedBalance = 0;

    for (const coin of sortedCoins) {
        coinsToMerge.push(coin.coinObjectId);
        accumulatedBalance += parseInt(coin.balance);
        
        if (accumulatedBalance >= amountNeeded) {
            break;
        }
    }

    if (coinsToMerge.length === 0) {
        throw new Error('No coins to merge');
    }

    const keypair = Ed25519Keypair.fromSecretKey(platformPrivateKey);
    const tx = new Transaction();

    // Merge all coins into the first one
    const [primaryCoin, ...mergeCoins] = coinsToMerge;
    
    if (mergeCoins.length > 0) {
        tx.mergeCoins(
            tx.object(primaryCoin),
            mergeCoins.map(id => tx.object(id))
        );
    }

    // If merged amount > needed, split it
    if (accumulatedBalance > amountNeeded) {
        const [exactCoin] = tx.splitCoins(tx.object(primaryCoin), [amountNeeded]);
        tx.transferObjects([exactCoin], keypair.toSuiAddress());
    }

    const result = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: {
            showEffects: true,
            showObjectChanges: true
        }
    });

    // Return the coin with exact amount
    const created = result.objectChanges?.find(
        (change: any) => change.type === 'created' && change.objectType?.includes('Coin')
    );

    if (created && 'objectId' in created) {
        return (created as any).objectId;
    }

    // If no new coin created (merge only), return primary coin
    return primaryCoin;
}

/**
 * Infer task type from job details
 */
function inferTaskType(job: any): string {
    const title = job.title?.toLowerCase() || '';

    if (title.includes('audit')) return 'code_audit';
    if (title.includes('translate')) return 'translation';
    if (title.includes('code') || title.includes('develop')) return 'code_generation';

    return 'general';
}

/**
 * Check if poller is currently running
 */
export function isPollerRunning(): boolean {
    return pollerInterval !== null;
}

/**
 * Get poller statistics
 */
export function getPollerStats(): {
    running: boolean;
    intervalMs: number;
    isCurrentlyPolling: boolean;
} {
    return {
        running: pollerInterval !== null,
        intervalMs: config.intervalMs,
        isCurrentlyPolling: isPolling
    };
}

// Export helper functions for external use
export { getPlatformUsdcCoin };
