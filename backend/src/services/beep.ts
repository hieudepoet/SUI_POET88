/**
 * =============================================================================
 * Beep Pay Service - Payment Processing Integration
 * =============================================================================
 * 
 * This module handles all interactions with the Beep Pay SDK:
 * - Creating invoices for job payments
 * - Checking invoice payment status
 * 
 * DOCUMENTATION: https://github.com/beep-it/beep-sdk/blob/dev/README.md (or official Beep SDK docs)
 * 
 * =============================================================================
 */

import { BeepClient, CreateCustomInvoicePayload, CreateInvoicePayload, Invoice, SupportedToken } from '@beep-it/sdk-core';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Configuration for Beep client initialization
 */
interface BeepConfig {
    apiKey: string;
    environment?: 'testnet' | 'mainnet';
}

/**
 * Invoice creation parameters
 */
export type CreateInvoiceParams = CreateCustomInvoicePayload & {
    referenceKey: string;
    jobType: string;
    webhookUrl?: string;
    redirectUrl?: string;
    expiresInMinutes?: number;
}

/**
 * Our BeepInvoice type (wrapper for SDK Invoice with our fields)
 */
export interface BeepInvoice {
    id: string;
    amount: number;
    token: string;
    status: 'pending' | 'paid' | 'expired' | 'cancelled';
    referenceKey: string;
    paymentUrl: string;
    qrCode: string;
    createdAt: Date;
    expiresAt: Date;
}

/**
 * Payout creation parameters
 */
export interface CreatePayoutParams {
    /** Amount in USDC */
    amount: number;
    /** Destination wallet address */
    destinationWallet: string;
    /** Reference for tracking */
    referenceKey: string;
    /** Optional: Description */
    description?: string;
}

/**
 * Payout object returned by Beep
 */
export interface BeepPayout {
    id: string;
    amount: number;
    token: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    destinationWallet: string;
    txDigest?: string;
    createdAt: Date;
    completedAt?: Date;
}

// =============================================================================
// CLIENT INSTANCE
// =============================================================================
let beepClient: BeepClient | null = null;

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the Beep Pay client
 */
export async function initializeBeepClient(): Promise<void> {
    const apiKey = process.env.BEEP_API_KEY;

    if (!apiKey) {
        throw new Error('BEEP_API_KEY environment variable is required');
    }

    beepClient = new BeepClient({
        apiKey,
    });

    // Verify connection
    const status = await beepClient.healthCheck();
    console.log('[BEEP] Server status:', status);
}

/**
 * Get the Beep client instance
 */
export function getBeepClient(): BeepClient {
    if (!beepClient) {
        throw new Error('Beep client not initialized. Call initializeBeepClient() first.');
    }
    return beepClient;
}

// =============================================================================
// INVOICE OPERATIONS
// =============================================================================

/**
 * Create a new payment invoice
 */
export async function createInvoice(params: CreateInvoiceParams): Promise<Invoice> {
    const client = getBeepClient();

    const payload: CreateInvoiceParams = {
        amount: params.amount.toString(),
        token: SupportedToken.USDC,
        description: params.description,
        payerType: 'customer_wallet',
        referenceKey: params.referenceKey,
        jobType: 'beeplancer_hire',
        webhookUrl: params.webhookUrl,
        redirectUrl: params.redirectUrl,
        expiresInMinutes: params.expiresInMinutes || 30
    };

    const invoice = await client.invoices.createInvoice(payload); 

    return {
        id: invoice.id || '',
        amount: typeof invoice.amount === 'string' ? parseFloat(invoice.amount) : (invoice.amount || 0),
        token: invoice.token,
        status: invoice.status || 'pending',
        referenceKey: params.referenceKey, 
        paymentUrl: invoice.paymentUrl || '',
        qrCode: invoice.qrCode || '',
        createdAt: invoice.createdAt ? new Date(invoice.createdAt) : new Date(),
        expiresAt: invoice.expiresAt ? new Date(invoice.expiresAt) : new Date(Date.now() + 30 * 60 * 1000)
    };
}

/**
 * Get invoice status by ID
 * 
 * Used by payment poller to check if invoices have been paid
 */
export async function getInvoice(invoiceId: string): Promise<BeepInvoice> {
    const client = getBeepClient();
    
    try {
        const invoice = await client.invoices.getInvoice(invoiceId);
        
        return {
            id: invoice.id || '',
            amount: typeof invoice.amount === 'string' ? parseFloat(invoice.amount) : (invoice.amount || 0),
            token: invoice.token?.toString() || 'USDC',
            status: (invoice.status as any) || 'pending',
            referenceKey: (invoice as any).metadata?.referenceKey || '',
            paymentUrl: invoice.paymentUrl || '',
            qrCode: invoice.qrCode || '',
            createdAt: invoice.createdAt ? new Date(invoice.createdAt) : new Date(),
            expiresAt: invoice.expiresAt ? new Date(invoice.expiresAt) : new Date(Date.now() + 30 * 60 * 1000)
        };
    } catch (error) {
        console.error('Error getting invoice:', error);
        throw new Error(`Failed to get invoice ${invoiceId}: ${error}`);
    }
}

/**
 * Get invoice by reference key
 */
export async function getInvoiceByReference(referenceKey: string): Promise<BeepInvoice | null> {
    const client = getBeepClient();
    
    try {
        const invoices = await client.invoices.listInvoices();
        
        // Find invoice with matching referenceKey in metadata
        const invoice = invoices.find((inv: any) => 
            inv.metadata?.referenceKey === referenceKey ||
            inv.description?.includes(`[Ref: ${referenceKey}]`)
        );
        
        if (!invoice) {
            return null;
        }
        
        return {
            id: invoice.id || '',
            amount: typeof invoice.amount === 'string' ? parseFloat(invoice.amount) : (invoice.amount || 0),
            token: invoice.token?.toString() || 'USDC',
            status: (invoice.status as any) || 'pending',
            referenceKey: (invoice as any).metadata?.referenceKey || referenceKey,
            paymentUrl: invoice.paymentUrl || '',
            qrCode: invoice.qrCode || '',
            createdAt: invoice.createdAt ? new Date(invoice.createdAt) : new Date(),
            expiresAt: invoice.expiresAt ? new Date(invoice.expiresAt) : new Date(Date.now() + 30 * 60 * 1000)
        };
    } catch (error) {
        console.error('Error getting invoice by reference:', error);
        return null; // Return null instead of throwing for not found case
    }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate platform fee for a given amount
 */
export function calculateFees(
    amount: number,
    feePercent: number = 5
): {
    grossAmount: number;
    platformFee: number;
    netAmount: number;
} {
    const platformFee = amount * (feePercent / 100);
    const netAmount = amount - platformFee;

    return {
        grossAmount: amount,
        platformFee: Math.round(platformFee * 1000000) / 1000000, // 6 decimal places
        netAmount: Math.round(netAmount * 1000000) / 1000000
    };
}

/**
 * Validate SUI wallet address format
 */
export function isValidSuiAddress(address: string): boolean {
    // SUI addresses are 66 characters (0x + 64 hex chars)
    const suiAddressRegex = /^0x[a-fA-F0-9]{64}$/;
    return suiAddressRegex.test(address);
}
