/**
 * Beep Payment Hook - Backend Invoice Flow
 * 
 * SIMPLIFIED FLOW:
 * 1. Create invoice (get paymentUrl)
 * 2. User pays via Beep
 * 3. Poll payment status by jobId
 * 4. PaymentPoller (backend) automatically:
 *    - Detects payment
 *    - Creates escrow
 *    - Updates job status
 */

import { useState, useCallback } from 'react';

interface Job {
    id: number;
    title: string;
    description: string;
    amount_usdc: number;
}

export function useBeepPayment() {
    const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
    const [isWaitingPayment, setIsWaitingPayment] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Create invoice via backend
     * Returns: { invoiceId, paymentUrl, qrCode }
     */
    const createInvoice = useCallback(async (job: Job) => {
        setIsCreatingInvoice(true);
        setError(null);

        try {
            console.log('[BeepPayment] Creating invoice for job:', job.id);

            const response = await fetch(`http://localhost:3000/api/v1/jobs/${job.id}/hire`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ generateQrCode: true })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create invoice');
            }

            const data = await response.json();
            console.log('[BeepPayment] ✅ Invoice created:', data.data.invoice.id);

            return {
                invoiceId: data.data.invoice.id,
                paymentUrl: data.data.invoice.paymentUrl,
                qrCode: data.data.invoice.qrCode
            };
        } catch (err: any) {
            console.error('[BeepPayment] Failed:', err);
            setError(err.message || 'Failed to create invoice');
            throw err;
        } finally {
            setIsCreatingInvoice(false);
        }
    }, []);

    /**
     * Check payment status via backend
     * Backend uses invoiceId to check Beep API
     */
    const checkPaymentStatus = useCallback(async (jobId: number): Promise<boolean> => {
        try {
            const response = await fetch(
                `http://localhost:3000/api/v1/jobs/${jobId}/payment-status`
            );

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            return data.data.paid;
        } catch (err: any) {
            console.error('[BeepPayment] Error checking status:', err);
            return false;
        }
    }, []);

    /**
     * Poll payment until paid or timeout
     * 
     * When payment is detected:
     * - Backend PaymentPoller automatically creates escrow
     * - Job status updated to 'escrowed'
     * - Frontend just waits and shows success
     */
    const waitForPayment = useCallback(async (
        jobId: number,
        { intervalMs = 3000, timeoutMs = 10 * 60 * 1000 } = {}
    ): Promise<boolean> => {
        setIsWaitingPayment(true);
        setError(null);

        try {
            console.log('[BeepPayment] Waiting for payment (PaymentPoller will auto-create escrow)...');

            const startTime = Date.now();

            while (Date.now() - startTime < timeoutMs) {
                const paid = await checkPaymentStatus(jobId);

                if (paid) {
                    console.log('[BeepPayment] ✅ PAYMENT CONFIRMED!');
                    console.log('[BeepPayment] ℹ️ PaymentPoller will automatically create escrow');
                    return true;
                }

                await new Promise(resolve => setTimeout(resolve, intervalMs));
            }

            console.log('[BeepPayment] ⏰ Payment timeout');
            setError('Payment timeout');
            return false;

        } catch (err: any) {
            console.error('[BeepPayment] Error:', err);
            setError(err.message || 'Error checking payment');
            return false;
        } finally {
            setIsWaitingPayment(false);
        }
    }, [checkPaymentStatus]);

    return {
        createInvoice,
        waitForPayment,
        checkPaymentStatus,
        isCreatingInvoice,
        isWaitingPayment,
        error
    };
}
