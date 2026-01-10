/**
 * Beep SDK Service - SUI Pay Deep Link Flow
 * 
 * Uses SUI Pay protocol for Slush wallet payments
 */

import { BeepClient, SupportedToken } from '@beep-it/sdk-core';
import QRCode from 'qrcode';

// Initialize Beep client
const beepClient = new BeepClient({
    apiKey: process.env.BEEP_API_KEY || ''
});

if (!process.env.BEEP_API_KEY) {
    console.warn('[BeepSDK] ⚠️ BEEP_API_KEY not set!');
}

/**
 * Helper: Get UUID from numeric invoice ID (with retry)
 */
export async function getInvoiceUuid(invoiceId: string | number): Promise<string> {
    console.log('[BeepSDK] Mapping ID to UUID:', invoiceId);
    
    // Try 1: Direct getInvoice with numeric ID (some APIs accept both)
    try {
        console.log('[BeepSDK] Trying direct getInvoice with numeric ID...');
        const invoice = await beepClient.invoices.getInvoice(invoiceId.toString());
        const uuid = (invoice as any).uuid;
        if (uuid) {
            console.log('[BeepSDK] ✅ Got UUID from direct call:', uuid);
            return uuid;
        }
    } catch (e) {
        console.log('[BeepSDK] Direct call failed, falling back to listInvoices...');
    }
    
    // Try 2: List invoices and find by ID (with retry for newly created invoices)
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const invoices = await beepClient.invoices.listInvoices();
            console.log(`[BeepSDK] Attempt ${attempt}: Fetched ${invoices.length} invoices`);
            
            const invoice = invoices.find((inv: any) => 
                inv.id?.toString() === invoiceId.toString()
            );
            
            if (invoice) {
                const uuid = (invoice as any).uuid;
                if (!uuid) {
                    throw new Error(`Invoice ${invoiceId} missing UUID`);
                }
                
                console.log('[BeepSDK] ✅ Found UUID:', uuid);
                return uuid;
            }
            
            // Not found yet, wait before retry
            if (attempt < 3) {
                console.log(`[BeepSDK] Invoice ${invoiceId} not found yet, waiting 1s...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error(`[BeepSDK] Error on attempt ${attempt}:`, error);
            if (attempt === 3) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    throw new Error(`Invoice ${invoiceId} not found after 3 attempts`);
}

/**
 * Get Merchant ID
 */
export async function getMerchantId(): Promise<string> {
    const user = await beepClient.user.getCurrentUser();
    if (!user.merchantId) {
        throw new Error('Merchant ID not found');
    }
    return user.merchantId;
}

/**
 * Create Invoice with SUI Pay URL
 * 
 * 1. Create invoice
 * 2. Get UUID
 * 3. Get merchant SUI address
 * 4. Construct sui:pay URL
 * 5. Generate QR
 */
export async function createInvoice(params: {
    amount: number;
    description: string;
}): Promise<{
    invoiceId: string;
    paymentUrl: string;
    qrCode?: string;
}> {
    console.log('[BeepSDK] Creating invoice:', params.description, 'Amount:', params.amount);

    // 1. Create invoice
    const invoice = await beepClient.invoices.createInvoice({
        amount: Number(params.amount).toFixed(2),
        token: SupportedToken.USDC,
        description: params.description,
        payerType: 'customer_wallet' as const
    });

    console.log('[BeepSDK] ✅ Invoice created - Response:', JSON.stringify(invoice, null, 2));

    // 2. Get UUID - try to extract from response first!
    const invoiceAny = invoice as any;
    let uuid = invoiceAny.uuid;
    
    if (!uuid) {
        // Fallback: map via listInvoices (slower)
        console.warn('[BeepSDK] UUID not in response, mapping via listInvoices...');
        uuid = await getInvoiceUuid(invoice.id!);
    } else {
        console.log('[BeepSDK] ✅ UUID from response:', uuid);
    }

    // CHECK FOR OFFICIAL PAYMENT URL
    let paymentUrl = invoiceAny.url || invoiceAny.paymentUrl || invoiceAny.payment_url;

    if (paymentUrl) {
         console.log('[BeepSDK] ✅ Found OFFICIAL Beep Payment URL:', paymentUrl);
    } else {
        console.log('[BeepSDK] ⚠️ No official URL found, generating SUI Pay Deep Link...');

        // 3. Get merchant's SUI address for payment
        // NOTE: Invoice doesn't contain SUI address, only merchantId UUID
        // We need to get it from env variable or user API
        let merchantAddress = process.env.BEEP_MERCHANT_SUI_ADDRESS;
        
        if (!merchantAddress) {
            console.warn('[BeepSDK] ⚠️ BEEP_MERCHANT_SUI_ADDRESS not set in env');
            
            // Try to get from user API (if available)
            try {
                const user = await beepClient.user.getCurrentUser() as any;
                merchantAddress = user.suiAddress || user.sui_address || user.walletAddress || user.wallet_address;
                
                if (merchantAddress) {
                    console.log('[BeepSDK] ✅ Got merchant address from user API:', merchantAddress);
                }
            } catch (e) {
                console.error('[BeepSDK] Failed to get merchant address from user API:', e);
            }
        } else {
            console.log('[BeepSDK] ✅ Using merchant address from env');
        }

        if (!merchantAddress) {
            throw new Error(
                'Merchant SUI address not found. Please set BEEP_MERCHANT_SUI_ADDRESS in .env file. ' +
                'Get your merchant address from Beep dashboard.'
            );
        }

        console.log('[BeepSDK] Merchant SUI address:', merchantAddress);

        // 4. Construct SUI Pay deep link
        // Format: sui:pay?receiver=<ADDRESS>&amount=<AMOUNT>&coinType=<TYPE>&memo=<UUID>
        // Note: 'nonce' is sometimes used, but 'memo' is clearer for wallets
        const amountInSmallestUnits = Math.floor(params.amount * 1_000_000); // USDC has 6 decimals
        
        // Get Coin Type from env or default to Mainnet Wormhole USDC
        const USDC_COIN_TYPE = process.env.BEEP_USDC_COIN_TYPE || '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
        const REGISTRY = 'default-payment-registry';
        
        console.log('[BeepSDK] 💰 Using Coin Type:', USDC_COIN_TYPE);
        console.log('[BeepSDK] 📝 Memo/Nonce:', uuid);

        // Add memo (UUID) so Beep often uses this to match payments
        paymentUrl = `sui:pay?receiver=${merchantAddress}&amount=${amountInSmallestUnits}&coinType=${encodeURIComponent(USDC_COIN_TYPE)}&memo=${uuid}&nonce=${uuid}&registry=${REGISTRY}`;
        
        console.log('[BeepSDK] ✅ Generated SUI Pay URL:', paymentUrl);
    }

    // 5. Generate QR code
    let qrCode: string | undefined;
    try {
        qrCode = await QRCode.toDataURL(paymentUrl, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 300
        });
        console.log('[BeepSDK] ✅ QR code generated');
    } catch (qrError) {
        console.error('[BeepSDK] ⚠️ QR generation failed:', qrError);
    }

    return {
        invoiceId: uuid,
        paymentUrl,
        qrCode
    };
}

/**
 * Check Payment Status
 */
export async function getPaymentStatus(invoiceId: string): Promise<{ paid: boolean; status?: string }> {
    console.log('[BeepSDK] Checking status for:', invoiceId);

    try {
        const uuid = await getInvoiceUuid(invoiceId);
        
        const invoice = await beepClient.invoices.getInvoice(uuid);
        const paid = invoice.status === 'paid';
        
        console.log('[BeepSDK] Status:', invoice.status, '→ Paid:', paid);
        
        return { paid, status: invoice.status };
    } catch (error: any) {
        console.error('[BeepSDK] ❌ Status check failed:', error.message);
        return { paid: false, status: 'error' };
    }
}

/**
 * Issue Payment (for autonomous agents)
 */
export async function issuePayment(params: {
    invoiceUuid: string;
    payingMerchantId: string;
    assetChunks?: any[];
}): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        const response = await beepClient.payments.issuePayment({
            invoiceId: params.invoiceUuid,
            payingMerchantId: params.payingMerchantId,
            assetChunks: params.assetChunks || []
        });
        return { success: true, data: response };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Export service
export const beepSDKService = {
    createInvoice,
    getPaymentStatus,
    issuePayment,
    getMerchantId,
    getInvoiceUuid
};
