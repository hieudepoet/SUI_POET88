/**
 * ===========================================================================
 * Payments Routes - API Endpoints for Payment Processing
 * =============================================================================
 * 
 * Endpoints:
 * - POST   /api/v1/payments/invoices        - Create payment invoice
 * - GET    /api/v1/payments/invoices/:id    - Get invoice status
 * - POST   /api/v1/payments/webhooks/beep   - Beep webhook handler
 * - GET    /api/v1/payments/history          - Payment history
 * 
 * =============================================================================
 */

import { Router, Request, Response } from 'express';
import * as queries from '../db/queries.js';

const router = Router();

// =============================================================================
// TYPES
// =============================================================================

interface CreateInvoiceBody {
    jobId: number;
    amount: number;
    generateQrCode?: boolean;
}

interface BeepWebhookPayload {
    event: string;
    invoiceId: string;
    referenceKey: string;
    status: string;
    amount: number;
    signature: string; // For webhook verification
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /api/v1/payments/invoices
 * Create a payment invoice for a job
 * 
 * Body:
 * - jobId: number
 * - amount: number
 * - generateQrCode: boolean (optional, default: true)
 */
router.post('/invoices', async (req: Request, res: Response) => {
    try {
        const { jobId, amount, generateQrCode = true } = req.body as CreateInvoiceBody;

        // Validate
        if (!jobId || !amount) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'jobId and amount are required',
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'amount must be greater than 0',
            });
        }

        // Get job
        const job = await queries.getJobById(jobId);

        if (!job) {
            return res.status(404).json({
                status: 404,
                error: true,
                message: 'Job not found',
            });
        }

        if (job.status !== 'unpaid') {
            return res.status(400).json({
                status: 400,
                error: true,
                message: `Job status must be 'unpaid', current: ${job.status}`,
            });
        }

        // TODO: Create Beep invoice
        // import { createInvoice } from '../services/beep.js';
        // 
        // const invoice = await createInvoice({
        //     amount,
        //     referenceKey: job.reference_key,
        //     description: `Payment for: ${job.title}`,
        //     generateQrCode,
        // });
        //
        // // Update job with invoice ID
        // await queries.updateJobStatus(jobId, 'unpaid', {
        //     beep_invoice_id: invoice.id,
        // });

        res.json({
            status: 200,
            error: false,
            message: 'Invoice created (TODO: implement Beep service)',
            data: {
                invoice: {
                    // id: invoice.id,
                    jobId,
                    amount,
                    referenceKey: job.reference_key,
                    // paymentUrl: invoice.paymentUrl,
                    // qrCode: invoice.qrCode,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
                },
            },
        });
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to create invoice',
        });
    }
});

/**
 * GET /api/v1/payments/invoices/:id
 * Get invoice status
 */
router.get('/invoices/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // TODO: Get invoice from Beep
        // import { getInvoiceStatus } from '../services/beep.js';
        // 
        // const invoice = await getInvoiceStatus(id);
        //
        // if (!invoice) {
        //     return res.status(404).json({
        //         status: 404,
        //         error: true,
        //         message: 'Invoice not found',
        //     });
        // }

        res.json({
            status: 200,
            error: false,
            message: 'Invoice status retrieved (TODO: implement Beep service)',
            data: {
                invoice: {
                    id,
                    // status: invoice.status,
                    // amount: invoice.amount,
                    // paidAt: invoice.paidAt,
                },
            },
        });
    } catch (error) {
        console.error('Error getting invoice status:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to get invoice status',
        });
    }
});

/**
 * POST /api/v1/payments/webhooks/beep
 * Webhook handler for Beep payment notifications
 * 
 * This endpoint is called by Beep when:
 * - Invoice is paid
 * - Payment is confirmed
 * - Payout is completed
 */
router.post('/webhooks/beep', async (req: Request, res: Response) => {
    try {
        const payload = req.body as BeepWebhookPayload;

        console.log('[Beep Webhook] Received event:', payload.event);

        // TODO: Verify webhook signature
        // import { verifyWebhookSignature } from '../services/beep.js';
        // 
        // const isValid = verifyWebhookSignature(payload, req.headers['x-beep-signature'] as string);
        // if (!isValid) {
        //     return res.status(401).json({
        //         status: 401,
        //         error: true,
        //         message: 'Invalid webhook signature',
        //     });
        // }

        // Handle different event types
        if (payload.event === 'invoice.paid') {
            // Find job by reference key
            const job = await queries.getJobByReferenceKey(payload.referenceKey);

            if (!job) {
                console.error('[Beep Webhook] Job not found for reference:', payload.referenceKey);
                return res.status(404).json({
                    status: 404,
                    error: true,
                    message: 'Job not found',
                });
            }

            if (job.status !== 'unpaid') {
                console.warn('[Beep Webhook] Job already processed:', job.id, job.status);
                return res.json({
                    status: 200,
                    error: false,
                    message: 'Job already processed',
                });
            }

            // TODO: Create escrow on SUI blockchain
            // import { createEscrow } from '../services/sui.js';
            // 
            // const escrowResult = await createEscrow({
            //     amount: job.amount_usdc,
            //     agentAddress: job.agent_id ? getAgentWallet(job.agent_id) : null,
            //     jobReference: job.reference_key,
            // });

            // Mark job as escrowed
            await queries.markJobAsEscrowed(
                job.id,
                payload.invoiceId,
                'MOCK_ESCROW_OBJECT_ID', // TODO: Use real escrowResult.escrowObjectId
                'MOCK_TX_DIGEST' // TODO: Use real escrowResult.transactionDigest
            );

            // TODO: Trigger agent via MCP
            // import { triggerAgent } from '../services/mcp-client.js';
            // 
            // if (job.agent_id) {
            //     await triggerAgent({
            //         agentId: job.agent_id,
            //         jobId: job.id,
            //         task: job.requirements,
            //     });
            // }

            console.log('[Beep Webhook] Job escrowed successfully:', job.id);

            return res.json({
                status: 200,
                error: false,
                message: 'Payment processed and escrow created (TODO: implement SUI service)',
                data: {
                    jobId: job.id,
                    status: 'esc rowed',
                },
            });
        }

        // Handle other webhook events
        console.log('[Beep Webhook] Unhandled event type:', payload.event);

        res.json({
            status: 200,
            error: false,
            message: 'Webhook received',
        });
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to process webhook',
        });
    }
});

/**
 * GET /api/v1/payments/history
 * Get payment history for a user
 * 
 * Query params:
 * - userId: number
 * - type: 'sent' | 'received' (optional)
 */
router.get('/history', async (req: Request, res: Response) => {
    try {
        const { userId, type } = req.query;

        if (!userId) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'userId is required',
            });
        }

        const userIdNum = parseInt(userId as string);

        // Get jobs based on type
        let jobs = [];

        if (type === 'sent' || !type) {
            const buyerJobs = await queries.getJobsByBuyer(userIdNum);
            jobs.push(...buyerJobs);
        }

        if (type === 'received' || !type) {
            const agentJobs = await queries.getJobsByAgent(userIdNum);
            jobs.push(...agentJobs);
        }

        // Filter only paid/completed jobs
        const paidJobs = jobs.filter(job => 
            job.status === 'escrowed' || 
            job.status === 'working' || 
            job.status === 'delivered' || 
            job.status === 'completed' || 
            job.status === 'paid_out'
        );

        // Format payment history
        const history = paidJobs.map(job => ({
            jobId: job.id,
            title: job.title,
            amount: job.amount_usdc,
            type: job.buyer_id === userIdNum ? 'sent' : 'received',
            status: job.status,
            paidAt: job.paid_at,
            completedAt: job.completed_at,
            escrowTxDigest: job.escrow_tx_digest,
            releaseTxDigest: job.release_tx_digest,
        }));

        res.json({
            status: 200,
            error: false,
            message: `Found ${history.length} payment records`,
            data: {
                history,
                count: history.length,
            },
        });
    } catch (error) {
        console.error('Error getting payment history:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to get payment history',
        });
    }
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Verify Beep webhook signature
 * TODO: Implement with Beep SDK
 */
function verifyWebhookSignature(payload: any, signature: string): boolean {
    // Use Beep SDK to verify signature
    // This prevents malicious webhook calls
    
    console.warn('[TODO] Webhook signature verification not implemented');
    return true; // Accept all for MVP (INSECURE!)
}

export default router;
