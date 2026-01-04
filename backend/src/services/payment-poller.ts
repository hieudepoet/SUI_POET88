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

import { getInvoice } from './beep.js';
import { getUnpaidJobsWithInvoices, markJobAsEscrowed, updateJobStatus } from '../db/queries.js';
import { createEscrow } from './sui.js';
import { executeFreelanceTask } from './mcp-client.js';

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
    autoTriggerAgent: true
};

// =============================================================================
// MAIN POLLING FUNCTION
// =============================================================================

/**
 * Start the payment polling service
 * 
 * @param customConfig - Optional custom configuration
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
 * 
 * IMPLEMENTATION:
 * 1. Get all unpaid jobs that have invoice IDs
 * 2. For each job, check invoice status with Beep API
 * 3. If paid, process the payment
 * 
 * TODO: Implement with actual service calls
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
        // const unpaidJobs = await getUnpaidJobsWithInvoices();

        // if (unpaidJobs.length === 0) {
        //     return; // No pending invoices
        // }

        // console.log(`[PaymentPoller] Checking ${unpaidJobs.length} pending invoices`);

        // Step 2: Check each invoice
        // for (const job of unpaidJobs) {
        //     if (!job.beep_invoice_id) continue;
        //     
        //     try {
        //         const invoice = await getInvoice(job.beep_invoice_id);
        //         
        //         if (invoice.status === 'paid') {
        //             console.log(`[PaymentPoller] Payment detected for job ${job.id}`);
        //             await processPayment(job);
        //         } else if (invoice.status === 'expired') {
        //             console.log(`[PaymentPoller] Invoice expired for job ${job.id}`);
        //             await updateJobStatus(job.id, 'cancelled');
        //         }
        //     } catch (error) {
        //         console.error(`[PaymentPoller] Error checking job ${job.id}:`, error);
        //     }
        // }

        console.log('[PaymentPoller] Poll cycle - TODO: Implement');

    } catch (error) {
        console.error('[PaymentPoller] Error during polling:', error);
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
 * @param job - The job that was paid
 * 
 * WORKFLOW:
 * 1. Create escrow on SUI blockchain
 * 2. Update job status to 'escrowed' with blockchain details
 * 3. Optionally trigger MCP agent to start work
 * 
 * TODO: Implement full payment processing
 */
async function processPayment(job: any): Promise<void> {
    // const jobId = job.id;

    // try {
    //     // Step 1: Create escrow on SUI
    //     console.log(`[PaymentPoller] Creating escrow for job ${jobId}`);
    //     
    //     // Get agent wallet address
    //     // const agentWallet = await getAgentWallet(job.agent_id);
    //     
    //     // const escrowResult = await createEscrow({
    //     //     buyerAddress: job.buyer_wallet, // Need to join with users table
    //     //     agentAddress: agentWallet,
    //     //     amountUsdc: job.amount_usdc,
    //     //     jobReference: job.reference_key,
    //     //     usdcCoinId: 'TODO: Get from payment' // Need payment details
    //     // });
    //     
    //     // if (!escrowResult.success) {
    //     //     throw new Error(`Escrow creation failed: ${escrowResult.error}`);
    //     // }
    //     
    //     // Step 2: Update job in database
    //     // await markJobAsEscrowed(
    //     //     jobId,
    //     //     job.beep_invoice_id,
    //     //     escrowResult.escrowObjectId,
    //     //     escrowResult.txDigest
    //     // );
    //     
    //     console.log(`[PaymentPoller] Job ${jobId} escrowed successfully`);
    //     
    //     // Step 3: Trigger agent if auto-trigger is enabled
    //     if (config.autoTriggerAgent) {
    //         await triggerAgentWork(job);
    //     }
    //     
    // } catch (error) {
    //     console.error(`[PaymentPoller] Failed to process payment for job ${jobId}:`, error);
    //     // TODO: Implement retry logic or error handling
    // }

    console.log('[PaymentPoller] processPayment() - TODO: Implement');
}

/**
 * Trigger the MCP agent to start working on a job
 * 
 * @param job - The escrowed job
 * 
 * TODO: Implement agent triggering
 */
async function triggerAgentWork(job: any): Promise<void> {
    // console.log(`[PaymentPoller] Triggering agent for job ${job.id}`);

    // Update status to 'working'
    // await updateJobStatus(job.id, 'working');

    // Execute the freelance task
    // const result = await executeFreelanceTask({
    //     jobId: job.id,
    //     title: job.title,
    //     requirements: job.requirements,
    //     taskType: inferTaskType(job), // Determine from job details
    // });

    // if (result.success) {
    //     // Save delivery and update status
    //     // await saveDelivery(job.id, result);
    //     // await updateJobStatus(job.id, 'delivered');
    //     console.log(`[PaymentPoller] Job ${job.id} delivered`);
    // } else {
    //     console.error(`[PaymentPoller] Agent failed for job ${job.id}:`, result.error);
    //     // Could retry or mark as failed
    // }

    console.log('[PaymentPoller] triggerAgentWork() - TODO: Implement');
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Infer task type from job details
 */
function inferTaskType(job: any): string {
    // TODO: Implement logic to determine task type
    // Could be based on job title, requirements, or explicit field

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
