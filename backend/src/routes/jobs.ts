/**
 * =============================================================================
 * Jobs Routes - API Endpoints for Job Management
 * =============================================================================
 * 
 * Endpoints:
 * - POST   /api/v1/jobs              - Create new job
 * - GET    /api/v1/jobs              - List jobs (with filters)
 * - GET    /api/v1/jobs/:id          - Get job details
 * - POST   /api/v1/jobs/:id/hire     - Create invoice for hiring
 * - POST   /api/v1/jobs/:id/delivery - Submit job delivery
 * - POST   /api/v1/jobs/:id/approve  - Approve delivery & release escrow
 * - POST   /api/v1/jobs/:id/cancel   - Cancel job
 * 
 * =============================================================================
 */

import { Router, Request, Response } from 'express';
import * as queries from '../db/queries.js';
import { releaseEscrow, cancelEscrow } from '../services/sui.js';
import { createInvoice } from '../services/beep.js';

const router = Router();

// =============================================================================
// TYPES
// =============================================================================

interface CreateJobBody {
    title: string;
    requirements?: string;
    buyerId: number;
    agentId?: number;
    amountUsdc: number;
}

interface HireBody {
    generateQrCode?: boolean;
}

interface DeliveryBody {
    content: string;
    deliveryType?: 'code' | 'document' | 'link' | 'text';
    externalUrl?: string;
    notes?: string;
}

interface ApproveBody {
    approved: boolean;
    feedback?: string;
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /api/v1/jobs
 * Create a new job
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { title, requirements, buyerId, agentId, amountUsdc } = 
            req.body as CreateJobBody;

        // Validate required fields
        if (!title || !buyerId || !amountUsdc) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'title, buyerId, and amountUsdc are required',
            });
        }

        // Validate amount
        if (amountUsdc <= 0) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'amountUsdc must be greater than 0',
            });
        }

        // Create job
        const job = await queries.createJob(
            title,
            buyerId,
            amountUsdc,
            requirements,
            agentId
        );

        res.status(201).json({
            status: 201,
            error: false,
            message: 'Job created successfully',
            data: {
                job: {
                    id: job.id,
                    title: job.title,
                    requirements: job.requirements,
                    buyerId: job.buyer_id,
                    agentId: job.agent_id,
                    amountUsdc: job.amount_usdc,
                    status: job.status,
                    referenceKey: job.reference_key,
                    createdAt: job.created_at,
                },
            },
        });
    } catch (error) {
        console.error('Error creating job:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to create job',
        });
    }
});

/**
 * GET /api/v1/jobs
 * List jobs with optional filters
 * 
 * Query params:
 * - buyerId: Filter by buyer
 * - agentId: Filter by agent
 * - status: Filter by status
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const { buyerId, agentId, status } = req.query;

        let jobs;

        if (buyerId) {
            jobs = await queries.getJobsByBuyer(
                parseInt(buyerId as string),
                status as any
            );
        } else if (agentId) {
            jobs = await queries.getJobsByAgent(
                parseInt(agentId as string),
                status as any
            );
        } else {
            // TODO: Implement getAllJobs query
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Please provide buyerId or agentId filter',
            });
        }

        res.json({
            status: 200,
            error: false,
            message: `Found ${jobs.length} jobs`,
            data: {
                jobs: jobs.map(job => ({
                    id: job.id,
                    title: job.title,
                    requirements: job.requirements,
                    buyerId: job.buyer_id,
                    agentId: job.agent_id,
                    amountUsdc: job.amount_usdc,
                    status: job.status,
                    referenceKey: job.reference_key,
                    escrowObjectId: job.escrow_object_id,
                    createdAt: job.created_at,
                    deliveredAt: job.delivered_at,
                })),
                count: jobs.length,
            },
        });
    } catch (error) {
        console.error('Error listing jobs:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to list jobs',
        });
    }
});

/**
 * GET /api/v1/jobs/:id
 * Get job details
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const jobId = parseInt(req.params.id);

        if (isNaN(jobId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid job ID',
            });
        }

        const job = await queries.getJobById(jobId);

        if (!job) {
            return res.status(404).json({
                status: 404,
                error: true,
                message: 'Job not found',
            });
        }

        // TODO: Get related data (buyer, agent, deliveries)
        // const buyer = await queries.getUserById(job.buyer_id);
        // const agent = job.agent_id ? await queries.getUserById(job.agent_id) : null;
        // const deliveries = await queries.getDeliveriesByJob(jobId);

        res.json({
            status: 200,
            error: false,
            message: 'Job details retrieved successfully',
            data: {
                job: {
                    id: job.id,
                    title: job.title,
                    requirements: job.requirements,
                    buyerId: job.buyer_id,
                    agentId: job.agent_id,
                    amountUsdc: job.amount_usdc,
                    status: job.status,
                    referenceKey: job.reference_key,
                    beepInvoiceId: job.beep_invoice_id,
                    escrowObjectId: job.escrow_object_id,
                    escrowTxDigest: job.escrow_tx_digest,
                    releaseTxDigest: job.release_tx_digest,
                    createdAt: job.created_at,
                    paidAt: job.paid_at,
                    startedAt: job.started_at,
                    deliveredAt: job.delivered_at,
                    completedAt: job.completed_at,
                    paidOutAt: job.paid_out_at,
                },
                // buyer,
                // agent,
                // deliveries,
            },
        });
    } catch (error) {
        console.error('Error getting job details:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to get job details',
        });
    }
});

/**
 * PATCH /api/v1/jobs/:id/reference-key
 * Update job reference key (from Beep widget session)
 * 
 * Body:
 * - referenceKey: string
 */
router.patch('/:id/reference-key', async (req: Request, res: Response) => {
    try {
        const jobId = parseInt(req.params.id);
        const { referenceKey } = req.body;

        if (isNaN(jobId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid job ID',
            });
        }

        if (!referenceKey) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'referenceKey is required',
            });
        }

        // Update job reference key
        const job = await queries.updateJobReferenceKeyById(jobId, referenceKey);

        res.json({
            status: 200,
            error: false,
            message: 'Reference key updated',
            data: {
                job: {
                    id: job.id,
                    referenceKey: job.reference_key,
                },
            },
        });
    } catch (error) {
        console.error('Error updating reference key:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to update reference key',
        });
    }
});

/**
 * GET /api/v1/jobs/:id/payment-status
 * Check payment status for a job
 */
router.get('/:id/payment-status', async (req: Request, res: Response) => {
    try {
        const jobId = parseInt(req.params.id);

        if (isNaN(jobId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid job ID',
            });
        }

        const job = await queries.getJobById(jobId);
        
        if (!job) {
            return res.status(404).json({
                status: 404,
                error: true,
                message: 'Job not found'
            });
        }

        if (!job.beep_invoice_id) {
            return res.status(404).json({
                status: 404,
                error: true,
                message: 'Invoice not created yet'
            });
        }

        const { beepSDKService } = await import('../services/beep-sdk.js');
        const { verifyPaymentOnChain } = await import('../services/sui.js');
        
        // 1. Check official Beep status
        let isPaid = false;
        let paymentStatus: any = { paid: false };
        
        try {
            paymentStatus = await beepSDKService.getPaymentStatus(job.beep_invoice_id);
            if (paymentStatus.paid) {
                isPaid = true;
                console.log(`[Jobs] Beep status for job ${jobId}: PAID`);
            }
        } catch (e) {
            console.warn(`[Jobs] Beep status check failed for job ${jobId}`);
        }

        // 2. Fallback: Check on-chain if not paid via Beep API
        if (!isPaid) {
             const merchantAddress = process.env.BEEP_MERCHANT_SUI_ADDRESS;
             if (merchantAddress) {
                 const onChainResult = await verifyPaymentOnChain(
                     merchantAddress,
                     job.amount_usdc,
                     job.beep_invoice_id
                 );

                 if (onChainResult.paid) {
                     isPaid = true;
                     console.log(`[Jobs] On-chain check for job ${jobId}: PAID (tx: ${onChainResult.txDigest})`);
                 }
             }
        }

        res.json({
            status: 200,
            error: false,
            data: {
                paid: isPaid,
                jobId: job.id,
                method: isPaid ? 'on-chain-or-beep' : 'pending'
            },
        });
    } catch (error: any) {
        console.error('Error checking payment status:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to check payment status',
        });
    }
});

/**
 * POST /api/v1/jobs/:id/hire
 * Create Beep invoice for job payment
 * 
 * Body:
 * - generateQrCode: boolean (optional, default: true)
 */
router.post('/:id/hire', async (req: Request, res: Response) => {
    try {
        const jobId = parseInt(req.params.id);
        const { generateQrCode = true } = req.body as HireBody;

        if (isNaN(jobId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid job ID',
            });
        }

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
                message: `Cannot hire - job status is ${job.status}`,
            });
        }

        // Create invoice via Beep SDK
        const { beepSDKService } = await import('../services/beep-sdk.js');
        
        const invoice = await beepSDKService.createInvoice({
            amount: job.amount_usdc,
            description: `BeepLancer Job #${jobId}: ${job.title}`
        });

        console.log('[Jobs] ✅ Invoice created:', invoice.invoiceId);

        // Update job with invoice ID
        await queries.updateJobStatus(jobId, 'unpaid', {
            beep_invoice_id: invoice.invoiceId
        });

        res.json({
            status: 200,
            error: false,
            message: 'Invoice created',
            data: {
                invoice: {
                    id: invoice.invoiceId,
                    paymentUrl: invoice.paymentUrl,
                    qrCode: invoice.qrCode,
                    amount: job.amount_usdc
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
 * POST /api/v1/jobs/:id/delivery
 * Submit job delivery (agent only)
 * 
 * Body:
 * - content: string (the actual work result)
 * - deliveryType: 'code' | 'document' | 'link' | 'text'
 * - externalUrl: string (optional, for large files)
 * - notes: string (optional)
 */
router.post('/:id/delivery', async (req: Request, res: Response) => {
    try {
        const jobId = parseInt(req.params.id);
        const { content, deliveryType = 'text', externalUrl, notes } = 
            req.body as DeliveryBody;

        if (isNaN(jobId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid job ID',
            });
        }

        if (!content) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'content is required',
            });
        }

        const job = await queries.getJobById(jobId);

        if (!job) {
            return res.status(404).json({
                status: 404,
                error: true,
                message: 'Job not found',
            });
        }

        if (job.status !== 'working' && job.status !== 'escrowed') {
            return res.status(400).json({
                status: 400,
                error: true,
                message: `Cannot submit delivery - job status is ${job.status}`,
            });
        }

        // Save delivery to database
        const deliveryId = await queries.createDelivery(
            jobId,
            content,
            deliveryType,
            externalUrl,
            notes
        );

        // Update job status to 'delivered'
        await queries.updateJobStatus(jobId, 'delivered');

        res.json({
            status: 200,
            error: false,
            message: 'Delivery submitted successfully',
            data: {
                jobId,
                deliveryId,
                delivery: {
                    content: content.substring(0, 100) + '...', // Preview
                    deliveryType,
                    externalUrl,
                    notes,
                    submittedAt: new Date().toISOString(),
                },
            },
        });
    } catch (error) {
        console.error('Error submitting delivery:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to submit delivery',
        });
    }
});

/**
 * POST /api/v1/jobs/:id/approve
 * Approve delivery and release escrow (buyer only)
 * 
 * Body:
 * - approved: boolean
 * - feedback: string (optional)
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
    try {
        const jobId = parseInt(req.params.id);
        const { approved, feedback } = req.body as ApproveBody;

        if (isNaN(jobId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid job ID',
            });
        }

        if (typeof approved !== 'boolean') {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'approved (boolean) is required',
            });
        }

        const job = await queries.getJobById(jobId);

        if (!job) {
            return res.status(404).json({
                status: 404,
                error: true,
                message: 'Job not found',
            });
        }

        if (job.status !== 'delivered') {
            return res.status(400).json({
                status: 400,
                error: true,
                message: `Cannot approve - job must be 'delivered', current: ${job.status}`,
            });
        }

        if (approved) {
            // Release escrow on SUI blockchain
            let txDigest: string | undefined;
            
            if (job.escrow_object_id) {
                try {
                    // Get buyer address
                    const buyer = await queries.getUserById(job.buyer_id);
                    if (!buyer) {
                        throw new Error('Buyer not found');
                    }

                    const result = await releaseEscrow({
                        escrowObjectId: job.escrow_object_id,
                        buyerAddress: buyer.wallet_address
                    });
                    txDigest = result.txDigest;
                    console.log(`[Jobs] Escrow released: ${txDigest}`);
                } catch (error) {
                    console.error('[Jobs] Failed to release escrow:', error);
                    // Continue anyway to update status
                }
            }

            // Update job status to 'completed'
            await queries.updateJobStatus(jobId, 'completed', {
                release_tx_digest: txDigest
            });

            // Note: Beep payout would be handled separately or via payment poller

            res.json({
                status: 200,
                error: false,
                message: 'Delivery approved and escrow released',
                data: {
                    jobId,
                    status: 'completed',
                    releaseTxDigest: txDigest,
                    feedback,
                },
            });
        } else {
            // Rejected - request revision
            await queries.updateJobStatus(jobId, 'working');

            res.json({
                status: 200,
                error: false,
                message: 'Delivery rejected, requesting revision',
                data: {
                    jobId,
                    status: 'working',
                    feedback,
                },
            });
        }
    } catch (error) {
        console.error('Error approving delivery:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to approve delivery',
        });
    }
});

/**
 * POST /api/v1/jobs/:id/cancel
 * Cancel job and refund buyer
 */
router.post('/:id/cancel', async (req: Request, res: Response) => {
    try {
        const jobId = parseInt(req.params.id);

        if (isNaN(jobId)) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Invalid job ID',
            });
        }

        const job = await queries.getJobById(jobId);

        if (!job) {
            return res.status(404).json({
                status: 404,
                error: true,
                message: 'Job not found',
            });
        }

        // Only allow cancellation if not yet paid out
        if (job.status === 'paid_out' || job.status === 'completed') {
            return res.status(400).json({
                status: 400,
                error: true,
                message: `Cannot cancel - job is already ${job.status}`,
            });
        }

        // Cancel escrow if exists
        if (job.escrow_object_id) {
            try {
                await cancelEscrow(job.escrow_object_id);
                console.log(`[Jobs] Escrow cancelled for job ${jobId}`);
            } catch (error) {
                console.error('[Jobs] Failed to cancel escrow:', error);
                // Continue anyway to update status
            }
        }

        await queries.updateJobStatus(jobId, 'cancelled');

        res.json({
            status: 200,
            error: false,
            message: 'Job cancelled successfully',
            data: {
                jobId,
                status: 'cancelled',
            },
        });
    } catch (error) {
        console.error('Error cancelling job:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: 'Failed to cancel job',
        });
    }
});

/**
 * POST /api/v1/jobs/confirm-payment
 * Confirm Beep payment and create escrow
 * 
 * Body:
 * - jobId: number
 * - referenceKey: string (Beep payment reference)
 */
router.post('/confirm-payment', async (req: Request, res: Response) => {
    try {
        const { jobId, referenceKey } = req.body;

        console.log(`[Jobs] Confirming payment for job #${jobId}, ref: ${referenceKey}`);

        // Validate
        if (!jobId || !referenceKey) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'jobId and referenceKey are required'
            });
        }

        // Get job
        const job = await queries.getJobById(jobId);
        if (!job) {
            return res.status(404).json({
                status: 404,
                error: true,
                message: 'Job not found'
            });
        }

        // Verify payment via Beep SDK
        const { beepSDKService } = await import('../services/beep-sdk.js');
        const paymentStatus = await beepSDKService.getPaymentStatus(referenceKey);

        if (!paymentStatus.paid) {
            return res.status(400).json({
                status: 400,
                error: true,
                message: 'Payment not confirmed'
            });
        }

        console.log(`[Jobs] Payment confirmed for job #${jobId}`);

        // Get agent and buyer info
        const agent = await queries.getUserById(job.agent_id!);
        const buyer = await queries.getUserById(job.buyer_id);

        if (!agent || !buyer) {
            throw new Error('Agent or buyer not found');
        }

        console.log(`[Jobs] Creating escrow: ${job.amount_usdc} USDC for agent ${agent.wallet_address}`);

        // Get REAL USDC coin from platform wallet
        const { getPlatformUsdcCoin } = await import('../services/payment-poller.js');
        const usdcCoinId = await getPlatformUsdcCoin(job.amount_usdc);
        
        console.log(`[Jobs] Using USDC coin: ${usdcCoinId}`);

        // Create SUI escrow with REAL USDC
        const { createEscrow } = await import('../services/sui.js');
        const { getDb } = await import('../db/database.js');
        
        const escrow = await createEscrow({
            buyerAddress: buyer.wallet_address,
            agentAddress: agent.wallet_address,
            amountUsdc: job.amount_usdc,
            jobReference: job.reference_key || `JOB-${jobId}`,
            usdcCoinId // REAL USDC coin from platform
        });

        console.log(`[Jobs] ✅ Escrow created successfully: ${escrow.escrowObjectId}`);
        console.log(`[Jobs] Transaction: ${escrow.txDigest}`);

        // Update job status
        const db = getDb();
        await db.query(
            `UPDATE jobs 
             SET status = $1, 
                 escrow_object_id = $2, 
                 payment_tx = $3,
                 updated_at = NOW() 
             WHERE id = $4`,
            ['escrowed', escrow.escrowObjectId, escrow.txDigest, jobId]
        );

        res.json({
            status: 200,
            error: false,
            message: 'Payment confirmed and escrow created',
            data: {
                escrowObjectId: escrow.escrowObjectId,
                txDigest: escrow.txDigest
            }
        });

    } catch (error: any) {
        console.error('[Jobs] Error confirming payment:', error);
        res.status(500).json({
            status: 500,
            error: true,
            message: error.message || 'Failed to confirm payment'
        });
    }
});


/**
 * @route POST /api/v1/jobs/:id/simulate-payment
 * @desc TEST ONLY: Simulate successful payment
 */
router.post('/:id/simulate-payment', async (req, res) => {
    try {
        const jobId = parseInt(req.params.id);
        console.log(`[Jobs] 🛠️ Simulating payment for job ${jobId}...`);

        const job = await queries.getJobById(jobId);
        if (!job) {
            return res.status(404).json({ error: true, message: 'Job not found' });
        }

        // Manually trigger the PaymentPoller logic
        const { processPayment } = await import('../services/payment-poller.js');
        
        // Force process payment
        await processPayment(job);

        res.json({
            status: 200,
            error: false,
            message: 'Payment simulated and escrow triggered',
            data: {
                jobId,
                status: 'paid'
            }
        });
    } catch (error: any) {
        console.error('[Jobs] Simulation failed:', error);
        res.status(500).json({ status: 500, error: true, message: error.message });
    }
});

export default router;
