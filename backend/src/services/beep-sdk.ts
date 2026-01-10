/**
 * Beep SDK Service - Payment Integration
 * 
 * Uses Beep's Payment Request flow (not Invoice flow!) for creating payment URLs
 */

import { BeepClient, SupportedToken } from '@beep-it/sdk-core';
import axios from 'axios';
import QRCode from 'qrcode';

// Initialize Beep client
const beepClient = new BeepClient({
    apiKey: process.env.BEEP_API_KEY || ''
});

if (!process.env.BEEP_API_KEY) {
    console.warn('[BeepSDK] ⚠️ BEEP_API_KEY not set!');
}

/**
 * Get Merchant ID from Beep SDK
 */
export async function getMerchantId(): Promise<string> {
    try {
        console.log('[BeepSDK] Fetching merchant ID...');
        
        const user = await beepClient.user.getCurrentUser();
        
        if (!user.merchantId) {
            throw new Error('Merchant ID not found in user response');
        }
        
        console.log('[BeepSDK] ✅ Merchant ID:', user.merchantId);
        return user.merchantId;
        
    } catch (error: any) {
        console.error('[BeepSDK] ❌ Error fetching merchant ID:', error.message);
        throw error;
    }
}

/**
 * Create payment request (CORRECT FLOW)
 * 
 * Uses requestAndPurchaseAsset with ephemeral items to get paymentUrl & QR code
 */
export async function createInvoice(params: {
    amount: number;
    description: string;
}): Promise<{
    invoiceId: string;
    paymentUrl: string;
    qrCode?: string;
}> {
    console.log('[BeepSDK] Creating payment request:', params.description);

    // Format amount to 2 decimal places as string
    const formattedAmount = Number(params.amount).toFixed(2);

    // Use requestAndPurchaseAsset with ephemeral asset
    const paymentData = await beepClient.payments.requestAndPurchaseAsset({
        assets: [{
            name: params.description,
            price: formattedAmount,
            quantity: 1,
            token: SupportedToken.USDC
        }],
        paymentLabel: 'BeepLancer',
        generateQrCode: true
    });

    if (!paymentData || !paymentData.referenceKey) {
        throw new Error('Failed to create payment request');
    }

    console.log('[BeepSDK] ✅ Payment request created');
    console.log('[BeepSDK] 🔑 Reference Key:', paymentData.referenceKey);
    console.log('[BeepSDK] 💳 Payment URL:', paymentData.paymentUrl);
    console.log('[BeepSDK] 📱 QR Code:', paymentData.qrCode ? 'Available' : 'Generated manually');

    // Generate QR code from URL if not provided
    let qrCodeDataUrl = paymentData.qrCode;
    if (!qrCodeDataUrl && paymentData.paymentUrl) {
        try {
            qrCodeDataUrl = await QRCode.toDataURL(paymentData.paymentUrl, {
                errorCorrectionLevel: 'H',
                margin: 1,
                width: 300
            });
            console.log('[BeepSDK] ✅ QR code generated from URL');
        } catch (qrError) {
            console.error('[BeepSDK] ⚠️ Failed to generate QR code:', qrError);
        }
    }

    return {
        invoiceId: paymentData.referenceKey,
        paymentUrl: paymentData.paymentUrl!,
        qrCode: qrCodeDataUrl
    };
}

/**
 * Check payment status using reference key
 */
export async function getPaymentStatus(referenceKey: string): Promise<{ paid: boolean; status?: string }> {
    console.log('[BeepSDK] Checking payment status for reference:', referenceKey);

    try {
        // Poll payment status via requestAndPurchaseAsset
        const status = await beepClient.payments.requestAndPurchaseAsset({
            paymentReference: referenceKey,
            generateQrCode: false
        });
        
        // Payment is complete when referenceKey is NOT returned
        const paid = !status?.referenceKey;

        console.log('[BeepSDK] Payment status:', status?.status, '→ paid:', paid);

        return { 
            paid,
            status: status?.status as string
        };
    } catch (error: any) {
        console.error('[BeepSDK] ❌ Error checking payment status:', error.message);
        
        // Return unpaid on error to avoid false positives
        return {
            paid: false,
            status: 'error'
        };
    }
}

/**
 * Issue payment for an invoice programmatically (for autonomous agents)
 */
export async function issuePayment(params: {
    invoiceUuid: string;
    payingMerchantId: string;
    assetChunks?: any[];
}): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log('[BeepSDK] Issuing payment for invoice:', params.invoiceUuid);

    try {
        const response = await beepClient.payments.issuePayment({
            invoiceId: params.invoiceUuid,
            payingMerchantId: params.payingMerchantId,
            assetChunks: params.assetChunks || []
        });

        console.log('[BeepSDK] ✅ Payment issued successfully');
        return {
            success: true,
            data: response
        };
    } catch (error: any) {
        console.error('[BeepSDK] ❌ Error issuing payment:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Export singleton service
export const beepSDKService = {
    createInvoice,
    getPaymentStatus,
    issuePayment,
    getMerchantId
};
